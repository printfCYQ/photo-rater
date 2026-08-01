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
  useEffect(() => {
    if (photos.length === 0) return;

    const uncachedPaths: string[] = [];
    for (const p of photos) {
      if (!thumbUrlCache.has(p.path)) {
        uncachedPaths.push(p.path);
      }
    }

    if (uncachedPaths.length === 0) return;

    let cancelled = false;

    getCachedThumbnailUrls(uncachedPaths, thumbSize)
      .then((cachedMap) => {
        if (cancelled) return;
        for (const [path, url] of cachedMap) {
          thumbUrlCache.set(path, url);
        }
        setBatchVersion((v) => v + 1);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [photos, thumbSize]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-base overflow-hidden">
        <div className="spinner" />
        <p className="text-sm text-base-500 font-medium">扫描照片中...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-base overflow-hidden">
        <div className="w-[72px] h-[72px] rounded-xl bg-surface-alt border border-base-800/60 flex items-center justify-center text-base-500 mb-1">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="text-[15px] text-base-400 font-medium">暂无照片</p>
        <p className="text-xs text-base-500">点击左侧「导入照片文件夹」开始</p>
      </div>
    );
  }

  // batchVersion is used to trigger re-render when batch cache loads
  void batchVersion;

  return (
    <div className="flex-1 bg-base overflow-hidden">
      <div className="h-full overflow-y-auto p-3.5 custom-scrollbar">
        <div className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gridAutoRows: "260px",
          }}
        >
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

  // Intersection Observer
  useEffect(() => {
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

  // Periodically check if batch preload populated the cache
  useEffect(() => {
    if (thumb) return;

    const cached = thumbUrlCache.get(photo.path);
    if (cached) {
      setThumb(cached);
      setLoaded(true);
      return;
    }

    if (!visible) return;

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

  const isKeep = photo.status === "keep";
  const isReject = photo.status === "reject";
  const hasScore = photo.composite_score !== null;

  return (
    <div
      className={`group relative w-full h-full rounded-lg overflow-hidden cursor-pointer
        bg-surface-alt border transition-all duration-200 ease-out
        ${isKeep
          ? 'border-keep shadow-[0_0_0_1px] shadow-keep/30'
          : isReject
            ? 'border-reject/20 opacity-45 hover:opacity-70'
            : 'border-base-800/60 hover:border-base-600/60'
        }
        ${!isReject ? 'hover:-translate-y-[3px] hover:shadow-card-hover' : ''}
      `}
      ref={cellRef}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="w-full h-full bg-surface-overlay flex items-center justify-center overflow-hidden relative">
        {!loaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-overlay to-surface-alt animate-pulse-soft" />
        )}
        {thumb && (
          <img
            src={thumb}
            alt={photo.file_name}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-[400ms] ease-out
              ${!isReject ? 'group-hover:scale-[1.06]' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>

      {/* Bottom Overlay — visible on hover or when scored */}
      <div className={`absolute bottom-0 left-0 right-0 px-2.5 py-2
        flex items-center justify-between gap-2
        bg-gradient-to-t from-black/85 to-transparent
        transition-opacity duration-200
        ${hasScore || isKeep || isReject ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
      `}>
        <span className="text-[11px] font-medium text-white/90 truncate max-w-[140px]">
          {photo.file_name}
        </span>
        {hasScore && (
          <span className="text-[13px] font-bold text-warning-light bg-black/60 backdrop-blur-sm
            px-2 py-0.5 rounded-sm flex-shrink-0 tabular-nums">
            {photo.composite_score!.toFixed(1)}
          </span>
        )}
      </div>

      {/* Action buttons — top right, visible on hover */}
      <div className="absolute top-2 right-2 flex gap-1.5
        opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center
            bg-black/60 backdrop-blur-lg border border-white/10 text-white text-sm
            transition-all duration-150 hover:scale-110
            ${isKeep
              ? 'bg-keep border-keep-light shadow-[0_2px_8px] shadow-keep/30'
              : 'hover:bg-keep hover:border-keep-light hover:shadow-[0_2px_8px] hover:shadow-keep/30'
            }`}
          onClick={(e) => {
            e.stopPropagation();
            onRate(photo, photo.user_rating ?? 3, "keep");
          }}
          title="保留"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center
            bg-black/60 backdrop-blur-lg border border-white/10 text-white text-sm
            transition-all duration-150 hover:scale-110
            ${isReject
              ? 'bg-reject border-reject-light shadow-[0_2px_8px] shadow-reject/30'
              : 'hover:bg-reject hover:border-reject-light hover:shadow-[0_2px_8px] hover:shadow-reject/30'
            }`}
          onClick={(e) => {
            e.stopPropagation();
            onRate(photo, -1, "reject");
          }}
          title="淘汰"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* User rating stars — top left */}
      {photo.user_rating !== null && photo.user_rating > 0 && (
        <div className="absolute top-2 left-2 text-[13px] text-warning tracking-[1px] pointer-events-none"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
          {"★".repeat(photo.user_rating)}
          <span className="text-white/15">
            {"★".repeat(5 - photo.user_rating)}
          </span>
        </div>
      )}
    </div>
  );
});

export { thumbUrlCache };
export const PhotoGrid = memo(PhotoGridInner);
