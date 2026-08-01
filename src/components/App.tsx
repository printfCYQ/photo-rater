import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  batchScoreAi,
  clearAllCache,
  deleteAlbum,
  exportSelection,
  getStats,
  listAlbums,
  listPhotos,
  onBatchScoreProgress,
  ratePhoto,
  scanDirectory,
} from "../api";
import type { Album, Photo, PhotoStats } from "../types";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";
import { Toolbar } from "./Toolbar";
import { PhotoGrid, thumbUrlCache } from "./PhotoGrid";
import { Lightbox } from "./Lightbox";
import { StatusBar } from "./StatusBar";
import { ConfirmDialog } from "./ConfirmDialog";
import "../index.css";

export function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState("composite_score");
  const [sortDesc, setSortDesc] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    albumId: number;
    albumName: string;
  } | null>(null);
  const [deleteClearCache, setDeleteClearCache] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load albums on mount
  useEffect(() => {
    loadAlbums();
  }, []);

  // Load photos when album or filter changes
  useEffect(() => {
    if (selectedAlbumId !== null) {
      loadPhotos();
      loadStats();
    } else {
      setPhotos([]);
      setStats(null);
    }
  }, [selectedAlbumId, sortBy, sortDesc, statusFilter]);

  // Listen for batch score progress
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onBatchScoreProgress((payload) => {
      setScoreProgress(payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const loadAlbums = async () => {
    try {
      const result = await listAlbums();
      setAlbums(result);
    } catch (e) {
      console.error("Failed to load albums:", e);
    }
  };

  const loadPhotos = async () => {
    setLoading(true);
    const label = `[perf] listPhotos IPC (album=${selectedAlbumId})`;
    console.time(label);
    try {
      const result = await listPhotos({
        album_id: selectedAlbumId,
        status: statusFilter,
        sort_by: sortBy,
        sort_desc: sortDesc,
      });
      console.timeEnd(label);
      console.log(`[perf] Got ${result.length} photos`);
      setPhotos(result);
    } catch (e) {
      console.timeEnd(label);
      console.error("Failed to load photos:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await getStats(selectedAlbumId);
      setStats(result);
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  };

  const handleScanDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择照片文件夹",
      });

      if (typeof selected !== "string") return;

      const albumName = selected.split("/").pop() || "未命名相册";
      setLoading(true);

      const result = await scanDirectory(selected, albumName);
      await loadAlbums();
      setSelectedAlbumId(result.album_id);
    } catch (e) {
      console.error("Failed to scan directory:", e);
      alert(`扫描失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchScore = async () => {
    if (!photos.length) return;
    setScoring(true);
    setScoreProgress({ current: 0, total: photos.length });
    try {
      const paths = photos.map((p) => p.path);
      await batchScoreAi(paths);
      await loadPhotos();
      await loadStats();
    } catch (e) {
      console.error("Batch scoring failed:", e);
      alert(`评分失败: ${e}`);
    } finally {
      setScoring(false);
    }
  };

  const handleRate = async (photo: Photo, rating: number | null, status: string) => {
    try {
      await ratePhoto(photo.path, rating, status);
      // Update local state
      setPhotos((prev) =>
        prev.map((p) =>
          p.path === photo.path
            ? { ...p, user_rating: rating, status: status as Photo["status"] }
            : p
        )
      );
      await loadStats();
    } catch (e) {
      console.error("Failed to rate photo:", e);
    }
  };

  const handleDeleteAlbum = (albumId: number, albumName: string) => {
    setDeleteConfirm({ albumId, albumName });
    setDeleteClearCache(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { albumId } = deleteConfirm;
    try {
      await deleteAlbum(albumId, deleteClearCache);
      if (deleteClearCache) {
        thumbUrlCache.clear();
      }
      await loadAlbums();
      if (selectedAlbumId === albumId) {
        setSelectedAlbumId(null);
      }
    } catch (e) {
      console.error("Failed to delete album:", e);
      alert(`删除失败: ${e}`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleClearAllCache = async () => {
    try {
      const removed = await clearAllCache();
      thumbUrlCache.clear();
      alert(`已清理 ${removed} 个缓存文件`);
    } catch (e) {
      console.error("Failed to clear cache:", e);
      alert(`清理缓存失败: ${e}`);
    }
  };

  const handleExport = async (dest: string, mode: string) => {
    const selectedPhotos = photos.filter((p) => p.status === "keep");
    if (!selectedPhotos.length) {
      alert("没有标记为保留的照片，请先标记后再导出。");
      return;
    }
    try {
      const result = await exportSelection(
        selectedPhotos.map((p) => p.path),
        dest,
        mode
      );
      alert(
        `导出完成：成功 ${result.success_count} 张，失败 ${result.failed_count} 张${
          result.errors.length ? "\n" + result.errors.join("\n") : ""
        }`
      );
    } catch (e) {
      console.error("Export failed:", e);
      alert(`导出失败: ${e}`);
    }
  };

  const handleSelectExportFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择导出目标文件夹",
    });
    if (typeof selected === "string") {
      await handleExport(selected, "copy");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-base relative overflow-hidden">
      {/* Ambient accent glows */}
      <div className="ambient-glow-tl" />
      <div className="ambient-glow-br" />

      <Titlebar />

      <div className="flex flex-1 min-h-0">
        <Sidebar
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        onSelectAlbum={setSelectedAlbumId}
        onScanDirectory={handleScanDirectory}
        onDeleteAlbum={handleDeleteAlbum}
        onClearCache={handleClearAllCache}
        stats={stats}
        collapsed={sidebarCollapsed}
      />
      <div className="flex-1 flex flex-col relative z-[1]">
        <Toolbar
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSortChange={(col, desc) => {
            setSortBy(col);
            setSortDesc(desc);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onBatchScore={handleBatchScore}
          onExport={handleSelectExportFolder}
          scoring={scoring}
          scoreProgress={scoreProgress}
          photoCount={photos.length}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
        <PhotoGrid
          photos={photos}
          loading={loading}
          onRate={handleRate}
          onPhotoClick={(index) => setLightboxIndex(index)}
          thumbSize={400}
          sidebarWidth={sidebarCollapsed ? 0 : 260}
        />
        <StatusBar stats={stats} photoCount={photos.length} loading={loading} />
      </div>
      </div>
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onRate={handleRate}
        />
      )}

      {/* Delete album confirmation */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title="删除相册"
        message={`确定要删除相册「${deleteConfirm?.albumName}」吗？相册中的照片评分记录将被清除，但原始文件不会被删除。`}
        confirmLabel="删除"
        cancelLabel="取消"
        variant="danger"
        extraContent={
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={deleteClearCache}
                onChange={(e) => setDeleteClearCache(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded border transition-colors duration-150 flex items-center justify-center
                  ${deleteClearCache
                    ? 'bg-accent border-accent'
                    : 'bg-surface-alt border-base-600 hover:border-base-500'
                  }`}
              >
                {deleteClearCache && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-[13px] text-base-400">同时清理该相册的缩略图缓存</span>
          </label>
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
