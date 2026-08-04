mod commands;
mod grouping;
mod image_proc;
mod models;
mod nima;
mod scanner;
mod scoring;
mod storage;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Set webview background transparent — critical for macOS rounded corners
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some((0, 0, 0, 0).into()));
            }

            // Initialize database
            storage::init_db()
                .map_err(|e| {
                    log::error!("Failed to initialize database: {}", e);
                    e
                })?;

            // Initialize NIMA model — non-fatal if it fails (fallback to heuristics)
            let model_path = app
                .path()
                .resource_dir()
                .ok()
                .map(|d| d.join("models/nima_mobilenet.onnx"))
                .unwrap_or_else(|| {
                    // Fallback: try dev path relative to the executable
                    std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.join("models/nima_mobilenet.onnx")))
                        .unwrap_or_else(|| std::path::PathBuf::from("models/nima_mobilenet.onnx"))
                });

            match nima::init_session(&model_path) {
                Ok(()) => log::info!("NIMA model initialized from {:?}", model_path),
                Err(e) => log::warn!("NIMA model not loaded (AI scoring disabled): {}. Heuristic-only mode.", e),
            }

            log::info!("Photo Rater application started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::get_thumbnail,
            commands::batch_get_thumbnails,
            commands::get_cached_thumbnail_paths,
            commands::get_preview_image,
            commands::list_photos,
            commands::list_albums,
            commands::rate_photo,
            commands::score_photo_ai,
            commands::batch_score_ai,
            commands::export_selection,
            commands::get_stats,
            commands::delete_album,
            commands::clear_all_cache,
            commands::get_scoring_weights,
            commands::set_scoring_weights,
            commands::get_nima_status,
            commands::rescan_album_metadata,
            commands::get_time_tree,
            commands::get_location_groups,
            commands::get_similar_groups,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
