/**
 * Mock implementation of @tauri-apps/api/core
 * Intercepts `invoke` calls and returns mock data based on command name.
 * `convertFileSrc` maps mock paths to Lorem Picsum URLs.
 */
import {
  computeStats,
  mockAlbums,
  mockPhotosByAlbum,
  mockPathToThumbUrl,
  mockPathToUrl,
  mockScan,
} from "./mock-data";
import type {
  AiScore,
  Album,
  ExportResult,
  Photo,
  PhotoFilter,
  PhotoStats,
  ScanResult,
} from "../types";

// ── convertFileSrc ───────────────────────────────────────

export function convertFileSrc(path: string): string {
  // If it's already a URL (http/https), return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // If it's a mock photo path, return full-size image
  if (path.startsWith("/mock/photos/")) {
    return mockPathToUrl(path, 1920, 1280);
  }
  // Fallback: return as-is (might be a data URL or other)
  return path;
}

// ── invoke ───────────────────────────────────────────────

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Simulate small network delay for realism
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  switch (command) {
    case "list_albums":
      return [...mockAlbums] as unknown as T;

    case "list_photos": {
      const filter = (args?.filter ?? {}) as PhotoFilter;
      let photos: Photo[] = filter.album_id
        ? [...(mockPhotosByAlbum[filter.album_id] ?? [])]
        : Object.values(mockPhotosByAlbum).flat();

      // Filter by status
      if (filter.status && filter.status !== "all") {
        photos = photos.filter((p) => p.status === filter.status);
      }

      // Sort
      const sortBy = filter.sort_by || "composite_score";
      const desc = filter.sort_desc !== false;
      photos.sort((a, b) => {
        let av: number | string | null = a[sortBy as keyof Photo] as number | string | null;
        let bv: number | string | null = b[sortBy as keyof Photo] as number | string | null;
        if (av === null) av = -Infinity;
        if (bv === null) bv = -Infinity;
        if (typeof av === "string" && typeof bv === "string") {
          return desc ? bv.localeCompare(av) : av.localeCompare(bv);
        }
        return desc ? (bv as number) - (av as number) : (av as number) - (bv as number);
      });

      // Limit/offset
      if (filter.offset) photos = photos.slice(filter.offset);
      if (filter.limit) photos = photos.slice(0, filter.limit);

      return photos as unknown as T;
    }

    case "get_stats": {
      const albumId = (args?.albumId ?? null) as number | null;
      return computeStats(albumId) as unknown as T;
    }

    case "get_thumbnail": {
      const path = args?.path as string;
      const size = (args?.size as number) || 400;
      return mockPathToThumbUrl(path, size) as unknown as T;
    }

    case "batch_get_thumbnails": {
      const paths = args?.paths as string[];
      const size = (args?.size as number) || 400;
      const pairs = paths.map((p) => [p, mockPathToThumbUrl(p, size)] as [string, string]);
      return pairs as unknown as T;
    }

    case "get_cached_thumbnail_paths": {
      const paths = args?.paths as string[];
      const size = (args?.size as number) || 400;
      // Return all as "cached" — single batch response
      const pairs = paths.map((p) => [p, mockPathToThumbUrl(p, size)] as [string, string]);
      return pairs as unknown as T;
    }

    case "get_preview_image": {
      const path = args?.path as string;
      return mockPathToUrl(path, 1920, 1280) as unknown as T;
    }

    case "rate_photo": {
      const path = args?.path as string;
      const rating = args?.rating as number | null;
      const status = args?.status as string;
      // Update mock data
      for (const photos of Object.values(mockPhotosByAlbum)) {
        const photo = photos.find((p) => p.path === path);
        if (photo) {
          photo.user_rating = rating && rating > 0 ? rating : null;
          photo.status = status as Photo["status"];
          photo.rated_at = Date.now();
          break;
        }
      }
      return true as unknown as T;
    }

    case "score_photo_ai": {
      const path = args?.path as string;
      let photo: Photo | undefined;
      for (const photos of Object.values(mockPhotosByAlbum)) {
        photo = photos.find((p) => p.path === path);
        if (photo) break;
      }
      if (!photo) {
        return { path, ai_score: null, blur_score: null, exposure: null, composite_score: null, error: "Photo not found" } as unknown as T;
      }
      // Re-use existing or generate
      const aiScore = photo.ai_score ?? 5 + Math.random() * 4;
      const blurScore = photo.blur_score ?? 300 + Math.random() * 500;
      const exposure = photo.exposure ?? 90 + Math.random() * 50;
      const composite = aiScore * 0.7 + (blurScore / 100) * 0.2 + (exposure / 100) * 0.1;
      photo.ai_score = Math.round(aiScore * 10) / 10;
      photo.blur_score = Math.round(blurScore * 10) / 10;
      photo.exposure = Math.round(exposure);
      photo.composite_score = Math.round(composite * 10) / 10;
      photo.scored_at = Date.now();
      return {
        path,
        ai_score: photo.ai_score,
        blur_score: photo.blur_score,
        exposure: photo.exposure,
        composite_score: photo.composite_score,
        error: null,
      } as unknown as T;
    }

    case "batch_score_ai": {
      const paths = args?.paths as string[];
      const results: AiScore[] = [];
      for (const path of paths) {
        let photo: Photo | undefined;
        for (const photos of Object.values(mockPhotosByAlbum)) {
          photo = photos.find((p) => p.path === path);
          if (photo) break;
        }
        if (photo && photo.ai_score === null) {
          const aiScore = 4 + Math.random() * 5;
          const blurScore = 200 + Math.random() * 600;
          const exposure = 80 + Math.random() * 60;
          const composite = aiScore * 0.7 + (blurScore / 100) * 0.2 + (exposure / 100) * 0.1;
          photo.ai_score = Math.round(aiScore * 10) / 10;
          photo.blur_score = Math.round(blurScore * 10) / 10;
          photo.exposure = Math.round(exposure);
          photo.composite_score = Math.round(composite * 10) / 10;
          photo.scored_at = Date.now();
        }
        if (photo) {
          results.push({
            path,
            ai_score: photo.ai_score,
            blur_score: photo.blur_score,
            exposure: photo.exposure,
            composite_score: photo.composite_score,
            error: null,
          });
        }
      }
      return results as unknown as T;
    }

    case "scan_directory": {
      const dir = args?.dir as string;
      const albumName = args?.albumName as string;
      return mockScan(dir, albumName) as unknown as T;
    }

    case "export_selection": {
      const paths = args?.paths as string[];
      const result: ExportResult = {
        success_count: paths.length,
        failed_count: 0,
        errors: [],
      };
      return result as unknown as T;
    }

    case "delete_album": {
      const albumId = args?.albumId as number;
      const idx = mockAlbums.findIndex((a) => a.id === albumId);
      if (idx >= 0) mockAlbums.splice(idx, 1);
      delete mockPhotosByAlbum[albumId];
      return true as unknown as T;
    }

    default:
      console.warn(`[mock-invoke] Unknown command: ${command}`, args);
      return undefined as unknown as T;
  }
}

// Re-export types for compatibility
export type { Album, Photo, PhotoStats, ScanResult };
