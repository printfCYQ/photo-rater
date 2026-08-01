import React, { memo, useEffect, useState, useCallback, useMemo, forwardRef, useRef } from "react";
import { VirtuosoGrid, type VirtuosoGridHandle } from "react-virtuoso";
import type { Photo } from "../types";
import { batchGetThumbnailUrls } from "../api";

interface PhotoGridProps {
  photos: Photo[];
  loading: boolean;
  onRate: (photo: Photo, rating: number | null, status: string) => void;
  onPhotoClick: (index: number) => void;
  thumbSize: number;
  /** Current sidebar width in px, 0 if collapsed. Defaults to 260. */
  sidebarWidth?: number;
  /** Enable keyboard navigation (disable when Lightbox is open). */
  keyboardEnabled?: boolean;
}

// Shared cache: photo.path -> thumbnail URL
const thumbUrlCache = new Map<string, string>();

const GRID_GAP = 12;
const GRID_PADDING = 14;
const ITEM_MIN_WIDTH = 240;
const ITEM_HEIGHT = 260;

function calcGridColumns(viewportWidth: number, sidebarWidth: number): number {
  const gridWidth = viewportWidth - sidebarWidth;
  const avail = gridWidth - GRID_PADDING * 2;
  return Math.max(1, Math.floor((avail + GRID_GAP) / (ITEM_MIN_WIDTH + GRID_GAP)));
}

function PhotoGridInner({
  photos,
  loading,
  onRate,
  onPhotoClick,
  thumbSize,
  sidebarWidth = 260,
  keyboardEnabled = true,
}: PhotoGridProps) {
  const [batchVersion, setBatchVersion] = useState(0);
  const [columns, setColumns] = useState(() => calcGridColumns(window.innerWidth, sidebarWidth));
  const [focusIndex, setFocusIndex] = useState(-1);
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);

  // Recalculate columns on window resize or sidebar collapse toggle.
  useEffect(() => {
    const onResize = () => setColumns(calcGridColumns(window.innerWidth, sidebarWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarWidth]);

  // Batch-generate all thumbnails in a single parallel IPC call,
  // so cells never need to fire individual getThumbnailUrl calls.
  useEffect(() => {
    if (photos.length === 0) return;

    const uncachedPaths: string[] = [];
    for (const p of photos) {
      if (!thumbUrlCache.has(p.path)) {
        uncachedPaths.push(p.path);
      }
    }

    if (uncachedPaths.length === 0) {
      console.log(`[perf] batchThumbs: all ${photos.length} thumbnails cached, skipping IPC`);
      return;
    }

    let cancelled = false;
    const label = `[perf] batchThumbs IPC (${uncachedPaths.length} images, size=${thumbSize})`;
    console.time(label);

    batchGetThumbnailUrls(uncachedPaths, thumbSize)
      .then((urlMap) => {
        if (cancelled) return;
        console.timeEnd(label);
        console.log(`[perf] batchThumbs returned ${urlMap.size} URLs`);
        for (const [path, url] of urlMap) {
          thumbUrlCache.set(path, url);
        }
        setBatchVersion((v) => v + 1);
      })
      .catch((e) => {
        console.timeEnd(label);
        console.error("[perf] batchThumbs failed:", e);
      });

    return () => {
      cancelled = true;
    };
  }, [photos, thumbSize]);

  // Grid components — use fixed column count so Virtuoso can predict row count.
  // Recreated only when columns changes (user resizes window).
  const gridComponents = useMemo(
    () => ({
      List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        function GridList({ style, children, ...props }, ref) {
          return (
            <div
              ref={ref}
              {...props}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: `${GRID_GAP}px`,
                paddingTop: `${GRID_PADDING}px`,
                paddingRight: `${GRID_PADDING}px`,
                paddingBottom: `${GRID_PADDING}px`,
                paddingLeft: `${GRID_PADDING}px`,
                ...style,
              }}
            >
              {children}
            </div>
          );
        }
      ),
      Item: ({ children, ...props }: any) => (
        <div
          {...props}
          style={{
            height: `${ITEM_HEIGHT}px`,
          }}
        >
          {children}
        </div>
      ),
    }),
    [columns]
  );

  // Keyboard navigation in grid view
  useEffect(() => {
    if (!keyboardEnabled || photos.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Initialize focus if not set
      const cur = focusIndex < 0 ? 0 : focusIndex;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (cur > 0) {
            const next = cur - 1;
            setFocusIndex(next);
            virtuosoRef.current?.scrollToIndex({ index: next });
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (cur < photos.length - 1) {
            const next = cur + 1;
            setFocusIndex(next);
            virtuosoRef.current?.scrollToIndex({ index: next });
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (cur >= columns) {
            const next = cur - columns;
            setFocusIndex(next);
            virtuosoRef.current?.scrollToIndex({ index: next });
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (cur < photos.length - columns) {
            const next = cur + columns;
            setFocusIndex(next);
            virtuosoRef.current?.scrollToIndex({ index: next });
          }
          break;
        case "Enter":
          e.preventDefault();
          if (cur >= 0 && cur < photos.length) {
            onPhotoClick(cur);
          }
          break;
        case " ":
          e.preventDefault();
          if (cur >= 0 && cur < photos.length) {
            const p = photos[cur];
            onRate(p, p.user_rating ?? 3, "keep");
          }
          break;
        case "x":
        case "X":
          if (cur >= 0 && cur < photos.length) {
            onRate(photos[cur], -1, "reject");
          }
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          if (cur >= 0 && cur < photos.length) {
            onRate(photos[cur], parseInt(e.key), "keep");
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboardEnabled, photos, focusIndex, columns, onPhotoClick, onRate]);

  const itemContent = useCallback(
    (index: number) => (
      <VirtualPhotoCell
        photo={photos[index]}
        index={index}
        focused={index === focusIndex}
        onRate={onRate}
        onClick={() => {
          setFocusIndex(index);
          onPhotoClick(index);
        }}
        cacheVersion={batchVersion}
      />
    ),
    [photos, onRate, onPhotoClick, batchVersion, focusIndex]
  );

  const computeItemKey = useCallback(
    (index: number) => photos[index]?.path ?? index,
    [photos]
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-base">
        <div className="spinner" />
        <p className="text-sm text-base-500 font-medium">扫描照片中...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-base">
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

  return (
    <div className="flex-1 bg-base">
      <VirtuosoGrid
        ref={virtuosoRef}
        key={columns}
        className="h-full custom-scrollbar"
          totalCount={photos.length}
          itemContent={itemContent}
          components={gridComponents}
          computeItemKey={computeItemKey}
          overscan={300}
        />
    </div>
  );
}

// ─── Virtual PhotoCell ───

interface VirtualPhotoCellProps {
  photo: Photo;
  index: number;
  focused: boolean;
  onRate: (photo: Photo, rating: number | null, status: string) => void;
  onClick: () => void;
  cacheVersion: number;
}

const VirtualPhotoCell = memo(function VirtualPhotoCell({
  photo,
  index: _index,
  focused,
  onRate,
  onClick,
  cacheVersion,
}: VirtualPhotoCellProps) {
  const [thumb, setThumb] = useState<string>(
    () => thumbUrlCache.get(photo.path) || ""
  );
  const [loaded, setLoaded] = useState(!!thumb);

  // Re-check thumb cache when batch preload updates the cache.
  useEffect(() => {
    const cached = thumbUrlCache.get(photo.path);
    if (cached && cached !== thumb) {
      setThumb(cached);
    }
  }, [photo.path, thumb, cacheVersion]);

  useEffect(() => {
    if (thumb && !loaded) {
      setLoaded(true);
    }
  }, [thumb, loaded]);

  const isKeep = photo.status === "keep";
  const isReject = photo.status === "reject";
  const hasScore = photo.composite_score !== null;

  return (
    <div
      className={`group relative w-full h-full rounded-lg overflow-hidden cursor-pointer
        bg-surface-alt border transition-all duration-200 ease-out
        ${focused
          ? 'border-accent ring-2 ring-accent/40 shadow-[0_0_12px] shadow-accent/20'
          : isKeep
            ? 'border-keep shadow-[0_0_0_1px] shadow-keep/30'
            : isReject
              ? 'border-reject/20 opacity-45 hover:opacity-70'
              : 'border-base-800/60 hover:border-base-600/60'
        }
        ${!isReject && !focused ? 'hover:-translate-y-[3px] hover:shadow-card-hover' : ''}
      `}
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
            className={`w-full h-full object-cover transition-transform duration-[400ms] ease-out
              ${!isReject ? 'group-hover:scale-[1.06]' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>

      {/* Bottom Overlay */}
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

      {/* Action buttons */}
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

      {/* User rating stars */}
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
