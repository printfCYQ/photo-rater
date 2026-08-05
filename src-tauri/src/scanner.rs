use crate::models::{is_image_file, Photo};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use walkdir::WalkDir;

/// Recursively collect all image file paths under `dir` (no decoding/EXIF read).
/// This is the cheap I/O walk that lets callers know the total count up front.
pub fn collect_image_paths(dir: &str) -> Vec<PathBuf> {
    let path = Path::new(dir);
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| is_image_file(e.path()))
        .map(|e| e.path().to_path_buf())
        .collect()
}

/// Read metadata + EXIF for each entry in parallel, building Photo records.
/// Calls `on_progress` with the number of files processed so far (1..=total)
/// so the caller can report import progress. The count is monotonic but not
/// necessarily aligned with entry order (parallel workers).
pub fn scan_entries(entries: &[PathBuf], on_progress: impl Fn(usize) + Sync) -> Vec<Photo> {
    let now = chrono::Utc::now().timestamp();
    let counter = std::sync::atomic::AtomicUsize::new(0);

    entries
        .par_iter()
        .map(|file_path| {
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
            let file_size = std::fs::metadata(file_path)
                .map(|m| m.len() as i64)
                .unwrap_or(0);

            // Read EXIF (parallel)
            let (
                taken_at,
                width,
                height,
                lat,
                lon,
                camera_make,
                camera_model,
                lens,
                aperture,
                shutter_speed,
                iso,
                focal_length,
                exposure_bias,
            ) = read_exif(file_path);

            let photo = Photo {
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
                fft_clarity: None,
                noise_level: None,
                color_harmony: None,
                composition: None,
                face_count: None,
                lat,
                lon,
                camera_make,
                camera_model,
                lens,
                aperture,
                shutter_speed,
                iso,
                focal_length,
                exposure_bias,
                phash: None,
                composite_score: None,
                user_rating: None,
                status: "pending".to_string(),
                scored_at: None,
                rated_at: None,
                created_at: now,
                album_id: None,
            };

            let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
            on_progress(done);
            photo
        })
        .collect()
}

/// Read EXIF data from an image file.
/// Returns (taken_at, width, height, lat, lon, make, model, lens,
/// aperture, shutter_speed, iso, focal_length, exposure_bias).
/// `taken_at` falls back to file modification time when EXIF is absent.
pub fn read_exif(path: &Path) -> (
    Option<String>,
    Option<i64>,
    Option<i64>,
    Option<f64>,
    Option<f64>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    Option<i64>,
    Option<f64>,
    Option<f64>,
) {
    let no_meta: (
        Option<String>,
        Option<i64>,
        Option<i64>,
        Option<f64>,
        Option<f64>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<f64>,
        Option<f64>,
        Option<i64>,
        Option<f64>,
        Option<f64>,
    ) = (None, None, None, None, None, None, None, None, None, None, None, None, None);

    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return no_meta,
    };
    let mut buf_reader = std::io::BufReader::new(&file);
    let exif_reader = exif::Reader::new();
    let exif_data = match exif_reader.read_from_container(&mut buf_reader) {
        Ok(e) => e,
        Err(_) => return (fallback_taken_at(path), None, None, None, None, None, None, None, None, None, None, None, None),
    };

    let taken_at = exif_data
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string())
        .or_else(|| exif_data
            .get_field(exif::Tag::DateTime, exif::In::PRIMARY)
            .map(|f| f.display_value().to_string()))
        .or_else(|| fallback_taken_at(path));

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

    let (lat, lon) = read_gps(&exif_data);

    let camera_make = exif_data
        .get_field(exif::Tag::Make, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());
    let camera_model = exif_data
        .get_field(exif::Tag::Model, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());
    let lens = exif_data
        .get_field(exif::Tag::LensModel, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string());
    let aperture = exif_data
        .get_field(exif::Tag::FNumber, exif::In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value));
    let shutter_speed = exif_data
        .get_field(exif::Tag::ExposureTime, exif::In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value));
    let iso = exif_data
        .get_field(exif::Tag::PhotographicSensitivity, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .map(|v| v as i64);
    let focal_length = exif_data
        .get_field(exif::Tag::FocalLength, exif::In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value));
    let exposure_bias = exif_data
        .get_field(exif::Tag::ExposureBiasValue, exif::In::PRIMARY)
        .and_then(|f| rational_to_f64(&f.value));

    (
        taken_at,
        width,
        height,
        lat,
        lon,
        camera_make,
        camera_model,
        lens,
        aperture,
        shutter_speed,
        iso,
        focal_length,
        exposure_bias,
    )
}

/// Extract the first rational value as f64 (handles both unsigned and signed rationals).
fn rational_to_f64(v: &exif::Value) -> Option<f64> {
    match v {
        exif::Value::Rational(rats) => rats.first().map(|r| r.to_f64()),
        exif::Value::SRational(rats) => rats.first().map(|r| r.to_f64()),
        _ => None,
    }
}

/// Format file modification time as EXIF-style "YYYY:MM:DD HH:MM:SS".
/// Used as a fallback when EXIF DateTimeOriginal is missing.
fn fallback_taken_at(path: &Path) -> Option<String> {
    let mtime = std::fs::metadata(path).ok()?.modified().ok()?;
    let datetime = chrono::DateTime::<chrono::Local>::from(mtime);
    Some(datetime.format("%Y:%m:%d %H:%M:%S").to_string())
}

/// Read GPS latitude/longitude from EXIF, returning (lat, lon) in degrees.
/// Handles N/S/E/W reference signs. (kamadak-exif reads GPS tags via In::PRIMARY.)
fn read_gps(exif: &exif::Exif) -> (Option<f64>, Option<f64>) {
    let lat = exif
        .get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY)
        .and_then(|f| parse_dms(&f.value))
        .map(|d| {
            let refn = exif
                .get_field(exif::Tag::GPSLatitudeRef, exif::In::PRIMARY)
                .map(|f| f.display_value().to_string());
            if refn.as_deref() == Some("S") {
                -d
            } else {
                d
            }
        });

    let lon = exif
        .get_field(exif::Tag::GPSLongitude, exif::In::PRIMARY)
        .and_then(|f| parse_dms(&f.value))
        .map(|d| {
            let refn = exif
                .get_field(exif::Tag::GPSLongitudeRef, exif::In::PRIMARY)
                .map(|f| f.display_value().to_string());
            if refn.as_deref() == Some("W") {
                -d
            } else {
                d
            }
        });

    (lat, lon)
}

/// Parse a DMS (degrees/minutes/seconds) rational triple into decimal degrees.
fn parse_dms(v: &exif::Value) -> Option<f64> {
    if let exif::Value::Rational(rats) = v {
        if rats.len() >= 3 {
            let d = rats[0].to_f64();
            let m = rats[1].to_f64();
            let s = rats[2].to_f64();
            return Some(d + m / 60.0 + s / 3600.0);
        }
    }
    None
}
