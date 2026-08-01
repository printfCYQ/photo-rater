import { memo, useEffect, useRef, useState } from "react";
import type { Photo } from "../types";
import { getThumbnailUrl, getCachedThumbnailUrls } from "../api";

interface PhotoGridProps {
  photos: Photo[];
  loading: boolean;
  onRate: (photo: Photo, rating: number | null, status: string) => void;
  onPhotoClick: (index: number) => void;
  thumbSize: number;
}

// Shared cache: photo.path -> thumbnail URL (avoids redundant IPC calls)
const thumbUrlCache = new Map<string, string>();

function PhotoGridInner({
  photos,
  loading,
  onRate,
  onPhotoClick,
  thumbSize,
}: PhotoGridProps) {
  const [batchVersion, setBatchVersion] = useState(0);

  // Batch-preload cached thumbnails when photo list changes.
  // This is the key optimization: ONE IPC call for all photos instead of N.
  useEffect(() => {
    if (photos.length === 0) return;

    // Collect paths that aren't already in the frontend cache
    const uncachedPaths: string[] = [];
    for (const p of photos) {
      if (!thumbUrlCache.has(p.path)) {
        uncachedPaths.push(p.path);
      }
    }

    if (uncachedPaths.length === 0) return;

    let cancelled = false;

    // Single IPC call — Rust checks disk cache in parallel (rayon).
    // Returns only the ones that are already cached on disk.
    getCachedThumbnailUrls(uncachedPaths, thumbSize)
      .then((cachedMap) => {
        if (cancelled) return;
        // Merge results into the shared cache.
        // PhotoCell components will pick these up on re-render.
        for (const [path, url] of cachedMap) {
          thumbUrlCache.set(path, url);
        }
        // Force a re-render so PhotoCells pick up the new cache entries
        setBatchVersion((v) => v + 1);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [photos, thumbSize]);

  if (loading) {
    return (
      <div className="photo-grid-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="photo-grid-container">
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <p>暂无照片</p>
          <p className="empty-hint">点击左侧"导入照片文件夹"开始</p>
        </div>
      </div>
    );
  }

  // batchVersion is used to trigger re-render when batch cache loads
  void batchVersion;

  return (
    <div className="photo-grid-container">
      <div className="photo-grid-scroll">
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <PhotoCell
              key={photo.path}
              photo={photo}
              onRate={onRate}
              onClick={() => onPhotoClick(index)}
              thumbSize={thumbSize}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PhotoCellProps {
  photo: Photo;
  onRate: (photo: Photo, rating: number | null, status: string) => void;
  onClick: () => void;
  thumbSize: number;
}

const PhotoCell = memo(function PhotoCell({
  photo,
  onRate,
  onClick,
  thumbSize,
}: PhotoCellProps) {
  const [thumb, setThumb] = useState<string>(
    () => thumbUrlCache.get(photo.path) || ""
  );
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  // Intersection Observer — only load thumbnail when cell is near viewport
  useEffect(() => {
    // If already cached (from batch preload), show immediately
    const cached = thumbUrlCache.get(photo.path);
    if (cached) {
      setThumb(cached);
      setLoaded(true);
      setVisible(true);
      return;
    }

    const el = cellRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [photo.path]);

  // Periodically check if the batch preload has populated the cache
  // for this photo. This handles the case where the batch IPC call
  // completes after the component has mounted.
  useEffect(() => {
    if (thumb) return; // Already have a URL

    const cached = thumbUrlCache.get(photo.path);
    if (cached) {
      setThumb(cached);
      setLoaded(true);
      return;
    }

    // If not cached and not visible yet, wait.
    if (!visible) return;

    // Not cached, visible — generate thumbnail individually
    let cancelled = false;
    setLoaded(false);

    getThumbnailUrl(photo.path, thumbSize).then((url) => {
      if (!cancelled) {
        thumbUrlCache.set(photo.path, url);
        setThumb(url);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [visible, photo.path, thumbSize, thumb]);

  const statusClass =
    photo.status === "keep"
      ? "keep"
      : photo.status === "reject"
      ? "reject"
      : "";

  return (
    <div
      className={`photo-card ${statusClass}`}
      onClick={onClick}
      ref={cellRef}
    >
      <div className="photo-thumb">
        {!loaded && <div className="thumb-placeholder" />}
        {thumb && (
          <img
            src={thumb}
            alt={photo.file_name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>
      <div className="photo-overlay">
        <div className="photo-name" title={photo.file_name}>
          {photo.file_name}
        </div>
        {photo.composite_score !== null && (
          <div className="photo-score">
            {photo.composite_score.toFixed(1)}
          </div>
        )}
      </div>
      <div className="photo-actions">
        <button
          className={`action-btn keep ${photo.status === "keep" ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onRate(photo, photo.user_rating ?? 3, "keep");
          }}
          title="保留"
        >
          ✓
        </button>
        <button
          className={`action-btn reject ${photo.status === "reject" ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onRate(photo, -1, "reject");
          }}
          title="淘汰"
        >
          ✕
        </button>
      </div>
      {photo.user_rating !== null && photo.user_rating > 0 && (
        <div className="user-rating">
          {"★".repeat(photo.user_rating)}
          <span className="user-rating-empty">
            {"★".repeat(5 - photo.user_rating)}
          </span>
        </div>
      )}
    </div>
  );
});

export { thumbUrlCache };
export const PhotoGrid = memo(PhotoGridInner);
