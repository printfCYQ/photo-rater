import type { Album, Photo, PhotoStats, ScanResult } from "../types";

// ── Helpers ──────────────────────────────────────────────

let idCounter = 1000;
const nextId = () => ++idCounter;

const VARIATIONS = [
  { w: 4000, h: 2667, size: 8_200_000 },
  { w: 3840, h: 2160, size: 6_800_000 },
  { w: 6000, h: 4000, size: 12_500_000 },
  { w: 3456, h: 5184, size: 9_100_000 },
  { w: 4032, h: 3024, size: 7_400_000 },
  { w: 5184, h: 3456, size: 10_200_000 },
  { w: 4480, h: 6720, size: 11_800_000 },
  { w: 6000, h: 4000, size: 13_900_000 },
];

const LOCATIONS = [
  "Beach_Sunset", "Mountain_Hike", "City_Night", "Forest_Trail",
  "Desert_Dunes", "Lake_Reflection", "Street_Portrait", "Garden_Flowers",
  "Architecture", "Wildlife", "Snow_Scene", "Waterfall",
  "Cafe_Interior", "Festival_Crowd", "Harbor_Boats", "Cliff_Edge",
  "Autumn_Trees", "Spring_Blossom", "Urban_Graffiti", "Coastal_Rocks",
  "Temple_Shrine", "Night_Market", "Bridge_View", "Countryside",
];

function makePhoto(
  albumId: number,
  index: number,
  status: "pending" | "keep" | "reject" = "pending"
): Photo {
  const id = nextId();
  const v = VARIATIONS[index % VARIATIONS.length];
  const loc = LOCATIONS[index % LOCATIONS.length];
  const fileName = `IMG_${String(4000 + index).padStart(4, "0")}.JPG`;
  const seed = `${loc}_${index}`;

  // Scores — keep photos tend to score higher
  const baseScore = status === "keep" ? 6.5 + Math.random() * 3
    : status === "reject" ? 2 + Math.random() * 3
    : 4 + Math.random() * 5;

  const aiScore = Math.round(baseScore * 10) / 10;
  const blurScore = Math.round((status === "reject" ? 50 + Math.random() * 200 : 300 + Math.random() * 700) * 10) / 10;
  const exposure = Math.round(status === "reject" ? 40 + Math.random() * 40 : 90 + Math.random() * 60);
  const composite = Math.round(baseScore * 10) / 10;

  const userRating = status === "keep"
    ? (Math.random() > 0.4 ? Math.ceil(baseScore / 2) : null)
    : status === "reject" ? -1 : null;

  const daysAgo = Math.floor(Math.random() * 90);
  const takenAt = new Date(Date.now() - daysAgo * 86400_000).toISOString();

  return {
    id,
    path: `/mock/photos/${seed}/${fileName}`,
    file_name: fileName,
    dir: `/mock/photos/${seed}`,
    file_size: v.size + Math.floor(Math.random() * 2_000_000),
    width: v.w,
    height: v.h,
    taken_at: takenAt,
    ai_score: aiScore,
    blur_score: blurScore,
    exposure,
    fft_clarity: null,
    noise_level: null,
    color_harmony: null,
    composition: null,
    face_count: Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0,
    lat: null,
    lon: null,
    camera_make: "Canon",
    camera_model: "EOS R6",
    lens: "RF 24-70mm F2.8 L IS USM",
    aperture: 2.8,
    shutter_speed: 1 / 200,
    iso: 400,
    focal_length: 50,
    exposure_bias: Math.round((Math.random() * 2 - 1) * 10) / 10,
    phash: null,
    composite_score: composite,
    user_rating: userRating && userRating > 0 ? userRating : null,
    status,
    scored_at: status !== "pending" ? Date.now() - Math.floor(Math.random() * 86400_000) : null,
    rated_at: status !== "pending" ? Date.now() - Math.floor(Math.random() * 86400_000) : null,
    created_at: Date.now() - daysAgo * 86400_000,
    album_id: albumId,
  };
}

// ── Albums ───────────────────────────────────────────────

const album1Photos: Photo[] = [];
for (let i = 0; i < 24; i++) {
  const status = i < 6 ? "keep" : i < 10 ? "reject" : "pending";
  album1Photos.push(makePhoto(1, i, status));
}

const album2Photos: Photo[] = [];
for (let i = 0; i < 16; i++) {
  const status = i < 4 ? "keep" : i < 7 ? "reject" : "pending";
  album2Photos.push(makePhoto(2, i + 24, status));
}

const album3Photos: Photo[] = [];
for (let i = 0; i < 8; i++) {
  const status = i < 2 ? "keep" : i < 4 ? "reject" : "pending";
  album3Photos.push(makePhoto(3, i + 40, status));
}

export const mockAlbums: Album[] = [
  {
    id: 1,
    name: "Japan_Trip_2025",
    source_dir: "/Users/demo/Photos/Japan_Trip_2025",
    photo_count: album1Photos.length,
    created_at: Date.now() - 30 * 86400_000,
    updated_at: Date.now() - 2 * 86400_000,
  },
  {
    id: 2,
    name: "Wedding_Shoot",
    source_dir: "/Users/demo/Photos/Wedding_Shoot",
    photo_count: album2Photos.length,
    created_at: Date.now() - 15 * 86400_000,
    updated_at: Date.now() - 5 * 86400_000,
  },
  {
    id: 3,
    name: "Weekend_Hike",
    source_dir: "/Users/demo/Photos/Weekend_Hike",
    photo_count: album3Photos.length,
    created_at: Date.now() - 7 * 86400_000,
    updated_at: Date.now() - 1 * 86400_000,
  },
];

export const mockPhotosByAlbum: Record<number, Photo[]> = {
  1: album1Photos,
  2: album2Photos,
  3: album3Photos,
};

// ── Stats ────────────────────────────────────────────────

export function computeStats(albumId: number | null): PhotoStats {
  const photos = albumId ? mockPhotosByAlbum[albumId] ?? [] : [];
  return {
    total: photos.length,
    scored: photos.filter((p) => p.ai_score !== null).length,
    rated: photos.filter((p) => p.user_rating !== null && p.user_rating > 0).length,
    kept: photos.filter((p) => p.status === "keep").length,
    rejected: photos.filter((p) => p.status === "reject").length,
  };
}

// ── Scan simulation ──────────────────────────────────────

export function mockScan(dir: string, albumName: string): ScanResult {
  const albumId = nextId();
  const count = 8 + Math.floor(Math.random() * 16);
  const photos: Photo[] = [];
  for (let i = 0; i < count; i++) {
    photos.push(makePhoto(albumId, i, "pending"));
  }

  const album: Album = {
    id: albumId,
    name: albumName,
    source_dir: dir,
    photo_count: count,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  mockAlbums.push(album);
  mockPhotosByAlbum[albumId] = photos;

  return {
    album_id: albumId,
    total: count,
    photos,
  };
}

// ── Image URL helper ─────────────────────────────────────

/**
 * Convert a mock file path to a Lorem Picsum URL.
 * Path format: /mock/photos/{seed}/{filename}
 * We extract the seed to generate a deterministic image.
 */
export function mockPathToUrl(path: string, width = 1920, height = 1280): string {
  // Extract seed from path: /mock/photos/{seed}/{filename}
  const match = path.match(/\/mock\/photos\/([^/]+)\//);
  const seed = match ? match[1] : path;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

export function mockPathToThumbUrl(path: string, size = 400): string {
  // Square-ish thumbnail
  return mockPathToUrl(path, size, Math.round(size * 0.75));
}
