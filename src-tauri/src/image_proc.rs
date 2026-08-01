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

/// Heuristic signals computed from a single photo.
/// All values are raw (not normalized to 0-1).
#[derive(Debug, Clone)]
pub struct HeuristicSignals {
    /// Laplacian variance — higher = sharper (typical range: 0–2000+)
    pub blur_score: f64,
    /// Average brightness 0–255, ideal ~128
    pub exposure: f64,
    /// Multi-scale frequency clarity ratio, 0–1 (higher = more fine detail)
    pub fft_clarity: f64,
    /// Estimated noise level, 0–1 (higher = noisier)
    pub noise_level: f64,
    /// Color harmony score, 0–1 (higher = richer, well-balanced color)
    pub color_harmony: f64,
    /// Rule-of-thirds composition score, 0–1 (higher = better composition)
    pub composition: f64,
}

/// Calculate all heuristic signals for a photo.
/// Processes at 512px for a good balance of speed and accuracy.
pub fn calculate_heuristics(path: &str) -> Result<HeuristicSignals, String> {
    let img_path = Path::new(path);
    let reader = ImageReader::open(img_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Downscale to 512px max side for efficient analysis
    let w = img.width();
    let h = img.height();
    let max_side = 512u32;
    let small = if w > max_side || h > max_side {
        if w > h {
            img.resize(max_side, u32::MAX, THUMB_FILTER)
        } else {
            img.resize(u32::MAX, max_side, THUMB_FILTER)
        }
    } else {
        img
    };

    let gray = small.to_luma8();
    let rgb = small.to_rgba8();

    // 1. Laplacian variance (existing, but on gray)
    let blur_score = laplacian_variance(&gray);

    // 2. Average brightness
    let exposure = average_brightness(&gray);

    // 3. Multi-scale frequency clarity
    let fft_clarity = fft_clarity_score(&gray);

    // 4. Noise level
    let noise_level = noise_detection(&gray);

    // 5. Color harmony
    let color_harmony = color_analysis(&rgb);

    // 6. Rule of thirds composition
    let composition = composition_score(&gray);

    Ok(HeuristicSignals {
        blur_score,
        exposure,
        fft_clarity,
        noise_level,
        color_harmony,
        composition,
    })
}

// ──────────────────────────────────────────────
// Signal calculation helpers
// ──────────────────────────────────────────────

/// Laplacian variance for blur detection.
/// Higher values = sharper images.
fn laplacian_variance(gray: &image::GrayImage) -> f64 {
    let (width, height) = gray.dimensions();
    if width < 3 || height < 3 {
        return 0.0;
    }

    let mut values = Vec::with_capacity((width as usize - 2) * (height as usize - 2));

    for y in 1..(height - 1) {
        for x in 1..(width - 1) {
            let c = gray.get_pixel(x, y).0[0] as f64;
            let t = gray.get_pixel(x, y - 1).0[0] as f64;
            let b = gray.get_pixel(x, y + 1).0[0] as f64;
            let l = gray.get_pixel(x - 1, y).0[0] as f64;
            let r = gray.get_pixel(x + 1, y).0[0] as f64;
            values.push(t + b + l + r - 4.0 * c);
        }
    }

    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    variance
}

/// Average brightness 0–255.
fn average_brightness(gray: &image::GrayImage) -> f64 {
    let pixels = gray.as_raw();
    if pixels.is_empty() {
        return 0.0;
    }
    let sum: u64 = pixels.iter().map(|&p| p as u64).sum();
    sum as f64 / pixels.len() as f64
}

/// Multi-scale frequency clarity (simulated FFT).
/// Compares gradient energy at native scale vs half scale.
/// Ratio > 1.5 = sharp fine details; ratio ≈ 1.0 = only coarse structure (blurry).
fn fft_clarity_score(gray: &image::GrayImage) -> f64 {
    let (w, h) = gray.dimensions();
    if w < 8 || h < 8 {
        return 0.5;
    }

    // Gradient magnitude at native scale
    let native_grad = gradient_magnitude_sum(gray, 1);

    // Downsample to half and compute gradient
    let half_w = w / 2;
    let half_h = h / 2;
    let half = image::imageops::resize(gray, half_w, half_h, THUMB_FILTER);
    let half_grad = gradient_magnitude_sum(&half, 1);

    // Ratio: fine detail energy relative to coarse structure
    let ratio = native_grad / (half_grad + 1e-6);
    // Map: ≈0.5 (all low-freq) → 0.0, ≈1.5+ (rich high-freq) → 1.0
    ((ratio - 0.5) / 1.2).clamp(0.0, 1.0)
}

/// Sum of gradient magnitudes across entire image.
/// stride > 1 for faster approximate computation.
fn gradient_magnitude_sum(gray: &image::GrayImage, stride: u32) -> f64 {
    let (w, h) = gray.dimensions();
    if w < 2 || h < 2 {
        return 0.0;
    }

    let mut sum = 0.0_f64;
    for y in (0..h - 1).step_by(stride as usize) {
        for x in (0..w - 1).step_by(stride as usize) {
            let dx = gray.get_pixel(x + 1, y).0[0] as f64 - gray.get_pixel(x, y).0[0] as f64;
            let dy = gray.get_pixel(x, y + 1).0[0] as f64 - gray.get_pixel(x, y).0[0] as f64;
            sum += (dx * dx + dy * dy).sqrt();
        }
    }
    sum / (w as f64 * h as f64) // normalize by area
}

/// Noise detection via local patch variance in flat regions.
/// Returns 0–1, higher = noisier.
fn noise_detection(gray: &image::GrayImage) -> f64 {
    let (w, h) = gray.dimensions();
    let patch = 8u32;
    if w < patch * 2 || h < patch * 2 {
        return 0.0;
    }

    let mut patch_vars = Vec::new();
    let step = 16u32;

    for y in (0..=h - patch).step_by(step as usize) {
        for x in (0..=w - patch).step_by(step as usize) {
            let mut sum = 0.0_f64;
            let mut sq_sum = 0.0_f64;
            let n = (patch * patch) as f64;

            for dy in 0..patch {
                for dx in 0..patch {
                    let v = gray.get_pixel(x + dx, y + dy).0[0] as f64;
                    sum += v;
                    sq_sum += v * v;
                }
            }

            let variance = (sq_sum / n) - (sum / n).powi(2);
            patch_vars.push(variance);
        }
    }

    if patch_vars.is_empty() {
        return 0.0;
    }

    // Sort and take the bottom 30% — these are the flattest regions,
    // where any variance is likely noise, not texture.
    patch_vars.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let idx = (patch_vars.len() as f64 * 0.3) as usize;
    let median_low = patch_vars[idx.min(patch_vars.len() - 1)];

    // Normalize: variance > 400 in flat patches = heavy noise
    (median_low / 400.0).min(1.0).max(0.0)
}

/// Color harmony analysis.
/// Evaluates saturation richness and color variety.
/// Returns 0–1, higher = better color.
fn color_analysis(rgb: &image::RgbaImage) -> f64 {
    let (w, h) = rgb.dimensions();
    let pixel_count = (w * h) as usize;
    if pixel_count == 0 {
        return 0.5;
    }

    let mut saturations = Vec::with_capacity(pixel_count);

    for pixel in rgb.pixels() {
        let (r, g, b) = (pixel[0] as f64, pixel[1] as f64, pixel[2] as f64);
        let max_c = r.max(g).max(b);
        let min_c = r.min(g).min(b);

        if max_c > 0.0 {
            saturations.push((max_c - min_c) / max_c); // 0–1 saturation
        } else {
            saturations.push(0.0);
        }
    }

    saturations.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_sat = saturations[saturations.len() / 2];

    // Standard deviation of saturation
    let mean = saturations.iter().sum::<f64>() / saturations.len() as f64;
    let variance = saturations.iter().map(|v| (v - mean).powi(2)).sum::<f64>()
        / saturations.len() as f64;
    let sat_std = variance.sqrt();

    // Color variety: count distinct hue buckets
    let mut hue_buckets = [0u32; 12];
    for pixel in rgb.pixels() {
        let (r, g, b) = (pixel[0] as f32, pixel[1] as f32, pixel[2] as f32);
        let max_c = r.max(g).max(b);
        let min_c = r.min(g).min(b);
        let delta = max_c - min_c;

        if delta > 10.0 {
            // Compute hue bucket (simplified)
            let bucket = if max_c == r {
                (60.0 * (g - b) / delta + 360.0) % 360.0
            } else if max_c == g {
                60.0 * (b - r) / delta + 120.0
            } else {
                60.0 * (r - g) / delta + 240.0
            };
            let idx = ((bucket / 30.0) as usize) % 12;
            hue_buckets[idx] += 1;
        }
    }

    let non_zero_hues = hue_buckets.iter().filter(|&&c| c > 0).count() as f64;
    let hue_variety = (non_zero_hues / 12.0).min(1.0);

    // Score: prefers moderate-high saturation with variation
    // Pure grayscale gets 0.3 baseline; colorful + varied gets higher
    let sat_score = (median_sat * 0.7 + sat_std * 1.5).min(1.0);
    (sat_score * 0.6 + hue_variety * 0.4).max(0.2).min(1.0)
}

/// Rule-of-thirds composition score.
/// Checks whether high-detail regions align with thirds grid intersections.
/// Returns 0–1, higher = better composition.
fn composition_score(gray: &image::GrayImage) -> f64 {
    let (w, h) = gray.dimensions();
    if w < 20 || h < 20 {
        return 0.5;
    }

    // Build a lightweight edge map (Sobel-like horizontal + vertical)
    let edge_map = build_edge_map(gray);

    // Thirds grid intersections (4 points)
    let tx = [w / 3, 2 * w / 3];
    let ty = [h / 3, 2 * h / 3];
    let intersections = [(tx[0], ty[0]), (tx[1], ty[0]), (tx[0], ty[1]), (tx[1], ty[1])];

    // Radius around each intersection to check
    let radius = (w.min(h) / 8) as u32;

    let mut intersection_energy = 0.0_f64;
    let total_energy = edge_map.iter().sum::<f64>();

    for (cx, cy) in &intersections {
        let sx = (*cx as i32 - radius as i32).max(0) as u32;
        let ex = (*cx + radius).min(w - 1);
        let sy = (*cy as i32 - radius as i32).max(0) as u32;
        let ey = (*cy + radius).min(h - 1);

        for py in sy..=ey {
            let row = (py * w) as usize;
            for px in sx..=ex {
                intersection_energy += edge_map[row + px as usize] * 0.8_f64;
            }
        }
    }

    // Also penalize dead-center concentration (center square gets lower weight)
    let center_margin = 0.25;
    let cx0 = (w as f64 * center_margin) as u32;
    let cx1 = (w as f64 * (1.0 - center_margin)) as u32;
    let cy0 = (h as f64 * center_margin) as u32;
    let cy1 = (h as f64 * (1.0 - center_margin)) as u32;
    let mut center_energy = 0.0_f64;
    for py in cy0..=cy1 {
        let row = (py * w) as usize;
        for px in cx0..=cx1 {
            center_energy += edge_map[row + px as usize];
        }
    }

    // Good composition: energy at thirds points, not dead center
    let thirds_ratio = intersection_energy / (total_energy + 1e-6);
    let center_ratio = center_energy / (total_energy + 1e-6);

    // Optimal: ~20% energy near thirds, <30% at center
    let thirds_score = 1.0 - (thirds_ratio - 0.2).abs() / 0.2;
    let center_penalty = (center_ratio / 0.35).min(1.0);

    let score = thirds_score * 0.7 + (1.0 - center_penalty) * 0.3;
    score.max(0.0).min(1.0)
}

/// Build a lightweight edge magnitude map (simplified Sobel).
fn build_edge_map(gray: &image::GrayImage) -> Vec<f64> {
    let (w, h) = gray.dimensions();
    let mut edges = vec![0.0_f64; (w * h) as usize];

    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let tl = gray.get_pixel(x - 1, y - 1).0[0] as f64;
            let tc = gray.get_pixel(x, y - 1).0[0] as f64;
            let tr = gray.get_pixel(x + 1, y - 1).0[0] as f64;
            let ml = gray.get_pixel(x - 1, y).0[0] as f64;
            let mr = gray.get_pixel(x + 1, y).0[0] as f64;
            let bl = gray.get_pixel(x - 1, y + 1).0[0] as f64;
            let bc = gray.get_pixel(x, y + 1).0[0] as f64;
            let br = gray.get_pixel(x + 1, y + 1).0[0] as f64;

            let gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
            let gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
            edges[(y * w + x) as usize] = (gx * gx + gy * gy).sqrt();
        }
    }

    edges
}
