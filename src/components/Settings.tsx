import { useState, useEffect } from "react";
import type { AccentPreset, FontSize } from "../contexts/SettingsContext";
import { useSettings } from "../contexts/SettingsContext";
import { getNimaStatus, type ScoringWeights } from "../api";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const FONT_OPTIONS: { key: FontSize; label: string; desc: string }[] = [
  { key: "sm", label: "小", desc: "14px" },
  { key: "md", label: "中", desc: "16px" },
  { key: "lg", label: "大", desc: "18px" },
];

const COLOR_PRESETS: { key: AccentPreset; label: string; hex: string }[] = [
  { key: "teal",    label: "青",   hex: "#06b6d4" },
  { key: "blue",    label: "蓝",   hex: "#3b82f6" },
  { key: "purple",  label: "紫",   hex: "#a855f7" },
  { key: "rose",    label: "玫红", hex: "#f43f5e" },
  { key: "amber",   label: "琥珀", hex: "#f59e0b" },
  { key: "emerald", label: "翠绿", hex: "#10b981" },
];

const DEFAULT_WEIGHTS: ScoringWeights = {
  sharpness: 0.28,
  color: 0.30,
  composition: 0.27,
  exposure: 0.15,
  noise_penalty: 0.35,
  ai_weight: 0.5,
};

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  description: string;
  /** Display percentage shown on the right. Defaults to raw value × 100. */
  displayPct?: number;
}

function WeightSlider({ label, value, onChange, color, description, displayPct }: WeightSliderProps) {
  const pct = displayPct != null ? displayPct : Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
          <span className="text-[13px] font-medium text-base-100">{label}</span>
        </div>
        <span className="text-[12px] font-bold tabular-nums text-base-300">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full weight-slider"
        style={{ accentColor: color }}
      />
      <p className="text-[11px] text-base-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export function Settings({ open, onClose }: SettingsProps) {
  const { settings, setFontSize, setAccentColor, setScoringWeights } = useSettings();
  const w = settings.scoringWeights;
  const [nimaLoaded, setNimaLoaded] = useState(false);

  // Check NIMA status when panel opens
  useEffect(() => {
    if (open) {
      getNimaStatus().then(setNimaLoaded).catch(() => setNimaLoaded(false));
    }
  }, [open]);

  if (!open) return null;

  const updateWeight = (key: keyof ScoringWeights, val: number) => {
    setScoringWeights({ ...w, [key]: val });
  };

  const resetWeights = () => setScoringWeights({ ...DEFAULT_WEIGHTS });

  // Compute normalized percentages for display
  const sum = w.sharpness + w.color + w.composition + w.exposure;
  const norm = (v: number) => sum > 0 ? Math.round((v / sum) * 100) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-[210] flex items-center justify-center pointer-events-none">
        <div className="relative w-[420px] max-w-[92vw] max-h-[85vh] overflow-y-auto custom-scrollbar animate-scale-in pointer-events-auto">
        <div className="bg-surface border border-base-700/60 rounded-2xl shadow-overlay overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-base-800/40 sticky top-0 bg-surface z-10">
            <h2 className="text-[15px] font-semibold text-base-100">设置</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center
                text-base-400 hover:bg-surface-raised hover:text-base-200 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* ---- Font Size ---- */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[1.5px] text-base-500 mb-3">
                字体大小
              </h3>
              <div className="flex gap-2">
                {FONT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFontSize(opt.key)}
                    className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium
                      transition-all duration-150 border
                      ${settings.fontSize === opt.key
                        ? "bg-accent-muted border-accent/50 text-accent-light"
                        : "bg-surface-alt border-base-700/60 text-base-300 hover:border-base-600 hover:text-base-200"
                      }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[11px] opacity-60 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* ---- Accent Color ---- */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[1.5px] text-base-500 mb-3">
                主题色
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setAccentColor(c.key)}
                    title={c.label}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl transition-all duration-200
                        ${settings.accentColor === c.key
                          ? "ring-2 ring-offset-2 ring-offset-surface scale-110"
                          : "hover:scale-105"
                        }`}
                      style={{ background: c.hex }}
                    />
                    <span className={`text-[11px] transition-colors
                      ${settings.accentColor === c.key ? "text-accent-light" : "text-base-500 group-hover:text-base-400"}`}
                    >
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* ---- Scoring Weights ---- */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[1.5px] text-base-500">
                  评分权重
                </h3>
                <button
                  onClick={resetWeights}
                  className="text-[11px] text-base-500 hover:text-accent-light transition-colors"
                >
                  恢复默认
                </button>
              </div>

              <div className="space-y-4 p-3.5 rounded-lg bg-surface-alt border border-base-700/40">
                <WeightSlider
                  label="清晰度"
                  value={w.sharpness}
                  onChange={(v) => updateWeight("sharpness", v)}
                  color="var(--accent)"
                  description="Laplacian + FFT 频域分析"
                  displayPct={norm(w.sharpness)}
                />
                <WeightSlider
                  label="色彩和谐"
                  value={w.color}
                  onChange={(v) => updateWeight("color", v)}
                  color="#10b981"
                  description="饱和度 + 色相多样性"
                  displayPct={norm(w.color)}
                />
                <WeightSlider
                  label="构图"
                  value={w.composition}
                  onChange={(v) => updateWeight("composition", v)}
                  color="#a855f7"
                  description="三分法对齐检测"
                  displayPct={norm(w.composition)}
                />
                <WeightSlider
                  label="曝光"
                  value={w.exposure}
                  onChange={(v) => updateWeight("exposure", v)}
                  color="#f59e0b"
                  description="亮度偏离检测"
                  displayPct={norm(w.exposure)}
                />
                <WeightSlider
                  label="噪点惩罚"
                  value={w.noise_penalty}
                  onChange={(v) => updateWeight("noise_penalty", v)}
                  color="#ef4444"
                  description="高噪点总分扣减倍率，0 = 不惩罚，1 = 最大惩罚"
                />
              </div>

              {/* AI Weight — only shown when NIMA is loaded */}
              {nimaLoaded && (
                <div className="space-y-4 p-3.5 rounded-lg bg-accent-muted/30 border border-accent/15 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[12px] font-semibold text-emerald-400">NIMA AI 模型已加载</span>
                  </div>
                  <WeightSlider
                    label="AI 评分权重"
                    value={w.ai_weight}
                    onChange={(v) => updateWeight("ai_weight", v)}
                    color="#22d3ee"
                    description={`AI 与启发式的混合比例：AI ${Math.round(w.ai_weight * 100)}% + 启发式 ${Math.round((1 - w.ai_weight) * 100)}%`}
                  />
                </div>
              )}

              {!nimaLoaded && (
                <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-surface-alt border border-base-700/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-base-500" />
                  <span className="text-[11px] text-base-500">
                    NIMA AI 模型未加载，当前使用纯启发式评分
                  </span>
                </div>
              )}

              <p className="text-[11px] text-base-500 mt-2 leading-relaxed">
                四项主权重自动归一化，右侧显示实际占比。修改后需重新「批量评分」生效。
              </p>
            </section>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
