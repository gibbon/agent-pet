use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn app_dir() -> PathBuf {
    let mut p = dirs::home_dir().expect("home dir");
    p.push(".agent-pet");
    let _ = std::fs::create_dir_all(&p);
    p
}

pub fn port_file_path() -> PathBuf {
    app_dir().join("port")
}

pub fn position_file_path() -> PathBuf {
    app_dir().join("position.json")
}

pub fn remove_port_file() {
    let _ = std::fs::remove_file(port_file_path());
}

pub fn write_port_file(path: &Path, port: u16, token: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!("tmp-{}", std::process::id()));
    let mut opts = OpenOptions::new();
    opts.write(true).create_new(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut f = opts.open(&tmp)?;
    write!(f, "{port}\n{token}")?;
    f.sync_all()?;
    drop(f);
    #[cfg(windows)]
    restrict_acl_owner_only(&tmp)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

pub fn read_port_file(path: &Path) -> std::io::Result<(u16, String)> {
    let s = std::fs::read_to_string(path)?;
    let mut lines = s.lines();
    let port = lines
        .next()
        .unwrap_or("")
        .trim()
        .parse()
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "bad port"))?;
    let token = lines.next().unwrap_or("").trim().to_string();
    Ok((port, token))
}

#[cfg(windows)]
fn restrict_acl_owner_only(path: &Path) -> std::io::Result<()> {
    let user = whoami::username();
    let grant = format!("{user}:F");
    let status = std::process::Command::new("icacls")
        .arg(path)
        .args(["/inheritance:r", "/grant:r", &grant])
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "icacls failed",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_back_port_and_token() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("port");
        write_port_file(&path, 51247, "tok_abc").unwrap();
        let (port, token) = read_port_file(&path).unwrap();
        assert_eq!(port, 51247);
        assert_eq!(token, "tok_abc");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600, "must be owner-only");
        }
    }
}
