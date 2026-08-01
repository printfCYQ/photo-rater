import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => confirmBtnRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 w-[380px] max-w-[90vw] bg-surface-overlay rounded-xl border border-base-700/50 shadow-2xl shadow-black/40 animate-scale-in p-6">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
            variant === "danger"
              ? "bg-reject/10 text-reject"
              : "bg-accent/10 text-accent"
          }`}
        >
          {variant === "danger" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>

        {/* Content */}
        <h3 className="text-[15px] font-semibold text-base-50 mb-1.5">{title}</h3>
        <p className="text-[13px] text-base-400 leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button
            className="h-9 px-4 rounded-md text-[13px] font-medium text-base-300
              hover:text-base-100 hover:bg-surface-alt transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-base-600/50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            className={`h-9 px-4 rounded-md text-[13px] font-semibold transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-overlay
              ${
                variant === "danger"
                  ? "bg-reject text-white hover:bg-reject/90 focus:ring-reject/50 shadow-sm shadow-reject/20"
                  : "bg-accent text-white hover:bg-accent/90 focus:ring-accent/50 shadow-sm shadow-accent/20"
              }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
