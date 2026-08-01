import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  batchScoreAi,
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
import { Toolbar } from "./Toolbar";
import { PhotoGrid } from "./PhotoGrid";
import { Lightbox } from "./Lightbox";
import { StatusBar } from "./StatusBar";
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
    try {
      const result = await listPhotos({
        album_id: selectedAlbumId,
        status: statusFilter,
        sort_by: sortBy,
        sort_desc: sortDesc,
      });
      setPhotos(result);
    } catch (e) {
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

  const handleDeleteAlbum = async (albumId: number) => {
    if (!confirm("确定要删除这个相册吗？相册中的照片评分记录将被清除，但原始文件不会被删除。")) {
      return;
    }
    try {
      await deleteAlbum(albumId);
      await loadAlbums();
      if (selectedAlbumId === albumId) {
        setSelectedAlbumId(null);
      }
    } catch (e) {
      console.error("Failed to delete album:", e);
      alert(`删除失败: ${e}`);
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
    <div className="flex h-screen w-screen bg-base relative">
      {/* Ambient accent glows */}
      <div className="ambient-glow-tl" />
      <div className="ambient-glow-br" />

      <Sidebar
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        onSelectAlbum={setSelectedAlbumId}
        onScanDirectory={handleScanDirectory}
        onDeleteAlbum={handleDeleteAlbum}
        stats={stats}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative z-[1]">
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
        />
        <PhotoGrid
          photos={photos}
          loading={loading}
          onRate={handleRate}
          onPhotoClick={(index) => setLightboxIndex(index)}
          thumbSize={400}
        />
        <StatusBar stats={stats} photoCount={photos.length} loading={loading} />
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
    </div>
  );
}
