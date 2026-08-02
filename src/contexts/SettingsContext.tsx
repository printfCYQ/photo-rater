import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setScoringWeights, type ScoringWeights } from "../api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FontSize = "sm" | "md" | "lg";
export type AccentPreset = "teal" | "blue" | "purple" | "rose" | "amber" | "emerald";

export interface Settings {
  fontSize: FontSize;
  accentColor: AccentPreset;
  scoringWeights: ScoringWeights;
}

interface SettingsContextValue {
  settings: Settings;
  setFontSize: (size: FontSize) => void;
  setAccentColor: (color: AccentPreset) => void;
  setScoringWeights: (weights: ScoringWeights) => void;
}

// ---------------------------------------------------------------------------
// Preset data — HSL hue/saturation per accent (lightness auto-generated)
// ---------------------------------------------------------------------------
const ACCENT_PRESETS: Record<AccentPreset, { h: number; s: number }> = {
  teal:    { h: 189, s: 80 },
  blue:    { h: 217, s: 91 },
  purple:  { h: 271, s: 91 },
  rose:    { h: 347, s: 77 },
  amber:   { h: 38,  s: 92 },
  emerald: { h: 160, s: 84 },
};

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
};

const STORAGE_KEY = "photo-rater-settings";

const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  sharpness: 0.28,
  color: 0.30,
  composition: 0.27,
  exposure: 0.15,
  noise_penalty: 0.35,
  ai_weight: 0.5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fontSize: parsed.fontSize ?? "md",
        accentColor: parsed.accentColor ?? "teal",
        scoringWeights: {
          ...DEFAULT_SCORING_WEIGHTS,
          ...(parsed.scoringWeights ?? {}),
        },
      };
    }
  } catch { /* ignore corrupt data */ }
  return { fontSize: "md", accentColor: "teal", scoringWeights: DEFAULT_SCORING_WEIGHTS };
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function buildAccentScale(h: number, s: number) {
  // Lightness scale based on typical Tailwind color ramp
  const scale: Record<string, string> = {};
  const steps: [string, number][] = [
    ["50", 94], ["100", 88], ["200", 78], ["300", 62],
    ["400", 48], ["500", 40], ["600", 32], ["700", 24],
    ["800", 18], ["900", 14], ["950", 8],
  ];
  for (const [key, l] of steps) {
    scale[key] = `${h} ${s}% ${l}%`;
  }
  return scale;
}

function applyAccentToDOM(preset: AccentPreset) {
  const { h, s } = ACCENT_PRESETS[preset];
  const scale = buildAccentScale(h, s);
  const root = document.documentElement;

  root.style.setProperty("--accent", scale["600"]);
  root.style.setProperty("--accent-light", scale["500"]);
  root.style.setProperty("--accent-muted", `${h} ${s}% 35% / 0.15`);
  root.style.setProperty("--accent-glow", `${h} ${s}% 35% / 0.28`);
  for (const key of Object.keys(scale)) {
    root.style.setProperty(`--accent-${key}`, scale[key]);
  }
}

function applyFontSizeToDOM(size: FontSize) {
  document.documentElement.style.setProperty("--font-size-base", FONT_SIZE_MAP[size]);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Apply on mount + sync scoring weights to Rust backend
  useEffect(() => {
    applyAccentToDOM(settings.accentColor);
    applyFontSizeToDOM(settings.fontSize);
    // Push initial weights to Rust backend
    setScoringWeights(settings.scoringWeights).catch(() => {
      // Non-critical: Rust will use defaults if this fails
    });
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setSettings((prev) => {
      const next = { ...prev, fontSize: size };
      saveSettings(next);
      applyFontSizeToDOM(size);
      return next;
    });
  }, []);

  const setAccentColor = useCallback((color: AccentPreset) => {
    setSettings((prev) => {
      const next = { ...prev, accentColor: color };
      saveSettings(next);
      applyAccentToDOM(color);
      return next;
    });
  }, []);

  const updateScoringWeights = useCallback((weights: ScoringWeights) => {
    setSettings((prev) => {
      const next = { ...prev, scoringWeights: weights };
      saveSettings(next);
      return next;
    });
    // Sync to Rust backend (fire-and-forget)
    setScoringWeights(weights).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, setFontSize, setAccentColor, setScoringWeights: updateScoringWeights }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
