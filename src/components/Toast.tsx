export type ToastType = "success" | "error" | "warning";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const styleMap: Record<ToastType, { box: string; icon: string }> = {
  success: {
    box: "border-keep/30 bg-keep-muted",
    icon: "text-keep",
  },
  error: {
    box: "border-reject/30 bg-reject-muted",
    icon: "text-reject",
  },
  warning: {
    box: "border-warning/30 bg-warning-muted",
    icon: "text-warning",
  },
};

function ToastIcon({ type }: { type: ToastType }) {
  const cls = "text-current";
  if (type === "success") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cls} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cls} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cls} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => {
        const s = styleMap[t.type];
        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            className={`pointer-events-auto flex items-start gap-2.5 max-w-[360px] cursor-pointer
              rounded-lg border px-3.5 py-3 shadow-overlay backdrop-blur-sm
              animate-slide-up ${s.box}`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${s.icon}`}>
              <ToastIcon type={t.type} />
            </div>
            <span className="text-[13px] leading-relaxed text-base-100 whitespace-pre-line">
              {t.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
