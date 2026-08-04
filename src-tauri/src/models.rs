use serde::{Deserialize, Serialize};

/// Photo record stored in SQLite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Photo {
    pub id: Option<i64>,
    pub path: String,
    pub file_name: String,
    pub dir: String,
    pub file_size: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub taken_at: Option<String>,
    pub ai_score: Option<f64>,
    pub blur_score: Option<f64>,
    pub exposure: Option<f64>,
    pub fft_clarity: Option<f64>,
    pub noise_level: Option<f64>,
    pub color_harmony: Option<f64>,
    pub composition: Option<f64>,
    pub face_count: Option<i64>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub aperture: Option<f64>,
    pub shutter_speed: Option<f64>,
    pub iso: Option<i64>,
    pub focal_length: Option<f64>,
    pub exposure_bias: Option<f64>,
    pub phash: Option<String>,
    pub composite_score: Option<f64>,
    pub user_rating: Option<i32>,
    pub status: String,
    pub scored_at: Option<i64>,
    pub rated_at: Option<i64>,
    pub created_at: i64,
    pub album_id: Option<i64>,
}

/// Album/project record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: Option<i64>,
    pub name: String,
    pub source_dir: String,
    pub photo_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Filter for listing photos
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoFilter {
    pub album_id: Option<i64>,
    pub status: Option<String>,
    pub min_score: Option<f64>,
    pub max_score: Option<f64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub sort_by: String,
    pub sort_desc: bool,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Default for PhotoFilter {
    fn default() -> Self {
        Self {
            album_id: None,
            status: None,
            min_score: None,
            max_score: None,
            date_from: None,
            date_to: None,
            sort_by: "composite_score".to_string(),
            sort_desc: true,
            limit: None,
            offset: None,
        }
    }
}

/// AI score result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiScore {
    pub path: String,
    pub ai_score: Option<f64>,
    pub blur_score: Option<f64>,
    pub exposure: Option<f64>,
    pub fft_clarity: Option<f64>,
    pub noise_level: Option<f64>,
    pub color_harmony: Option<f64>,
    pub composition: Option<f64>,
    pub composite_score: Option<f64>,
    pub error: Option<String>,
}

/// Export result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success_count: i64,
    pub failed_count: i64,
    pub errors: Vec<String>,
}

/// Scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub album_id: i64,
    pub total: i64,
    pub photos: Vec<Photo>,
}

/// Progress event for batch operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub message: String,
}

/// Supported image extensions
pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "heic", "heif", "webp", "bmp", "tiff", "tif"];

/// Check if a file extension is a supported image type
pub fn is_image_file(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}
