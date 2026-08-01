mod commands;
mod image_proc;
mod models;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
