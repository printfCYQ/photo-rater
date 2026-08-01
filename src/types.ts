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
  face_count: number | null;
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
  sort_by: string;
  sort_desc: boolean;
  limit?: number | null;
  offset?: number | null;
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
