/**
 * Mock implementation of @tauri-apps/plugin-dialog
 * Simulates folder picker dialogs.
 */

export interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  // Simulate a folder picker — return a fake path
  if (options?.directory) {
    // Return a mock directory path
    const dirs = [
      "/Users/demo/Photos/New_Shoot_001",
      "/Users/demo/Pictures/Vacation_2025",
      "/Users/demo/Desktop/Test_Album",
    ];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }
  return null;
}

export async function save(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
  return options?.defaultPath || "/Users/demo/Desktop/export.zip";
}

export async function message(_message: string, _options?: { title?: string }): Promise<void> {
  alert(_message);
}

export async function ask(_message: string, _options?: { title?: string }): Promise<boolean> {
  return confirm(_message);
}

export async function confirm(_message: string, _options?: { title?: string }): Promise<boolean> {
  return window.confirm(_message);
}
