use tauri::{PhysicalPosition, WebviewWindow};

pub fn harden(win: &WebviewWindow) {
    let _ = win.set_decorations(false);
    let _ = win.set_always_on_top(true);
    let _ = win.set_skip_taskbar(true);
    let _ = win.set_resizable(false);
}

pub fn default_anchor(win: &WebviewWindow) -> (i32, i32) {
    if let Ok(Some(monitor)) = win.current_monitor() {
        let size = monitor.size();
        let pos = monitor.position();
        return (
            pos.x + size.width as i32 - 280,
            pos.y + size.height as i32 - 80,
        );
    }
    (100, 500)
}

pub fn restore_position(win: &WebviewWindow) -> Option<(i32, i32)> {
    let raw = std::fs::read_to_string(crate::portfile::position_file_path()).ok()?;
    let [x, y]: [i32; 2] = serde_json::from_str(&raw).ok()?;
    let _ = win.set_position(PhysicalPosition::new(x, y));
    let h = win.outer_size().ok()?.height as i32;
    Some((x, y + h))
}

pub fn persist_position(win: &tauri::Window) {
    if let Ok(pos) = win.outer_position() {
        let raw = serde_json::to_string(&[pos.x, pos.y]).unwrap_or_else(|_| "[0,0]".to_string());
        let _ = std::fs::write(crate::portfile::position_file_path(), raw);
    }
}
