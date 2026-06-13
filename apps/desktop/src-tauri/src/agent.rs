use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Clone)]
pub struct AgentSupervisor {
    inner: Arc<Mutex<AgentRuntime>>,
}

struct AgentRuntime {
    active: Option<ActiveAgent>,
    last_message: String,
    log: VecDeque<String>,
}

struct ActiveAgent {
    tool: AgentTool,
    child: Child,
    started_at: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentTool {
    Rdan,
}

#[derive(Debug, Eq, PartialEq)]
pub enum AgentError {
    UnknownTool,
    AlreadyRunning,
    NotRunning,
    MissingInstall,
    SpawnFailed,
}

#[derive(Serialize)]
pub struct AgentToolInfo {
    pub id: &'static str,
    pub label: &'static str,
    pub available: bool,
    pub detail: String,
}

#[derive(Serialize)]
pub struct AgentStatus {
    pub running: bool,
    pub tool: Option<&'static str>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<u64>,
    pub message: String,
    pub log: Vec<String>,
}

#[derive(Serialize)]
pub struct AgentLog {
    pub lines: Vec<String>,
}

impl AgentSupervisor {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(AgentRuntime {
                active: None,
                last_message: "idle".to_string(),
                log: VecDeque::new(),
            })),
        }
    }

    pub fn tools(&self) -> Vec<AgentToolInfo> {
        let rdan = rdan_dir();
        vec![AgentToolInfo {
            id: "rdan",
            label: "r.dan",
            available: rdan.is_some(),
            detail: rdan.map(|p| p.display().to_string()).unwrap_or_else(|| {
                "set AGENT_PET_RDAN_DIR or place r.dan next to agent-pet".to_string()
            }),
        }]
    }

    pub fn status(&self) -> AgentStatus {
        let mut inner = self.inner.lock().unwrap();
        reap_finished(&mut inner);
        AgentStatus {
            running: inner.active.is_some(),
            tool: inner.active.as_ref().map(|a| a.tool.id()),
            started_at: inner.active.as_ref().map(|a| a.started_at),
            message: inner.last_message.clone(),
            log: log_tail(&inner, 20),
        }
    }

    pub fn start(&self, tool: &str) -> Result<AgentStatus, AgentError> {
        let tool = AgentTool::parse(tool).ok_or(AgentError::UnknownTool)?;
        let mut inner = self.inner.lock().unwrap();
        reap_finished(&mut inner);
        if inner.active.is_some() {
            return Err(AgentError::AlreadyRunning);
        }
        inner.log.clear();

        let mut child = match tool {
            AgentTool::Rdan => spawn_rdan()?,
        };
        push_log(&mut inner, format!("starting {}", tool.id()));
        if let Some(stdout) = child.stdout.take() {
            spawn_log_reader(self.inner.clone(), "stdout", stdout);
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_log_reader(self.inner.clone(), "stderr", stderr);
        }
        inner.last_message = format!("{} started", tool.id());
        inner.active = Some(ActiveAgent {
            tool,
            child,
            started_at: now_secs(),
        });
        Ok(status_from_runtime(&inner))
    }

    pub fn stop(&self) -> Result<AgentStatus, AgentError> {
        let mut inner = self.inner.lock().unwrap();
        let Some(mut active) = inner.active.take() else {
            return Err(AgentError::NotRunning);
        };
        let _ = active.child.kill();
        let _ = active.child.wait();
        let message = format!("{} stopped", active.tool.id());
        inner.last_message = message.clone();
        push_log(&mut inner, message);
        Ok(status_from_runtime(&inner))
    }

    pub fn log(&self, limit: usize) -> AgentLog {
        let inner = self.inner.lock().unwrap();
        AgentLog {
            lines: log_tail(&inner, limit.clamp(1, 200)),
        }
    }
}

impl Default for AgentSupervisor {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentTool {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "rdan" => Some(Self::Rdan),
            _ => None,
        }
    }

    pub fn id(self) -> &'static str {
        match self {
            Self::Rdan => "rdan",
        }
    }
}

fn status_from_runtime(inner: &AgentRuntime) -> AgentStatus {
    AgentStatus {
        running: inner.active.is_some(),
        tool: inner.active.as_ref().map(|a| a.tool.id()),
        started_at: inner.active.as_ref().map(|a| a.started_at),
        message: inner.last_message.clone(),
        log: log_tail(inner, 20),
    }
}

fn reap_finished(inner: &mut AgentRuntime) {
    let Some(active) = inner.active.as_mut() else {
        return;
    };
    match active.child.try_wait() {
        Ok(Some(status)) => {
            let tool = active.tool;
            inner.active = None;
            let message = format!("{} exited with {status}", tool.id());
            inner.last_message = message.clone();
            push_log(inner, message);
        }
        Ok(None) => {}
        Err(err) => {
            let tool = active.tool;
            inner.active = None;
            let message = format!("{} status check failed: {err}", tool.id());
            inner.last_message = message.clone();
            push_log(inner, message);
        }
    }
}

fn spawn_log_reader<R>(inner: Arc<Mutex<AgentRuntime>>, stream: &'static str, reader: R)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines() {
            let Ok(line) = line else {
                break;
            };
            let clean = sanitize_log_line(&line);
            if clean.is_empty() {
                continue;
            }
            let mut inner = inner.lock().unwrap();
            push_log(&mut inner, format!("{stream}: {clean}"));
        }
    });
}

fn push_log(inner: &mut AgentRuntime, line: String) {
    const MAX_LINES: usize = 200;
    inner.log.push_back(line);
    while inner.log.len() > MAX_LINES {
        inner.log.pop_front();
    }
}

fn log_tail(inner: &AgentRuntime, limit: usize) -> Vec<String> {
    let start = inner.log.len().saturating_sub(limit);
    inner.log.iter().skip(start).cloned().collect()
}

fn sanitize_log_line(line: &str) -> String {
    line.chars()
        .filter(|c| *c == '\t' || !c.is_control())
        .take(500)
        .collect()
}

fn spawn_rdan() -> Result<Child, AgentError> {
    let cwd = rdan_dir().ok_or(AgentError::MissingInstall)?;
    let mut cmd = pnpm_command();
    cmd.current_dir(cwd)
        .args([
            "exec",
            "tsx",
            "bin/rdan.ts",
            "start",
            "--config",
            "examples/platform.yaml",
            "--port",
            "3002",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    cmd.spawn().map_err(|_| AgentError::SpawnFailed)
}

fn pnpm_command() -> Command {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "pnpm"]);
        cmd
    }
    #[cfg(not(windows))]
    {
        Command::new("pnpm")
    }
}

fn rdan_dir() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("AGENT_PET_RDAN_DIR") {
        let p = PathBuf::from(path);
        if is_rdan_dir(&p) {
            return Some(p);
        }
    }

    let cwd = std::env::current_dir().ok()?;
    let candidates = [
        cwd.join("../r.dan"),
        cwd.join("../../r.dan"),
        dirs::home_dir()?.join("projects/r.dan"),
    ];
    candidates.into_iter().find(|p| is_rdan_dir(p))
}

fn is_rdan_dir(path: &std::path::Path) -> bool {
    path.join("bin/rdan.ts").is_file() && path.join("package.json").is_file()
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_known_tools() {
        assert_eq!(AgentTool::parse("rdan"), Some(AgentTool::Rdan));
        assert_eq!(AgentTool::parse("bash"), None);
        assert_eq!(AgentTool::parse("../r.dan"), None);
    }

    #[test]
    fn reports_not_running_initially() {
        let sup = AgentSupervisor::new();
        let status = sup.status();
        assert!(!status.running);
        assert_eq!(status.tool, None);
    }

    #[test]
    fn sanitizes_log_lines() {
        assert_eq!(sanitize_log_line("ok\u{0000}\u{001b}[31m"), "ok[31m");
        assert_eq!("x".repeat(600).len(), 600);
        assert_eq!(sanitize_log_line(&"x".repeat(600)).len(), 500);
    }
}
