/// Calculate composite score from AI score and heuristic signals.
/// Weights: ai=0.7, blur=0.2, exposure=0.1 (configurable in future).
pub fn calculate_composite_score(
    ai_score: Option<f64>,
    blur_score: Option<f64>,
    exposure: Option<f64>,
) -> Option<f64> {
    let w_ai = 0.7;
    let w_blur = 0.2;
    let w_exposure = 0.1;

    let mut total_weight = 0.0;
    let mut weighted_sum = 0.0;

    if let Some(ai) = ai_score {
        // AI score is 0-10, normalize to 0-1
        weighted_sum += w_ai * (ai / 10.0);
        total_weight += w_ai;
    }

    if let Some(blur) = blur_score {
        // Blur score (Laplacian variance) - normalize: higher is sharper
        // Typical range: 0-1000+, map log-scale to 0-1
        let blur_norm = (blur.ln() / 8.0).min(1.0).max(0.0);
        weighted_sum += w_blur * blur_norm;
        total_weight += w_blur;
    }

    if let Some(exp) = exposure {
        // Exposure: ideal is around 128 (mid-gray)
        // Penalty for too dark (<40) or too bright (>220)
        let exp_norm = if exp < 40.0 || exp > 220.0 {
            0.3
        } else {
            // Bell curve peaking at 128
            let diff = (exp - 128.0).abs() / 128.0;
            1.0 - diff * 0.5
        };
        weighted_sum += w_exposure * exp_norm;
        total_weight += w_exposure;
    }

    if total_weight > 0.0 {
        // Scale back to 0-10 range
        Some((weighted_sum / total_weight) * 10.0)
    } else {
        None
    }
}
