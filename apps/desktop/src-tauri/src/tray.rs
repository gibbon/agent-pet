use serde_json::json;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
    let controls = MenuItem::with_id(app, "controls", "Animation Controls", true, None::<&str>)?;
    let start_rdan = MenuItem::with_id(app, "agent_start_rdan", "Start r.dan", true, None::<&str>)?;
    let stop_agent = MenuItem::with_id(app, "agent_stop", "Stop agent", true, None::<&str>)?;
    let agent_status = MenuItem::with_id(app, "agent_status", "Agent status", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &controls,
            &start_rdan,
            &stop_agent,
            &agent_status,
            &quit,
        ],
    )?;
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                crate::portfile::remove_port_file();
                app.exit(0);
            }
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let visible = win.is_visible().unwrap_or(true);
                    if visible {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
            "controls" => {
                if let Err(err) = open_controls(app) {
                    emit_say(app, format!("controls failed: {err}"));
                }
            }
            "agent_start_rdan" => {
                let state = app.state::<crate::server::AppState>();
                match state.agent.start("rdan") {
                    Ok(_) => {
                        let _ = app.emit("pet:state", json!({ "state": "building" }));
                        emit_say(app, "r.dan started");
                    }
                    Err(err) => emit_say(app, agent_error_message("r.dan", err)),
                }
            }
            "agent_stop" => {
                let state = app.state::<crate::server::AppState>();
                match state.agent.stop() {
                    Ok(_) => {
                        let _ = app.emit("pet:state", json!({ "state": "idle" }));
                        emit_say(app, "agent stopped");
                    }
                    Err(err) => emit_say(app, agent_error_message("agent", err)),
                }
            }
            "agent_status" => {
                let state = app.state::<crate::server::AppState>();
                let status = state.agent.status();
                emit_say(app, status.message);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn open_controls(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window("controls") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "controls", WebviewUrl::App("controls.html".into()))
        .title("Buddy Controls")
        .inner_size(520.0, 620.0)
        .min_inner_size(420.0, 480.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .skip_taskbar(false)
        .center()
        .build()?;
    Ok(())
}

fn emit_say(app: &tauri::AppHandle, text: impl Into<String>) {
    let _ = app.emit("pet:say", json!({ "text": text.into() }));
}

fn agent_error_message(tool: &str, err: crate::agent::AgentError) -> String {
    match err {
        crate::agent::AgentError::UnknownTool => format!("{tool} is not allowlisted"),
        crate::agent::AgentError::AlreadyRunning => "agent is already running".to_string(),
        crate::agent::AgentError::NotRunning => "agent is not running".to_string(),
        crate::agent::AgentError::MissingInstall => format!("{tool} install was not found"),
        crate::agent::AgentError::SpawnFailed => format!("{tool} failed to start"),
    }
}
