use std::collections::HashSet;

use serde_json::json;
use tauri::Emitter;
use tauri::{command, Manager, PhysicalPosition, PhysicalSize};

use crate::server::AppState;

const MAX_DIM: u32 = 4096;

#[command]
pub fn report_bounds(app: tauri::AppHandle, state: tauri::State<AppState>, w: f64, h: f64) {
    if !w.is_finite() || !h.is_finite() {
        return;
    }
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let nw = (w.max(1.0) as u32).min(MAX_DIM);
    let nh = (h.max(1.0) as u32).min(MAX_DIM);
    let (ax, ay_bottom) = state.anchor();
    let _ = win.set_size(PhysicalSize::new(nw, nh));
    let _ = win.set_position(PhysicalPosition::new(ax, ay_bottom - nh as i32));
}

#[command]
pub fn report_registry(state: tauri::State<AppState>, actions: Vec<String>) {
    let clean: HashSet<String> = actions
        .into_iter()
        .filter(|a| crate::pet::action_name_ok(a))
        .collect();
    state.set_registry(clean);
}

#[command]
pub fn animation_registry(state: tauri::State<AppState>) -> Vec<String> {
    state.registry_list()
}

#[command]
pub fn preview_state(app: tauri::AppHandle, state: String) -> Result<(), String> {
    if !crate::pet::is_state(&state) {
        return Err("unknown state".to_string());
    }
    app.emit("pet:state", json!({ "state": state }))
        .map_err(|err| err.to_string())
}

#[command]
pub fn preview_action(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    action: String,
) -> Result<(), String> {
    if !state.registry_contains(&action) {
        return Err("unknown action".to_string());
    }
    app.emit(
        "pet:play",
        json!({ "action": action, "loops": 1, "durationMs": null }),
    )
    .map_err(|err| err.to_string())
}

#[command]
pub fn preview_say(app: tauri::AppHandle, text: String) -> Result<(), String> {
    let capped: String = text.chars().take(240).collect();
    app.emit("pet:say", json!({ "text": capped, "ttl": 3000 }))
        .map_err(|err| err.to_string())
}

#[command]
pub fn start_drag(app: tauri::AppHandle, state: tauri::State<AppState>) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let _ = win.start_dragging();
    if let Ok(pos) = win.outer_position() {
        if let Ok(size) = win.outer_size() {
            state.set_anchor(pos.x, pos.y + size.height as i32);
        }
    }
}

#[command]
pub fn quit(app: tauri::AppHandle) {
    crate::portfile::remove_port_file();
    app.exit(0);
}
