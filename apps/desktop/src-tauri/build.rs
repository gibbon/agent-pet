fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "report_bounds",
            "start_drag",
            "quit",
            "report_registry",
        ]),
    ))
    .expect("failed to run tauri build script");
}
