use crate::image_proc;
use crate::models::{Album, AiScore, ExportResult, Photo, PhotoFilter, ScanResult};
use crate::nima;
use crate::scoring::{self, ScoringWeights};
use crate::scanner;
use crate::storage;
use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

/// Scan a directory and create an album with the found photos.
#[tauri::command]
pub fn scan_directory(
    dir: String,
    album_name: String,
    app: AppHandle,
) -> Result<ScanResult, String> {
    // Create album
    let album = storage::create_album(&album_name, &dir)?;

    // Scan directory
    let photos = scanner::scan_directory(&dir);

    // Insert into database
    let count = storage::batch_insert_photos(&photos, album.id.unwrap())?;

    // Emit progress event
    let _ = app.emit(
        "scan-complete",
        serde_json::json!({
            "album_id": album.id,
            "total": count,
        }),
    );

    // Return photos with album_id set
    let photos_with_album: Vec<Photo> = photos
        .iter()
        .map(|p| {
            let mut p = p.clone();
            p.album_id = album.id;
            p
        })
        .collect();

    Ok(ScanResult {
        album_id: album.id.unwrap(),
        total: count,
        photos: photos_with_album,
    })
}

/// Get thumbnail for a photo.
#[tauri::command]
pub fn get_thumbnail(path: String, size: u32) -> Result<String, String> {
    image_proc::get_thumbnail(&path, size)
}

/// Batch get thumbnails for multiple photos (parallel via rayon).
/// Returns a list of (path, data_url) pairs for successful ones.
#[tauri::command]
pub fn batch_get_thumbnails(paths: Vec<String>, size: u32) -> Result<Vec<(String, String)>, String> {
    let count = paths.len();
    let t = Instant::now();
    let result = image_proc::batch_get_thumbnails(&paths, size);
    let elapsed = t.elapsed();
    eprintln!(
        "[perf] batch_get_thumbnails: {:?} ({} images, {} results)",
        elapsed,
        count,
        result.len()
    );
    Ok(result)
}

/// Batch check disk cache for thumbnails without generating new ones.
/// Returns (path, Option<cache_path>) for each input.
/// Fast: only file stat operations in parallel, no image decoding.
#[tauri::command]
pub fn get_cached_thumbnail_paths(
    paths: Vec<String>,
    size: u32,
) -> Result<Vec<(String, Option<String>)>, String> {
    Ok(image_proc::batch_get_cached_paths(&paths, size))
}

/// Get a large preview image for the lightbox.
#[tauri::command]
pub fn get_preview_image(path: String, max_width: u32) -> Result<String, String> {
    image_proc::get_preview_image(&path, max_width)
}

/// List photos with filtering.
#[tauri::command]
pub fn list_photos(filter: PhotoFilter) -> Result<Vec<Photo>, String> {
    let t = Instant::now();
    let result = storage::list_photos(&filter);
    let elapsed = t.elapsed();
    eprintln!(
        "[perf] list_photos: {:?} ({} rows)",
        elapsed,
        result.as_ref().map(|v| v.len()).unwrap_or(0)
    );
    result
}

/// List all albums.
#[tauri::command]
pub fn list_albums() -> Result<Vec<Album>, String> {
    storage::list_albums()
}

/// Rate a photo (user rating + status).
#[tauri::command]
pub fn rate_photo(path: String, rating: Option<i32>, status: String) -> Result<bool, String> {
    storage::update_rating(&path, rating, &status)
}

/// Score a single photo using NIMA AI + heuristics.
/// Falls back to heuristic-only if NIMA model is not loaded.
#[tauri::command]
pub fn score_photo_ai(path: String) -> Result<AiScore, String> {
    let signals = image_proc::calculate_heuristics(&path)?;

    // Try NIMA inference; fall back to None if model not loaded or inference fails
    let ai_score = if nima::is_loaded() {
        match nima::score_image(&path) {
            Ok(score) => {
                log::debug!("NIMA score for {}: {:.2}", path, score);
                Some(score)
            }
            Err(e) => {
                log::warn!("NIMA inference failed for {}: {}", path, e);
                None
            }
        }
    } else {
        None
    };

    let composite = scoring::calculate_composite_score(ai_score, &signals);

    storage::update_scores(
        &path,
        ai_score,
        Some(signals.blur_score),
        Some(signals.exposure),
        Some(signals.fft_clarity),
        Some(signals.noise_level),
        Some(signals.color_harmony),
        Some(signals.composition),
        composite,
    )?;

    Ok(AiScore {
        path,
        ai_score,
        blur_score: Some(signals.blur_score),
        exposure: Some(signals.exposure),
        fft_clarity: Some(signals.fft_clarity),
        noise_level: Some(signals.noise_level),
        color_harmony: Some(signals.color_harmony),
        composition: Some(signals.composition),
        composite_score: composite,
        error: None,
    })
}

/// Batch score photos with progress events.
/// Uses NIMA AI + heuristics when available, falls back to heuristic-only.
#[tauri::command]
pub async fn batch_score_ai(paths: Vec<String>, app: AppHandle) -> Result<Vec<AiScore>, String> {
    let total = paths.len();
    let nima_loaded = nima::is_loaded();
    if nima_loaded {
        log::info!("Batch AI scoring: {} photos (NIMA enabled)", total);
    } else {
        log::info!("Batch scoring: {} photos (heuristic-only, NIMA not loaded)", total);
    }

    let t_start = Instant::now();

    // Use rayon for parallel processing.
    // NIMA inference is serialized via Mutex, but image loading/preprocessing
    // and heuristic analysis run in parallel.
    let results_vec: Vec<Result<AiScore, String>> = paths
        .par_iter()
        .map(|path| {
            let signals = image_proc::calculate_heuristics(path)?;

            // Try NIMA inference (serialized via internal Mutex)
            let ai_score = if nima_loaded {
                match nima::score_image(path) {
                    Ok(score) => Some(score),
                    Err(e) => {
                        log::warn!("NIMA failed for {}: {}", path, e);
                        None
                    }
                }
            } else {
                None
            };

            let composite = scoring::calculate_composite_score(ai_score, &signals);
            storage::update_scores(
                path,
                ai_score,
                Some(signals.blur_score),
                Some(signals.exposure),
                Some(signals.fft_clarity),
                Some(signals.noise_level),
                Some(signals.color_harmony),
                Some(signals.composition),
                composite,
            )?;

            Ok(AiScore {
                path: path.clone(),
                ai_score,
                blur_score: Some(signals.blur_score),
                exposure: Some(signals.exposure),
                fft_clarity: Some(signals.fft_clarity),
                noise_level: Some(signals.noise_level),
                color_harmony: Some(signals.color_harmony),
                composition: Some(signals.composition),
                composite_score: composite,
                error: None,
            })
        })
        .collect();

    let elapsed = t_start.elapsed();

    let mut results = Vec::with_capacity(total);
    for (i, result) in results_vec.into_iter().enumerate() {
        match result {
            Ok(score) => results.push(score),
            Err(e) => {
                results.push(AiScore {
                    path: paths[i].clone(),
                    ai_score: None,
                    blur_score: None,
                    exposure: None,
                    fft_clarity: None,
                    noise_level: None,
                    color_harmony: None,
                    composition: None,
                    composite_score: None,
                    error: Some(e),
                });
            }
        }

        // Emit progress every 5 photos or at the end
        if i % 5 == 0 || i == total - 1 {
            let _ = app.emit(
                "batch-score-progress",
                serde_json::json!({
                    "current": i + 1,
                    "total": total,
                }),
            );
        }
    }

    log::info!(
        "Batch scoring completed: {} photos in {:?} ({:.1}ms/photo, NIMA={})",
        total,
        elapsed,
        elapsed.as_millis() as f64 / total.max(1) as f64,
        nima_loaded
    );

    Ok(results)
}

/// Export selected photos to a destination folder.
#[tauri::command]
pub fn export_selection(
    paths: Vec<String>,
    dest: String,
    mode: String, // "copy" or "move"
) -> Result<ExportResult, String> {
    let mut success_count = 0i64;
    let mut failed_count = 0i64;
    let mut errors = Vec::new();

    // Create destination if it doesn't exist
    fs::create_dir_all(&dest)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;

    for path_str in &paths {
        let src = Path::new(path_str);
        let file_name = src
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        let dest_path = Path::new(&dest).join(file_name);

        // Handle name collisions
        let dest_path = if dest_path.exists() {
            let stem = src
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("photo");
            let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("");
            let timestamp = chrono::Utc::now().timestamp();
            let new_name = if ext.is_empty() {
                format!("{}_{}", stem, timestamp)
            } else {
                format!("{}_{}.{}", stem, timestamp, ext)
            };
            Path::new(&dest).join(new_name)
        } else {
            dest_path
        };

        let result = match mode.as_str() {
            "move" => fs::rename(src, &dest_path),
            _ => fs::copy(src, &dest_path).map(|_| ()),
        };

        match result {
            Ok(_) => success_count += 1,
            Err(e) => {
                failed_count += 1;
                errors.push(format!("{}: {}", file_name, e));
            }
        }
    }

    Ok(ExportResult {
        success_count,
        failed_count,
        errors,
    })
}

/// Get photo statistics for an album (or all photos if album_id is None).
#[tauri::command]
pub fn get_stats(album_id: Option<i64>) -> Result<storage::PhotoStats, String> {
    storage::get_stats(album_id)
}

/// Delete an album and its photos. Optionally clear thumbnail cache.
#[tauri::command]
pub fn delete_album(album_id: i64, clear_cache: Option<bool>) -> Result<bool, String> {
    // If cache cleanup is requested, get photo paths first
    if clear_cache.unwrap_or(false) {
        let paths = storage::get_album_photo_paths(album_id)?;
        // Delete DB records
        let result = storage::delete_album(album_id)?;
        // Clean cache
        let removed = image_proc::clear_album_cache(&paths);
        log::info!("Cleared {} cache files for album {}", removed, album_id);
        Ok(result)
    } else {
        storage::delete_album(album_id)
    }
}

/// Clear all thumbnail cache (disk + memory).
#[tauri::command]
pub fn clear_all_cache() -> Result<u64, String> {
    let removed = image_proc::clear_all_cache()?;
    log::info!("Cleared all cache: {} files removed", removed);
    Ok(removed)
}

/// Get the current scoring weights.
#[tauri::command]
pub fn get_scoring_weights() -> ScoringWeights {
    scoring::get_weights()
}

/// Update the scoring weights. Returns the normalized weights.
#[tauri::command]
pub fn set_scoring_weights(weights: ScoringWeights) -> Result<ScoringWeights, String> {
    scoring::set_weights(weights.clone());
    log::info!(
        "Scoring weights updated: sharpness={}, color={}, composition={}, exposure={}, noise_penalty={}",
        weights.sharpness,
        weights.color,
        weights.composition,
        weights.exposure,
        weights.noise_penalty
    );
    Ok(weights)
}

/// Check if the NIMA AI model is loaded and ready for inference.
#[tauri::command]
pub fn get_nima_status() -> bool {
    nima::is_loaded()
}

// We need rayon's parallel iterator
use rayon::prelude::*;
