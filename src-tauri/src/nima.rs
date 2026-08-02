//! NIMA (Neural Image Assessment) ONNX model inference.
//!
//! Uses a MobileNet-based NIMA model to predict aesthetic quality scores
//! on a 1-10 scale. The model takes a 224×224 RGB image (NHWC, normalized
//! to [-1, 1]) and outputs 10 logits which are softmaxed to a probability
//! distribution. The final score is the expected value: Σ (i+1) × p_i.

use image::imageops::FilterType;
use ndarray::Array4;
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

/// Global NIMA session — loaded once at startup, shared across calls.
/// `Mutex` is needed because `Session::run()` requires `&mut self`.
static NIMA_SESSION: OnceLock<Mutex<Session>> = OnceLock::new();

/// Initialize the NIMA session from a model file.
/// Called once during app startup. Subsequent calls are no-ops.
pub fn init_session(model_path: &Path) -> Result<(), String> {
    if NIMA_SESSION.get().is_some() {
        return Ok(());
    }

    log::info!("Loading NIMA model from: {:?}", model_path);

    let session = Session::builder()
        .map_err(|e| format!("Session builder error: {e}"))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| format!("Optimization level error: {e}"))?
        .with_intra_threads(4)
        .map_err(|e| format!("Thread config error: {e}"))?
        .commit_from_file(model_path)
        .map_err(|e| format!("Failed to load NIMA model: {e}"))?;

    NIMA_SESSION
        .set(Mutex::new(session))
        .map_err(|_| "NIMA session already initialized".to_string())?;

    log::info!("NIMA model loaded successfully");
    Ok(())
}

/// Check if the NIMA model is loaded and ready for inference.
pub fn is_loaded() -> bool {
    NIMA_SESSION.get().is_some()
}

/// Score a single image using the NIMA model.
///
/// Returns a score in the range [1.0, 10.0].
/// Returns `Err` if the model is not loaded or inference fails.
pub fn score_image(path: &str) -> Result<f64, String> {
    let cell = NIMA_SESSION.get().ok_or("NIMA model not loaded")?;

    // 1. Decode image + resize to 224×224
    let img = image::open(path)
        .map_err(|e| format!("Failed to open image: {e}"))?
        .resize_exact(224, 224, FilterType::Triangle)
        .to_rgb8();

    // 2. Preprocess: NHWC [1, 224, 224, 3], normalize to [-1, 1]
    //    MobileNet preprocessing: pixel / 127.5 - 1.0
    let input = Array4::from_shape_fn((1, 224, 224, 3), |(_, h, w, c)| {
        let pixel = img.get_pixel(w as u32, h as u32)[c] as f32;
        pixel / 127.5 - 1.0
    });

    // 3. Run inference (requires &mut self → lock the mutex)
    let mut session = cell
        .lock()
        .map_err(|e| format!("Session lock poisoned: {e}"))?;

    // Create ONNX tensor from ndarray
    let tensor = Tensor::from_array(input)
        .map_err(|e| format!("Failed to create input tensor: {e}"))?;

    let outputs = session
        .run(ort::inputs!["keras_tensor" => tensor])
        .map_err(|e| format!("NIMA inference failed: {e}"))?;

    // 4. Extract output tensor [1, 10]
    let output_tensor = outputs
        .get("output_0")
        .ok_or("NIMA model produced no output")?;

    let (_, logits) = output_tensor
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract NIMA output: {e}"))?;

    // 5. Softmax + expected value
    let raw: Vec<f32> = logits.to_vec();
    let score = softmax_expected_value(&raw);

    Ok(score)
}

/// Convert 10 raw logits to a softmax probability distribution,
/// then compute the expected value: Σ (i+1) × p_i for i = 0..10.
///
/// This gives a score in [1.0, 10.0].
fn softmax_expected_value(logits: &[f32]) -> f64 {
    if logits.is_empty() {
        return 5.0; // neutral fallback
    }

    // Numerically stable softmax
    let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exp_vals: Vec<f32> = logits.iter().map(|&l| (l - max_logit).exp()).collect();
    let sum: f32 = exp_vals.iter().sum();

    if sum <= 0.0 {
        return 5.0;
    }

    let probs: Vec<f32> = exp_vals.iter().map(|&e| e / sum).collect();

    // Expected value: score = Σ (rating × probability), rating = 1..=10
    let expected: f32 = probs
        .iter()
        .enumerate()
        .map(|(i, &p)| p * (i as f32 + 1.0))
        .sum();

    expected as f64
}
