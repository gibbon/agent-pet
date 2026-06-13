use std::collections::HashSet;

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
