/**
 * Mock implementation of @tauri-apps/api/window
 * Simulates window controls (fullscreen, etc.)
 */

export interface MockWindow {
  isFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  setTitle(title: string): Promise<void>;
  close(): Promise<void>;
}

const windowState = {
  fullscreen: false,
  title: "Photo Rater",
};

export function getCurrentWindow(): MockWindow {
  return {
    async isFullscreen() {
      return windowState.fullscreen;
    },
    async setFullscreen(fullscreen: boolean) {
      windowState.fullscreen = fullscreen;
      // Use browser fullscreen API as fallback
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
    async setTitle(title: string) {
      windowState.title = title;
      document.title = title;
    },
    async close() {
      // No-op in browser
    },
  };
}

export const getCurrentWebview = getCurrentWindow;

export function getAllWindows(): MockWindow[] {
  return [getCurrentWindow()];
}
