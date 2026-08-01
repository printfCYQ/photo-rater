use crate::image_proc::HeuristicSignals;

/// Calculate composite score from AI score and heuristic signals.
///
/// **Current formula (no AI model):**
/// ```
/// sharpness = max(laplacian_norm, fft_norm) * 0.7 + min(laplacian_norm, fft_norm) * 0.3
/// noise_factor = 1.0 - noise_level * 0.35
/// composite = (sharpness * 0.28 + exposure * 0.15 + color_harmony * 0.30 + composition * 0.27)
///           * noise_factor * 10.0
/// ```
///
/// **Future formula (with AI model):**
/// ```
/// composite = (ai * 0.50 + sharpness * 0.13 + exposure * 0.07 + color_harmony * 0.15 + composition * 0.10)
///           * noise_factor * 10.0 + noise_model_bonus * 0.05
/// ```
pub fn calculate_composite_score(
    ai_score: Option<f64>,
    signals: &HeuristicSignals,
) -> Option<f64> {
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
    let noise_factor = 1.0 - noise_level * 0.35;

    if let Some(ai) = ai_score {
        // With AI: weighted blend
        let ai_norm = (ai / 10.0).clamp(0.0, 1.0);
        let weighted = ai_norm * 0.50
            + sharpness * 0.13
            + exposure_norm * 0.07
            + color_harmony * 0.15
            + composition * 0.10
            + (1.0 - noise_level) * 0.05;
        Some((weighted * noise_factor).clamp(0.0, 1.0) * 10.0)
    } else {
        // Without AI: heuristics only
        let weighted = sharpness * 0.28
            + exposure_norm * 0.15
            + color_harmony * 0.30
            + composition * 0.27;
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
