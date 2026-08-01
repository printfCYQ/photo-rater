import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function Titlebar() {
  const appWindow = getCurrentWindow();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    appWindow.isFullscreen().then(setFullscreen);
    const unlisten = appWindow.onResized(() => {
      appWindow.isFullscreen().then(setFullscreen);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleClose = () => appWindow.close();
  const handleMinimize = () => appWindow.minimize();
  const handleToggleFullscreen = () => appWindow.setFullscreen(!fullscreen);

  // macOS standard: double-click titlebar to maximize/restore
  const handleDoubleClick = () => {
    appWindow.toggleMaximize();
  };

  // Hide custom titlebar during macOS native fullscreen — system provides its own
  if (fullscreen) return null;

  return (
    <div
      data-tauri-drag-region
      className="h-[38px] flex items-center flex-shrink-0 relative z-50
        bg-surface/95 backdrop-blur-xl border-b border-base-800/40 select-none"
      onDoubleClick={handleDoubleClick}
    >
      {/* Left: macOS traffic lights — button clicks consume mousedown, preventing drag */}
      <div className="flex items-center gap-2 pl-3 h-full">
        <button
          onClick={handleClose}
          className="traffic-light traffic-light-close"
          aria-label="关闭窗口"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" className="traffic-light-icon" style={{ pointerEvents: "none" }}>
            <line x1="1" y1="1" x2="5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={handleMinimize}
          className="traffic-light traffic-light-minimize"
          aria-label="最小化"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" className="traffic-light-icon" style={{ pointerEvents: "none" }}>
            <line x1="1.5" y1="3" x2="4.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={handleToggleFullscreen}
          className="traffic-light traffic-light-maximize"
          aria-label={fullscreen ? "退出全屏" : "全屏"}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" className="traffic-light-icon" style={{ pointerEvents: "none" }}>
            {fullscreen ? (
              <>
                <rect x="0.8" y="2" width="3" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="2.2" y="0.8" width="3" height="3" rx="0.5" fill="var(--traffic-bg, #28CA41)" stroke="currentColor" strokeWidth="1.2" />
              </>
            ) : (
              <rect x="1.5" y="1.5" width="3" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            )}
          </svg>
        </button>
      </div>

      {/* Center: app title */}
      <div className="flex-1 h-full flex items-center justify-center pointer-events-none">
        <span className="text-xs font-semibold text-base-400 tracking-[0.3px]">
          Photo Rater
        </span>
      </div>

      {/* Right: spacer — same width as traffic lights area for symmetry */}
      <div className="w-[82px] h-full" />
    </div>
  );
}
