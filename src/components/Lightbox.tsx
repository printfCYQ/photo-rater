import { useEffect, useState, useRef, useCallback } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import type { Photo } from "../types";
import { getFileUrl, getThumbnailUrl } from "../api";
import { thumbUrlCache } from "./PhotoGrid";

interface LightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onRate: (photo: Photo, rating: number | null, status: string) => void;
}

export function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  onRate,
}: LightboxProps) {
  const photo = photos[currentIndex];
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // Image loading state
  const [imgSrc, setImgSrc] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [triedPreview, setTriedPreview] = useState(false);

  // View state
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);

  // Filmstrip thumbnails
  const [filmstripUrls, setFilmstripUrls] = useState<Map<number, string>>(new Map());
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Load original image
  useEffect(() => {
    if (!photo) return;
    setImgLoaded(false);
    setImgError(false);
    setTriedPreview(false);
    setImgSrc(getFileUrl(photo.path));
  }, [photo?.path]);

  // Reset view state when switching photos
  useEffect(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoomLevel(100);
    transformRef.current?.resetTransform(0);
  }, [currentIndex]);

  // Preload adjacent images
  useEffect(() => {
    if (currentIndex < photos.length - 1) {
      const img = new Image();
      img.src = getFileUrl(photos[currentIndex + 1].path);
    }
    if (currentIndex > 0) {
      const img = new Image();
      img.src = getFileUrl(photos[currentIndex - 1].path);
    }
  }, [currentIndex, photos]);

  // Load filmstrip thumbnails
  useEffect(() => {
    const start = Math.max(0, currentIndex - 15);
    const end = Math.min(photos.length, currentIndex + 15);
    const newUrls = new Map(filmstripUrls);

    for (let i = start; i < end; i++) {
      if (!newUrls.has(i)) {
        const path = photos[i].path;
        if (thumbUrlCache.has(path)) {
          newUrls.set(i, thumbUrlCache.get(path)!);
        } else {
          getThumbnailUrl(path, 120).then((url) => {
            setFilmstripUrls((prev) => {
              const updated = new Map(prev);
              updated.set(i, url);
              return updated;
            });
          }).catch(() => {});
        }
      }
    }
    setFilmstripUrls(newUrls);
  }, [currentIndex, photos]);

  // Scroll filmstrip to current item
  useEffect(() => {
    const el = filmstripRef.current?.querySelector(
      `[data-index="${currentIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIndex]);

  // Handle image load error
  const handleImgError = useCallback(() => {
    if (!triedPreview && photo) {
      setTriedPreview(true);
      import("../api").then(({ getPreviewImageUrl }) => {
        getPreviewImageUrl(photo.path, 1920)
          .then((url) => {
            setImgSrc(url);
            setImgError(false);
          })
          .catch(() => setImgError(true));
      });
    } else {
      setImgError(true);
    }
  }, [triedPreview, photo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex > 0) onNavigate(currentIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case " ":
          e.preventDefault();
          if (photo) onRate(photo, photo.user_rating ?? 3, "keep");
          break;
        case "x":
        case "X":
          if (photo) onRate(photo, -1, "reject");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          if (photo) onRate(photo, parseInt(e.key), "keep");
          break;
        case "r":
        case "R":
          if (e.shiftKey) setRotation((r) => r - 90);
          else setRotation((r) => r + 90);
          break;
        case "h":
        case "H":
          setFlipH((v) => !v);
          break;
        case "v":
        case "V":
          setFlipV((v) => !v);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "t":
        case "T":
          setShowFilmstrip((v) => !v);
          break;
        case "+":
        case "=":
          transformRef.current?.zoomIn();
          break;
        case "-":
        case "_":
          transformRef.current?.zoomOut();
          break;
        case "0":
          setRotation(0);
          setFlipH(false);
          setFlipV(false);
          setZoomLevel(100);
          transformRef.current?.resetTransform(300, "easeOutCubic");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, photos.length, photo, onClose, onNavigate, onRate]);

  const toggleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
      setIsFullscreen(!fs);
    } catch {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    }
  };

  const imgTransform = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${
    flipV ? -1 : 1
  })`;

  const isKeep = photo?.status === "keep";
  const isReject = photo?.status === "reject";

  return (
    <div className="fixed inset-0 bg-black/94 backdrop-blur-md z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}>
      <div className="w-full h-full flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Top Bar */}
        <div className="flex items-center gap-3.5 px-4 py-2.5 bg-base/80 backdrop-blur-xl border-b border-base-800/40 flex-shrink-0">
          {/* Counter */}
          <span className="text-[13px] font-bold text-base-300 tabular-nums bg-surface-raised px-2.5 py-1 rounded-md border border-base-700/50 whitespace-nowrap">
            {currentIndex + 1} / {photos.length}
          </span>

          {/* Filename */}
          <span className="flex-1 text-[13px] font-medium text-base-400 truncate">
            {photo?.file_name}
          </span>

          {/* Zoom level */}
          <span className="text-xs text-base-500 min-w-[48px] text-right tabular-nums font-medium">
            {Math.round(zoomLevel)}%
          </span>

          {/* Toolbar actions */}
          <div className="flex items-center gap-0.5">
            {/* Zoom in */}
            <button className="lb-tool-btn" onClick={() => transformRef.current?.zoomIn()} title="放大 (+)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            {/* Zoom out */}
            <button className="lb-tool-btn" onClick={() => transformRef.current?.zoomOut()} title="缩小 (-)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            {/* Rotate CW */}
            <button className="lb-tool-btn" onClick={() => setRotation((r) => r + 90)} title="顺时针旋转 (R)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            {/* Rotate CCW */}
            <button className="lb-tool-btn" onClick={() => setRotation((r) => r - 90)} title="逆时针旋转 (Shift+R)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.12-9.36L1 10"/>
              </svg>
            </button>
            {/* Flip H */}
            <button className="lb-tool-btn" onClick={() => setFlipH((v) => !v)} title="水平翻转 (H)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M12 3v18M7 7l-4 5 4 5M17 7l4 5-4 5"/>
              </svg>
            </button>
            {/* Flip V */}
            <button className="lb-tool-btn" onClick={() => setFlipV((v) => !v)} title="垂直翻转 (V)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18M7 7l5-4 5 4M7 17l5 4 5-4"/>
              </svg>
            </button>

            <div className="w-px h-5 bg-base-700/60 mx-1.5 flex-shrink-0" />

            {/* Reset */}
            <button
              className="lb-tool-btn bg-surface-raised border border-base-700/50"
              onClick={() => {
                setRotation(0);
                setFlipH(false);
                setFlipV(false);
                setZoomLevel(100);
                transformRef.current?.resetTransform(300, "easeOutCubic");
              }}
              title="复位 (0)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/>
                <path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>

            {/* Fullscreen */}
            <button className="lb-tool-btn" onClick={toggleFullscreen} title="全屏 (F)">
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
              )}
            </button>

            {/* Filmstrip toggle */}
            <button className="lb-tool-btn" onClick={() => setShowFilmstrip((v) => !v)} title="缩略图条 (T)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <line x1="2" y1="15" x2="22" y2="15"/>
              </svg>
            </button>

            <div className="w-px h-5 bg-base-700/60 mx-1.5 flex-shrink-0" />

            {/* Close */}
            <button className="lb-tool-btn hover:bg-reject/10 hover:text-reject" onClick={onClose} title="关闭 (Esc)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Image Area */}
        <div className="flex-1 flex items-center justify-center lightbox-image-area overflow-hidden">
          {/* Prev button */}
          <button
            className="lb-nav-btn prev"
            onClick={() => currentIndex > 0 && onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {!imgLoaded && !imgError && (
              <div className="flex flex-col items-center gap-3">
                <div className="spinner" />
                <p className="text-sm text-base-500">加载中...</p>
              </div>
            )}
            {imgError ? (
              <div className="flex flex-col items-center gap-2 text-base-500 text-sm">
                <p>图片加载失败</p>
                <p className="text-xs text-base-600 max-w-[600px] break-all text-center px-4">
                  {photo?.path}
                </p>
              </div>
            ) : (
              imgSrc && (
                <TransformWrapper
                  ref={transformRef}
                  initialScale={1}
                  minScale={0.2}
                  maxScale={10}
                  doubleClick={{ mode: "zoomIn", step: 0.7 }}
                  wheel={{ step: 0.08 }}
                  pinch={{ step: 5 }}
                  limitToBounds={false}
                  panning={{ excluded: ["input", "textarea"] }}
                  onTransform={(_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
                    setZoomLevel((state.scale || 1) * 100);
                  }}
                >
                  <TransformComponent
                    wrapperClass="lightbox-zoom-wrapper"
                    contentClass="lightbox-zoom-content"
                    wrapperStyle={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    contentStyle={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={imgSrc}
                      alt={photo?.file_name || ""}
                      draggable={false}
                      onLoad={() => setImgLoaded(true)}
                      onError={handleImgError}
                      style={{
                        transform: imgTransform,
                        transition: "transform 0.15s ease-out",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "auto",
                        objectFit: "contain",
                        borderRadius: "6px",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                        userSelect: "none",
                      }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              )
            )}
          </div>

          {/* Next button */}
          <button
            className="lb-nav-btn next"
            onClick={() => currentIndex < photos.length - 1 && onNavigate(currentIndex + 1)}
            disabled={currentIndex === photos.length - 1}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Filmstrip */}
        {showFilmstrip && (
          <div className="flex gap-1 px-3 py-2 bg-black/40 overflow-x-auto custom-scrollbar flex-shrink-0 scroll-smooth"
            ref={filmstripRef}>
            {photos.map((p, i) => {
              const url = filmstripUrls.get(i);
              return (
                <div
                  key={p.path}
                  data-index={i}
                  className={`flex-shrink-0 w-[72px] h-[52px] rounded-sm overflow-hidden cursor-pointer
                    relative border-2 transition-all duration-150 bg-surface-overlay
                    ${i === currentIndex
                      ? 'border-accent shadow-[0_0_10px] shadow-accent/30'
                      : p.status === "keep"
                        ? 'border-keep'
                        : p.status === "reject"
                          ? 'border-reject/40 opacity-40'
                          : 'border-transparent hover:border-base-600/60'
                    }
                    ${i !== currentIndex && p.status !== "reject" ? 'hover:-translate-y-0.5' : ''}`}
                  onClick={() => onNavigate(i)}
                >
                  {url ? (
                    <img src={url} alt={p.file_name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-surface-overlay to-surface-alt animate-pulse-soft" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Bar */}
        <div className="px-5 py-3.5 bg-base/80 backdrop-blur-xl border-t border-base-800/40 flex flex-col gap-2.5 flex-shrink-0">
          {/* Scores row */}
          <div className="flex gap-2 flex-wrap">
            {photo?.composite_score !== null && photo?.composite_score !== undefined && (
              <span className="score-pill">
                综合: {photo.composite_score.toFixed(2)}
              </span>
            )}
            {photo?.ai_score !== null && photo?.ai_score !== undefined && (
              <span className="score-pill">AI: {photo.ai_score.toFixed(2)}</span>
            )}
            {photo?.blur_score !== null && photo?.blur_score !== undefined && (
              <span className="score-pill">清晰度: {photo.blur_score.toFixed(1)}</span>
            )}
            {photo?.exposure !== null && photo?.exposure !== undefined && (
              <span className="score-pill">曝光: {photo.exposure.toFixed(0)}</span>
            )}
            {photo?.width && photo?.height && (
              <span className="score-pill">{photo.width}×{photo.height}</span>
            )}
            {photo && (
              <span className="score-pill">{(photo.file_size / 1024 / 1024).toFixed(2)} MB</span>
            )}
          </div>

          {/* Rating row */}
          <div className="flex items-center gap-3">
            {/* Stars */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`text-2xl transition-all duration-100 hover:scale-110
                    ${photo?.user_rating !== null && photo?.user_rating !== undefined && photo.user_rating >= star
                      ? 'text-warning scale-105'
                      : 'text-white/15 hover:text-warning-light'
                    }`}
                  onClick={() => photo && onRate(photo, star, "keep")}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Keep button */}
            <button
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium
                border transition-all duration-150
                ${isKeep
                  ? 'bg-keep/10 border-keep/30 text-keep'
                  : 'bg-surface-raised border-base-700/60 text-base-300 hover:border-keep/30 hover:text-keep hover:bg-keep/5'
                }`}
              onClick={() => photo && onRate(photo, photo.user_rating ?? 3, "keep")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              保留 (空格)
            </button>

            {/* Reject button */}
            <button
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium
                border transition-all duration-150
                ${isReject
                  ? 'bg-reject/10 border-reject/30 text-reject'
                  : 'bg-surface-raised border-base-700/60 text-base-300 hover:border-reject/30 hover:text-reject hover:bg-reject/5'
                }`}
              onClick={() => photo && onRate(photo, -1, "reject")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              淘汰 (X)
            </button>
          </div>

          {/* Keyboard shortcuts */}
          <div className="flex items-center gap-1 text-[11px] text-base-500 flex-wrap">
            <kbd className="kbd">←</kbd><kbd className="kbd">→</kbd>切换 ·
            <kbd className="kbd">1-5</kbd>评分 · <kbd className="kbd">Space</kbd>保留 ·
            <kbd className="kbd">X</kbd>淘汰 · <kbd className="kbd">R</kbd>旋转 ·
            <kbd className="kbd">H</kbd>水平翻转 · <kbd className="kbd">V</kbd>垂直翻转 ·
            <kbd className="kbd">F</kbd>全屏 · <kbd className="kbd">T</kbd>缩略图 ·
            <kbd className="kbd">0</kbd>复位 · <kbd className="kbd">Esc</kbd>关闭
          </div>
        </div>
      </div>
    </div>
  );
}
