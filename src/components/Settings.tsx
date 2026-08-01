import type { AccentPreset, FontSize } from "../contexts/SettingsContext";
import { useSettings } from "../contexts/SettingsContext";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export function Settings({ open, onClose }: SettingsProps) {
  const { settings, setFontSize, setAccentColor } = useSettings();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 z-[210] -translate-x-1/2 -translate-y-1/2
        w-[380px] max-w-[92vw] animate-scale-in">
        <div className="bg-surface border border-base-700/60 rounded-2xl shadow-overlay overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-base-800/40">
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
          </div>
        </div>
      </div>
    </>
  );
}
