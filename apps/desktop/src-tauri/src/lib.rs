pub mod agent;
pub mod commands;
pub mod pet;
pub mod portfile;
pub mod server;
pub mod tray;
pub mod window;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::report_bounds,
            commands::report_registry,
            commands::start_drag,
            commands::quit
        ])
        .setup(|app| {
            let win = app.get_webview_window("main").expect("main window");
            window::harden(&win);
            let state = server::AppState::new(app.handle().clone());
            let anchor =
                window::restore_position(&win).unwrap_or_else(|| window::default_anchor(&win));
            state.set_anchor(anchor.0, anchor.1);
            window::place_at_anchor(&win, anchor);
            app.manage(state.clone());
            tray::setup(app)?;
            tauri::async_runtime::spawn(server::serve(state));
            Ok(())
        })
        .on_window_event(|win, event| match event {
            tauri::WindowEvent::Moved(_) => window::persist_position(win),
            tauri::WindowEvent::Destroyed => portfile::remove_port_file(),
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if matches!(
                event,
                tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
            ) {
                portfile::remove_port_file();
            }
        });
}
