use crate::image_proc::HeuristicSignals;
use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, RwLock};

/// Configurable scoring weights.
/// All weights are 0.0–1.0 and will be normalized to sum to 1.0 internally.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringWeights {
    /// Sharpness weight (clarity: laplacian + FFT blend)
    pub sharpness: f64,
    /// Color harmony weight
    pub color: f64,
    /// Composition (rule of thirds) weight
    pub composition: f64,
    /// Exposure weight
    pub exposure: f64,
    /// Noise penalty strength (0 = no penalty, 1 = full penalty)
    pub noise_penalty: f64,
}

impl Default for ScoringWeights {
    fn default() -> Self {
        Self {
            sharpness: 0.28,
            color: 0.30,
            composition: 0.27,
            exposure: 0.15,
            noise_penalty: 0.35,
        }
    }
}

/// Global scoring weights — mutable at runtime via Tauri command.
static SCORING_WEIGHTS: LazyLock<RwLock<ScoringWeights>> =
    LazyLock::new(|| RwLock::new(ScoringWeights::default()));

/// Get the current scoring weights (clone).
pub fn get_weights() -> ScoringWeights {
    SCORING_WEIGHTS.read().unwrap().clone()
}

/// Update the global scoring weights.
pub fn set_weights(w: ScoringWeights) {
    let mut guard = SCORING_WEIGHTS.write().unwrap();
    *guard = w;
}

/// Calculate composite score from AI score and heuristic signals.
///
/// Uses the globally configured `ScoringWeights`.
///
/// **Without AI model:**
/// ```text
/// sharpness = max(laplacian_norm, fft_norm) * 0.7 + min(laplacian_norm, fft_norm) * 0.3
/// noise_factor = 1.0 - noise_level * noise_penalty_weight
/// composite = (sharpness * w_sharp + exposure * w_exposure + color * w_color + composition * w_composition)
///           * noise_factor * 10.0
/// ```
///
/// **With AI model (future):**
/// ```text
/// composite = (ai * 0.50 + sharpness * 0.13 + exposure * 0.07 + color * 0.15 + composition * 0.10)
///           * noise_factor * 10.0 + (1.0 - noise_level) * 0.05
/// ```
pub fn calculate_composite_score(
    ai_score: Option<f64>,
    signals: &HeuristicSignals,
) -> Option<f64> {
    let w = get_weights();

    // Normalize each signal to 0–1 range
    let laplacian_norm = normalize_laplacian(signals.blur_score);
    let fft_norm = signals.fft_clarity; // already 0–1
    let exposure_norm = normalize_exposure(signals.exposure);
    let noise_level = signals.noise_level; // already 0–1
    let color_harmony = signals.color_harmony; // already 0–1
    let composition = signals.composition; // already 0–1

    // Sharpness: blend both clarity metrics — both agree = bonus, disagree = conservative
    let sharpness = if laplacian_norm > fft_norm {
        laplacian_norm * 0.7 + fft_norm * 0.3
    } else {
        laplacian_norm * 0.3 + fft_norm * 0.7
    };

    // Noise penalty: high noise reduces score
    let noise_factor = 1.0 - noise_level * w.noise_penalty;

    // Normalize weights to sum to 1.0
    let weight_sum = w.sharpness + w.color + w.composition + w.exposure;
    let ws = if weight_sum > 0.0 { weight_sum } else { 1.0 };

    if let Some(ai) = ai_score {
        // With AI: fixed blend (AI 50% + heuristics 50%)
        let ai_norm = (ai / 10.0).clamp(0.0, 1.0);
        let weighted = ai_norm * 0.50
            + sharpness * (w.sharpness / ws) * 0.13
            + exposure_norm * (w.exposure / ws) * 0.07
            + color_harmony * (w.color / ws) * 0.15
            + composition * (w.composition / ws) * 0.10
            + (1.0 - noise_level) * 0.05;
        Some((weighted * noise_factor).clamp(0.0, 1.0) * 10.0)
    } else {
        // Without AI: heuristics only, using configured weights
        let weighted = sharpness * (w.sharpness / ws)
            + exposure_norm * (w.exposure / ws)
            + color_harmony * (w.color / ws)
            + composition * (w.composition / ws);
        Some((weighted * noise_factor).clamp(0.0, 1.0) * 10.0)
    }
}

/// Normalize Laplacian variance to 0–1.
/// Typical range: <50 (very blurry) to 2000+ (extremely sharp).
/// Use log-scale for better distribution.
fn normalize_laplacian(variance: f64) -> f64 {
    if variance <= 0.0 {
        return 0.0;
    }
    // ln(50)≈3.9, ln(2000)≈7.6, so map 3.9→0.2 and 7.6→0.9
    let log_v = variance.ln();
    ((log_v - 3.5) / 4.5).clamp(0.0, 1.0)
}

/// Normalize exposure to 0–1.
/// Optimal at 128 (mid-gray), penalty for extremes.
fn normalize_exposure(brightness: f64) -> f64 {
    if brightness < 20.0 || brightness > 245.0 {
        0.15 // severely under/over exposed
    } else if brightness < 50.0 || brightness > 220.0 {
        0.40 // moderately bad
    } else {
        // Gaussian-like peak centered at 128
        let diff = (brightness - 128.0).abs() / 128.0;
        1.0 - diff * 0.55
    }
}
