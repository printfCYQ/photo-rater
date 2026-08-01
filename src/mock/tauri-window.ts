/**
 * Mock implementation of @tauri-apps/api/window
 * Simulates window controls for browser dev mode
 */

interface Unlisten {
  (): void;
}

export interface MockWindow {
  isFullscreen(): Promise<boolean>;
  isMaximized(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  toggleMaximize(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  setTitle(title: string): Promise<void>;
  onResized(cb: () => void): Promise<Unlisten>;
}

const windowState = {
  fullscreen: false,
  maximized: false,
  title: "Photo Rater",
};

const listeners = new Set<() => void>();

function notifyResize() {
  listeners.forEach((cb) => cb());
}

// Listen for browser fullscreen changes
if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", () => {
    windowState.fullscreen = !!document.fullscreenElement;
    notifyResize();
  });
  // Also listen for window resize
  window.addEventListener("resize", notifyResize);
}

export function getCurrentWindow(): MockWindow {
  return {
    async isFullscreen() {
      return windowState.fullscreen;
    },
    async isMaximized() {
      return windowState.maximized;
    },
    async setFullscreen(fullscreen: boolean) {
      windowState.fullscreen = fullscreen;
      try {
        if (fullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen?.();
        } else if (!fullscreen && document.fullscreenElement) {
          await document.exitFullscreen?.();
        }
      } catch {
        // Ignore — some browsers block programmatic fullscreen
      }
    },
    async toggleMaximize() {
      windowState.maximized = !windowState.maximized;
      notifyResize();
    },
    async minimize() {
      // No-op in browser
    },
    async close() {
      // No-op in browser
    },
    async setTitle(title: string) {
      windowState.title = title;
      document.title = title;
    },
    async onResized(cb: () => void): Promise<Unlisten> {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

export const getCurrentWebview = getCurrentWindow;

export function getAllWindows(): MockWindow[] {
  return [getCurrentWindow()];
}
