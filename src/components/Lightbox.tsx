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

  // Image loading: try original first, fall back to preview on error
  const [imgSrc, setImgSrc] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [triedPreview, setTriedPreview] = useState(false);

  // View state: rotation, flip, fullscreen
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);

  // Filmstrip thumbnails
  const [filmstripUrls, setFilmstripUrls] = useState<Map<number, string>>(new Map());
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Load original image directly (instant — no Rust processing)
  useEffect(() => {
    if (!photo) return;
    setImgLoaded(false);
    setImgError(false);
    setTriedPreview(false);
    setImgSrc(getFileUrl(photo.path));
  }, [photo?.path]);

  // Reset view state when switching photos.
  // No centerView() needed — CSS flexbox on .lightbox-zoom-wrapper centers
  // the content.  resetTransform(0) puts translate(0,0) scale(1) which
  // is the CSS-centered position.
  useEffect(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoomLevel(100);
    transformRef.current?.resetTransform(0);
  }, [currentIndex]);

  // No centerView() effect needed — CSS flexbox on .lightbox-zoom-wrapper
  // handles centering.  The transform starts at translate(0,0) scale(1)
  // which is the CSS-centered position.  centerView() was fighting with
  // CSS and causing the image to jump to the right.

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

  // Load filmstrip thumbnails for visible range
  useEffect(() => {
    const start = Math.max(0, currentIndex - 15);
    const end = Math.min(photos.length, currentIndex + 15);
    const newUrls = new Map(filmstripUrls);

    for (let i = start; i < end; i++) {
      if (!newUrls.has(i)) {
        const path = photos[i].path;
        // Check shared cache first
        if (thumbUrlCache.has(path)) {
          newUrls.set(i, thumbUrlCache.get(path)!);
        } else {
          // Load async
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

  // Handle image load error — fall back to generated preview
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
          // Full reset: rotation, flips, zoom/pan
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
      // Fallback to browser fullscreen API
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

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="lightbox-topbar">
          <span className="lightbox-counter">
            {currentIndex + 1} / {photos.length}
          </span>
          <span className="lightbox-filename">{photo?.file_name}</span>
          <span className="lightbox-zoom-level">{Math.round(zoomLevel)}%</span>
          <div className="lightbox-topbar-actions">
            {/* Zoom controls */}
            <button
              className="lb-btn"
              onClick={() => transformRef.current?.zoomIn()}
              title="放大 (+)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button
              className="lb-btn"
              onClick={() => transformRef.current?.zoomOut()}
              title="缩小 (-)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            {/* Rotate */}
            <button
              className="lb-btn"
              onClick={() => setRotation((r) => r + 90)}
              title="顺时针旋转 (R)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button
              className="lb-btn"
              onClick={() => setRotation((r) => r - 90)}
              title="逆时针旋转 (Shift+R)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.12-9.36L1 10"/>
              </svg>
            </button>
            {/* Flip */}
            <button
              className="lb-btn"
              onClick={() => setFlipH((v) => !v)}
              title="水平翻转 (H)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M12 3v18M7 7l-4 5 4 5M17 7l4 5-4 5"/>
              </svg>
            </button>
            <button
              className="lb-btn"
              onClick={() => setFlipV((v) => !v)}
              title="垂直翻转 (V)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18M7 7l5-4 5 4M7 17l5 4 5-4"/>
              </svg>
            </button>
            <div className="lb-btn-divider" />
            {/* Reset / 复位 — fully restore initial state (position, scale, rotation, flips) */}
            <button
              className="lb-btn lb-reset"
              onClick={() => {
                if (!transformRef.current) return;
                setRotation(0);
                setFlipH(false);
                setFlipV(false);
                setZoomLevel(100);
                // resetTransform goes back to translate(0,0) scale(1).
                // CSS flexbox on .lightbox-zoom-wrapper centers the content,
                // so translate(0,0) = centered.  No centerView() needed.
                transformRef.current.resetTransform(300, "easeOutCubic");
              }}
              title="复位 (0) — 重置位置、缩放、旋转、翻转"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9V5a2 2 0 0 1 2-2h4"/>
                <path d="M21 9V5a2 2 0 0 0-2-2h-4"/>
                <path d="M3 15v4a2 2 0 0 0 2 2h4"/>
                <path d="M21 15v4a2 2 0 0 1-2 2h-4"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            {/* Fullscreen */}
            <button
              className="lb-btn"
              onClick={toggleFullscreen}
              title="全屏 (F)"
            >
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
            {/* Toggle filmstrip */}
            <button
              className="lb-btn"
              onClick={() => setShowFilmstrip((v) => !v)}
              title="缩略图条 (T)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
              </svg>
            </button>
            <div className="lb-btn-divider" />
            <button className="lb-btn lb-close" onClick={onClose} title="关闭 (Esc)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Image area with zoom/pan */}
        <div className="lightbox-image-area">
          <button
            className="lightbox-nav prev"
            onClick={() => currentIndex > 0 && onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="lightbox-image-container">
            {!imgLoaded && !imgError && (
              <div className="lightbox-loading">
                <div className="spinner" />
                <p>加载中...</p>
              </div>
            )}
            {imgError ? (
              <div className="lightbox-error">
                <p>图片加载失败</p>
                <p className="lightbox-error-path">{photo?.path}</p>
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
                  >
                    <img
                      src={imgSrc}
                      alt={photo?.file_name || ""}
                      draggable={false}
                      onLoad={() => {
                        // Setting imgLoaded triggers the centering effect
                        // below — we don't call centerView here to avoid
                        // racing the layout pass.
                        setImgLoaded(true);
                      }}
                      onError={handleImgError}
                      style={{
                        transform: imgTransform,
                        transition: "transform 0.2s ease",
                        maxWidth: "90vw",
                        maxHeight: "75vh",
                        objectFit: "contain",
                      }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              )
            )}
          </div>

          <button
            className="lightbox-nav next"
            onClick={() =>
              currentIndex < photos.length - 1 && onNavigate(currentIndex + 1)
            }
            disabled={currentIndex === photos.length - 1}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Filmstrip */}
        {showFilmstrip && (
          <div className="lightbox-filmstrip" ref={filmstripRef}>
            {photos.map((p, i) => {
              const url = filmstripUrls.get(i);
              return (
                <div
                  key={p.path}
                  data-index={i}
                  className={`filmstrip-item ${
                    i === currentIndex ? "active" : ""
                  } ${p.status === "keep" ? "keep" : ""} ${
                    p.status === "reject" ? "reject" : ""
                  }`}
                  onClick={() => onNavigate(i)}
                >
                  {url ? (
                    <img src={url} alt={p.file_name} loading="lazy" />
                  ) : (
                    <div className="filmstrip-placeholder" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom bar: scores + rating controls */}
        <div className="lightbox-bottom">
          <div className="lightbox-scores">
            {photo?.composite_score !== null && photo?.composite_score !== undefined && (
              <span className="score-badge">
                综合: {photo.composite_score.toFixed(2)}
              </span>
            )}
            {photo?.ai_score !== null && photo?.ai_score !== undefined && (
              <span className="score-badge">AI: {photo.ai_score.toFixed(2)}</span>
            )}
            {photo?.blur_score !== null && photo?.blur_score !== undefined && (
              <span className="score-badge">
                清晰度: {photo.blur_score.toFixed(1)}
              </span>
            )}
            {photo?.exposure !== null && photo?.exposure !== undefined && (
              <span className="score-badge">
                曝光: {photo.exposure.toFixed(0)}
              </span>
            )}
            {photo?.width && photo?.height && (
              <span className="score-badge">
                {photo.width}×{photo.height}
              </span>
            )}
            {photo && (
              <span className="score-badge">
                {(photo.file_size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>

          <div className="lightbox-rating">
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`star ${
                    photo?.user_rating !== null &&
                    photo?.user_rating !== undefined &&
                    photo.user_rating >= star
                      ? "active"
                      : ""
                  }`}
                  onClick={() => photo && onRate(photo, star, "keep")}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              className={`btn-action keep ${
                photo?.status === "keep" ? "active" : ""
              }`}
              onClick={() =>
                photo && onRate(photo, photo.user_rating ?? 3, "keep")
              }
            >
              ✓ 保留 (空格)
            </button>
            <button
              className={`btn-action reject ${
                photo?.status === "reject" ? "active" : ""
              }`}
              onClick={() => photo && onRate(photo, -1, "reject")}
            >
              ✕ 淘汰 (X)
            </button>
          </div>

          <div className="lightbox-shortcuts">
            <kbd>←</kbd> <kbd>→</kbd> 切换 · <kbd>1-5</kbd> 评分 ·{" "}
            <kbd>Space</kbd> 保留 · <kbd>X</kbd> 淘汰 ·{" "}
            <kbd>R</kbd> 旋转 · <kbd>H</kbd> 水平翻转 ·{" "}
            <kbd>V</kbd> 垂直翻转 · <kbd>F</kbd> 全屏 ·{" "}
            <kbd>T</kbd> 缩略图条 · <kbd>0</kbd> 重置 ·{" "}
            <kbd>滚轮</kbd> 缩放 · <kbd>双击</kbd> 放大 ·{" "}
            <kbd>拖拽</kbd> 平移 · <kbd>Esc</kbd> 关闭
          </div>
        </div>
      </div>
    </div>
  );
}
