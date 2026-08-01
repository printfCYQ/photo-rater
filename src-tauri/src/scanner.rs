use crate::models::{is_image_file, Photo};
use rayon::prelude::*;
use std::path::Path;
use walkdir::WalkDir;

/// Scan a directory recursively for image files.
/// Uses rayon for parallel EXIF reading.
/// Returns a list of Photo records (without scores).
pub fn scan_directory(dir: &str) -> Vec<Photo> {
    let path = Path::new(dir);
    let now = chrono::Utc::now().timestamp();

    // Collect all image file paths first
    let entries: Vec<_> = WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| is_image_file(e.path()))
        .collect();

    // Process in parallel: read metadata + EXIF for all files at once
    entries
        .par_iter()
        .map(|entry| {
            let file_path = entry.path();
            let absolute_path = file_path.to_string_lossy().to_string();
            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let parent_dir = file_path
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("")
                .to_string();
            let file_size = entry
                .metadata()
                .map(|m| m.len() as i64)
                .unwrap_or(0);

            // Read EXIF (parallel)
            let (taken_at, width, height) = read_exif(file_path);

            Photo {
                id: None,
                path: absolute_path,
                file_name,
                dir: parent_dir,
                file_size,
                width,
                height,
                taken_at,
                ai_score: None,
                blur_score: None,
                exposure: None,
                face_count: None,
                composite_score: None,
                user_rating: None,
                status: "pending".to_string(),
                scored_at: None,
                rated_at: None,
                created_at: now,
                album_id: None,
            }
        })
        .collect()
}

/// Read EXIF data from an image file.
/// Returns (taken_at, width, height).
fn read_exif(path: &Path) -> (Option<String>, Option<i64>, Option<i64>) {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None, None),
    };
    let mut buf_reader = std::io::BufReader::new(&file);
    let exif_reader = exif::Reader::new();
    let exif_data = match exif_reader.read_from_container(&mut buf_reader) {
        Ok(e) => e,
        Err(_) => return (None, None, None),
    };

    let taken_at = exif_data
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());

    let width = exif_data
        .get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
        .or_else(|| exif_data.get_field(exif::Tag::ImageWidth, exif::In::PRIMARY))
        .and_then(|f| f.value.get_uint(0))
        .map(|v| v as i64);

    let height = exif_data
        .get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
        .or_else(|| exif_data.get_field(exif::Tag::ImageLength, exif::In::PRIMARY))
        .and_then(|f| f.value.get_uint(0))
        .map(|v| v as i64);

    (taken_at, width, height)
}
