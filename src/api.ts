import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  Album,
  AiScore,
  ExportResult,
  LocationGroup,
  Photo,
  PhotoFilter,
  PhotoGroup,
  PhotoStats,
  ScanResult,
  TimeNode,
} from "./types";

export async function scanDirectory(
  dir: string,
  albumName: string
): Promise<ScanResult> {
  return invoke<ScanResult>("scan_directory", { dir, albumName });
}

/// Get thumbnail: Rust generates (or fetches from disk cache) and returns a file path.
/// We convert it to a webview-loadable URL via convertFileSrc.
export async function getThumbnailUrl(path: string, size: number): Promise<string> {
  const filePath = await invoke<string>("get_thumbnail", { path, size });
  return convertFileSrc(filePath);
}

/// Batch get thumbnails: returns a map of (originalPath -> webviewUrl).
export async function batchGetThumbnailUrls(
  paths: string[],
  size: number
): Promise<Map<string, string>> {
  const pairs = await invoke<[string, string][]>("batch_get_thumbnails", { paths, size });
  const map = new Map<string, string>();
  for (const [origPath, cachePath] of pairs) {
    map.set(origPath, convertFileSrc(cachePath));
  }
  return map;
}

/// Batch check disk cache for thumbnails without generating new ones.
/// Returns a Map of (originalPath -> webviewUrl) for cached ones only.
/// Fast: single IPC call, parallel file stat on Rust side, no image decoding.
export async function getCachedThumbnailUrls(
  paths: string[],
  size: number
): Promise<Map<string, string>> {
  const pairs = await invoke<[string, string | null][]>(
    "get_cached_thumbnail_paths",
    { paths, size }
  );
  const map = new Map<string, string>();
  for (const [origPath, cachePath] of pairs) {
    if (cachePath) {
      map.set(origPath, convertFileSrc(cachePath));
    }
  }
  return map;
}

/// Get a large preview image URL for the lightbox.
export async function getPreviewImageUrl(
  path: string,
  maxWidth: number
): Promise<string> {
  const filePath = await invoke<string>("get_preview_image", { path, maxWidth });
  return convertFileSrc(filePath);
}

/// Convert an original file path to a webview-loadable URL (for direct image loading).
export function getFileUrl(path: string): string {
  return convertFileSrc(path);
}

export async function listPhotos(filter: PhotoFilter): Promise<Photo[]> {
  return invoke<Photo[]>("list_photos", { filter });
}

export async function listAlbums(): Promise<Album[]> {
  return invoke<Album[]>("list_albums");
}

export async function ratePhoto(
  path: string,
  rating: number | null,
  status: string
): Promise<boolean> {
  return invoke<boolean>("rate_photo", { path, rating, status });
}

export async function scorePhotoAi(path: string): Promise<AiScore> {
  return invoke<AiScore>("score_photo_ai", { path });
}

export async function batchScoreAi(paths: string[]): Promise<AiScore[]> {
  return invoke<AiScore[]>("batch_score_ai", { paths });
}

export async function exportSelection(
  paths: string[],
  dest: string,
  mode: string
): Promise<ExportResult> {
  return invoke<ExportResult>("export_selection", { paths, dest, mode });
}

export async function getStats(albumId?: number | null): Promise<PhotoStats> {
  return invoke<PhotoStats>("get_stats", { albumId: albumId ?? null });
}

export async function deleteAlbum(albumId: number, clearCache: boolean = false): Promise<boolean> {
  return invoke<boolean>("delete_album", { albumId, clearCache });
}

/// Clear all thumbnail cache (disk + memory).
export async function clearAllCache(): Promise<number> {
  return invoke<number>("clear_all_cache");
}

/// Get the current scoring weights from Rust backend.
export async function getScoringWeights(): Promise<ScoringWeights> {
  return invoke<ScoringWeights>("get_scoring_weights");
}

/// Update scoring weights on the Rust backend.
export async function setScoringWeights(weights: ScoringWeights): Promise<ScoringWeights> {
  return invoke<ScoringWeights>("set_scoring_weights", { weights });
}

export interface ScoringWeights {
  sharpness: number;
  color: number;
  composition: number;
  exposure: number;
  noise_penalty: number;
  ai_weight: number;
}

/// Check if the NIMA AI model is loaded.
export async function getNimaStatus(): Promise<boolean> {
  return invoke<boolean>("get_nima_status");
}

/// Re-read EXIF camera metadata for an album's photos. Returns count updated.
export async function rescanMetadata(albumId: number): Promise<number> {
  return invoke<number>("rescan_album_metadata", { albumId });
}

/// Build the year → month → day time tree for an album.
export async function getTimeTree(albumId: number): Promise<TimeNode[]> {
  return invoke<TimeNode[]>("get_time_tree", { albumId });
}

/// Cluster an album's photos by GPS location (offline).
export async function getLocationGroups(albumId: number): Promise<LocationGroup[]> {
  return invoke<LocationGroup[]>("get_location_groups", { albumId });
}

/// Find near-duplicate / similar photo groups via perceptual hash.
export async function getSimilarGroups(
  albumId: number,
  threshold?: number
): Promise<PhotoGroup[]> {
  return invoke<PhotoGroup[]>("get_similar_groups", { albumId, threshold: threshold ?? null });
}

// Event listeners
export function onScanComplete(
  callback: (payload: { album_id: number; total: number }) => void
): Promise<UnlistenFn> {
  return listen("scan-complete", (event) => {
    callback(event.payload as { album_id: number; total: number });
  });
}

/// Import progress events emitted by the async `scan_directory` command.
/// `stage` is one of "scanning" | "saving" | "done".
export function onScanProgress(
  callback: (payload: { stage: string; current: number; total: number }) => void
): Promise<UnlistenFn> {
  return listen("scan-progress", (event) => {
    callback(event.payload as { stage: string; current: number; total: number });
  });
}

export function onBatchScoreProgress(
  callback: (payload: { current: number; total: number }) => void
): Promise<UnlistenFn> {
  return listen("batch-score-progress", (event) => {
    callback(event.payload as { current: number; total: number });
  });
}
