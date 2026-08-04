export interface Photo {
  id: number | null;
  path: string;
  file_name: string;
  dir: string;
  file_size: number;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  ai_score: number | null;
  blur_score: number | null;
  exposure: number | null;
  fft_clarity: number | null;
  noise_level: number | null;
  color_harmony: number | null;
  composition: number | null;
  face_count: number | null;
  lat: number | null;
  lon: number | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  aperture: number | null;
  shutter_speed: number | null;
  iso: number | null;
  focal_length: number | null;
  exposure_bias: number | null;
  phash: string | null;
  composite_score: number | null;
  user_rating: number | null;
  status: "pending" | "keep" | "reject";
  scored_at: number | null;
  rated_at: number | null;
  created_at: number;
  album_id: number | null;
}

export interface Album {
  id: number | null;
  name: string;
  source_dir: string;
  photo_count: number;
  created_at: number;
  updated_at: number;
}

export interface PhotoFilter {
  album_id?: number | null;
  status?: string | null;
  min_score?: number | null;
  max_score?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  sort_by: string;
  sort_desc: boolean;
  limit?: number | null;
  offset?: number | null;
}

/// Time-browsing tree node (year / month / day).
export interface TimeNode {
  key: string;
  label: string;
  count: number;
  level: "year" | "month" | "day";
  from: string;
  to: string;
  children: TimeNode[];
}

/// A location cluster (photos taken at roughly the same place).
export interface LocationGroup {
  id: number;
  label: string;
  count: number;
  lat: number | null;
  lon: number | null;
  photos: Photo[];
}

/// A group of near-duplicate / similar photos.
export interface PhotoGroup {
  id: number;
  count: number;
  best_score: number | null;
  representative: Photo;
  photos: Photo[];
}

export interface ScanResult {
  album_id: number;
  total: number;
  photos: Photo[];
}

export interface AiScore {
  path: string;
  ai_score: number | null;
  blur_score: number | null;
  exposure: number | null;
  fft_clarity: number | null;
  noise_level: number | null;
  color_harmony: number | null;
  composition: number | null;
  composite_score: number | null;
  error: string | null;
}

export interface ExportResult {
  success_count: number;
  failed_count: number;
  errors: string[];
}

export interface PhotoStats {
  total: number;
  scored: number;
  rated: number;
  kept: number;
  rejected: number;
}
