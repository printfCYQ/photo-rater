use image::imageops::FilterType;
use image::ImageReader;
use lru::LruCache;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

/// In-memory cache: path+size -> thumbnail file path on disk (fast path, no I/O).
static THUMB_CACHE: std::sync::LazyLock<Mutex<LruCache<String, PathBuf>>> =
    std::sync::LazyLock::new(|| {
        Mutex::new(LruCache::new(NonZeroUsize::new(2000).unwrap()))
    });

/// Use Triangle filter for thumbnails — 5x faster than Lanczos3, quality is fine at small sizes.
const THUMB_FILTER: FilterType = FilterType::Triangle;

/// Get the thumbnail cache directory, creating it if needed.
fn cache_dir() -> Result<PathBuf, String> {
    let cache = dirs::cache_dir()
        .ok_or_else(|| "Cannot determine cache directory".to_string())?;
    let dir = cache.join("com.photorater.desktop").join("thumbs");
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create cache dir: {}", e))?;
    }
    Ok(dir)
}

/// Hash a string into a hex string (for cache filename).
fn hash_path(s: &str) -> String {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Check if a cached thumbnail is still valid (exists and is newer than source file).
fn is_cache_valid(cache_path: &Path, source_path: &Path) -> bool {
    if !cache_path.exists() {
        return false;
    }
    let cache_mtime = cache_path
        .metadata()
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let source_mtime = source_path
        .metadata()
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);
    cache_mtime >= source_mtime
}

/// Generate a thumbnail for an image and return the file path to the cached JPEG.
/// Uses disk cache keyed by hash(path+size), validated by mtime.
pub fn get_thumbnail(path: &str, size: u32) -> Result<String, String> {
    let cache_key = format!("{}|{}", path, size);

    // Fast path: in-memory cache hit
    if let Ok(mut cache) = THUMB_CACHE.lock() {
        if let Some(cached_path) = cache.get(&cache_key) {
            if cached_path.exists() {
                return Ok(cached_path.to_string_lossy().to_string());
            }
        }
    }

    let img_path = Path::new(path);

    // Determine cache file path
    let dir = cache_dir()?;
    let hash = hash_path(&cache_key);
    let cache_file = dir.join(format!("{}_{}.jpg", hash, size));

    // Check disk cache validity
    if is_cache_valid(&cache_file, img_path) {
        // Store in memory cache and return
        if let Ok(mut cache) = THUMB_CACHE.lock() {
            cache.put(cache_key, cache_file.clone());
        }
        return Ok(cache_file.to_string_lossy().to_string());
    }

    // Generate thumbnail
    let reader = ImageReader::open(img_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Resize using Triangle (fast) — only resize if larger than target
    let thumbnail = if img.width() > size || img.height() > size {
        img.resize(size, size, THUMB_FILTER)
    } else {
        img
    };

    // Write JPEG to disk
    let mut buf = Vec::new();
    thumbnail
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    fs::write(&cache_file, &buf)
        .map_err(|e| format!("Failed to write cache file: {}", e))?;

    // Store in memory cache
    if let Ok(mut cache) = THUMB_CACHE.lock() {
        cache.put(cache_key, cache_file.clone());
    }

    Ok(cache_file.to_string_lossy().to_string())
}

/// Generate a large preview image for the lightbox (up to max_width px wide).
/// Writes to disk cache and returns the file path.
pub fn get_preview_image(path: &str, max_width: u32) -> Result<String, String> {
    let cache_key = format!("preview|{}|{}", path, max_width);

    // Fast path: in-memory cache hit
    if let Ok(mut cache) = THUMB_CACHE.lock() {
        if let Some(cached_path) = cache.get(&cache_key) {
            if cached_path.exists() {
                return Ok(cached_path.to_string_lossy().to_string());
            }
        }
    }

    let img_path = Path::new(path);

    let dir = cache_dir()?;
    let hash = hash_path(&cache_key);
    let cache_file = dir.join(format!("preview_{}_{}.jpg", hash, max_width));

    // Check disk cache validity
    if is_cache_valid(&cache_file, img_path) {
        if let Ok(mut cache) = THUMB_CACHE.lock() {
            cache.put(cache_key, cache_file.clone());
        }
        return Ok(cache_file.to_string_lossy().to_string());
    }

    let reader = ImageReader::open(img_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Resize to fit within max_width while maintaining aspect ratio
    let preview = if img.width() > max_width {
        img.resize(max_width, u32::MAX, THUMB_FILTER)
    } else {
        img
    };

    let mut buf = Vec::new();
    preview
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode preview: {}", e))?;

    fs::write(&cache_file, &buf)
        .map_err(|e| format!("Failed to write cache file: {}", e))?;

    if let Ok(mut cache) = THUMB_CACHE.lock() {
        cache.put(cache_key, cache_file.clone());
    }

    Ok(cache_file.to_string_lossy().to_string())
}

/// Batch generate thumbnails in parallel using rayon.
/// Returns a list of (path, cache_file_path) pairs for successful ones.
pub fn batch_get_thumbnails(paths: &[String], size: u32) -> Vec<(String, String)> {
    use rayon::prelude::*;

    paths
        .par_iter()
        .filter_map(|path| match get_thumbnail(path, size) {
            Ok(file_path) => Some((path.clone(), file_path)),
            Err(_) => None,
        })
        .collect()
}

/// Batch check disk cache for thumbnails WITHOUT generating new ones.
/// Returns (original_path, Option<cache_file_path>) for each input path.
/// If the disk cache exists and is valid, returns Some(path); otherwise None.
/// This is fast — only does file stat operations in parallel, no image decoding.
pub fn batch_get_cached_paths(paths: &[String], size: u32) -> Vec<(String, Option<String>)> {
    use rayon::prelude::*;

    let dir = match cache_dir() {
        Ok(d) => d,
        Err(_) => return paths.iter().map(|p| (p.clone(), None)).collect(),
    };

    paths
        .par_iter()
        .map(|path| {
            let img_path = Path::new(path);
            let cache_key = format!("{}|{}", path, size);
            let hash = hash_path(&cache_key);
            let cache_file = dir.join(format!("{}_{}.jpg", hash, size));

            // Also check memory cache
            if let Ok(mut cache) = THUMB_CACHE.lock() {
                if let Some(cached_path) = cache.get(&cache_key) {
                    if cached_path.exists() {
                        return (path.clone(), Some(cached_path.to_string_lossy().to_string()));
                    }
                }
            }

            // Check disk cache validity
            if is_cache_valid(&cache_file, img_path) {
                // Store in memory cache for future lookups
                if let Ok(mut cache) = THUMB_CACHE.lock() {
                    cache.put(cache_key, cache_file.clone());
                }
                return (path.clone(), Some(cache_file.to_string_lossy().to_string()));
            }

            (path.clone(), None)
        })
        .collect()
}

/// Calculate heuristic signals for a photo:
/// - Blur score (Laplacian variance, higher = sharper)
/// - Exposure (average brightness 0-255)
pub fn calculate_heuristics(path: &str) -> Result<(f64, f64), String> {
    let img_path = Path::new(path);
    let reader = ImageReader::open(img_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Downscale for faster processing
    let small = img.resize_exact(256, 256, THUMB_FILTER);
    let gray = small.to_luma8();

    // Calculate Laplacian variance (blur detection)
    let blur_score = laplacian_variance(&gray);

    // Calculate average brightness (exposure)
    let exposure = average_brightness(&gray);

    Ok((blur_score, exposure))
}

/// Calculate Laplacian variance for blur detection.
/// Higher values indicate sharper images.
fn laplacian_variance(gray: &image::GrayImage) -> f64 {
    let (width, height) = gray.dimensions();
    if width < 3 || height < 3 {
        return 0.0;
    }

    let mut laplacian_values = Vec::new();

    for y in 1..(height - 1) {
        for x in 1..(width - 1) {
            let center = gray.get_pixel(x, y).0[0] as f64;
            let top = gray.get_pixel(x, y - 1).0[0] as f64;
            let bottom = gray.get_pixel(x, y + 1).0[0] as f64;
            let left = gray.get_pixel(x - 1, y).0[0] as f64;
            let right = gray.get_pixel(x + 1, y).0[0] as f64;

            // Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
            let laplacian = top + bottom + left + right - 4.0 * center;
            laplacian_values.push(laplacian);
        }
    }

    if laplacian_values.is_empty() {
        return 0.0;
    }

    let mean = laplacian_values.iter().sum::<f64>() / laplacian_values.len() as f64;
    let variance =
        laplacian_values.iter().map(|v| (v - mean).powi(2)).sum::<f64>()
            / laplacian_values.len() as f64;

    variance
}

/// Calculate average brightness of a grayscale image.
fn average_brightness(gray: &image::GrayImage) -> f64 {
    let pixels = gray.as_raw();
    if pixels.is_empty() {
        return 0.0;
    }
    let sum: u64 = pixels.iter().map(|&p| p as u64).sum();
    sum as f64 / pixels.len() as f64
}
