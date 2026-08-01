/**
 * Mock implementation of @tauri-apps/api/event
 */

export type UnlistenFn = () => void;

export async function listen(
  _event: string,
  _handler: (event: { payload: unknown }) => void
): Promise<UnlistenFn> {
  // Return a no-op unlisten function
  return () => {};
}

export async function emit(_event: string, _payload?: unknown): Promise<void> {
  // No-op
}

export async function once(_event: string, _handler: (event: { payload: unknown }) => void): Promise<UnlistenFn> {
  return () => {};
}
