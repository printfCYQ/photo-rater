import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  batchScoreAi,
  clearAllCache,
  deleteAlbum,
  exportSelection,
  getLocationGroups,
  getNimaStatus,
  getSimilarGroups,
  getStats,
  getTimeTree,
  listAlbums,
  listPhotos,
  onBatchScoreProgress,
  onScanComplete,
  onScanProgress,
  ratePhoto,
  rescanMetadata,
  scanDirectory,
} from "../api";
import type { Album, LocationGroup, Photo, PhotoGroup, PhotoStats, TimeNode } from "../types";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";
import { Toolbar } from "./Toolbar";
import { PhotoGrid, thumbUrlCache } from "./PhotoGrid";
import { Lightbox } from "./Lightbox";
import { StatusBar } from "./StatusBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { Settings } from "./Settings";
import { ToastContainer, type ToastItem, type ToastType } from "./Toast";
import { SettingsProvider } from "../contexts/SettingsContext";
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
  const [minScore, setMinScore] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    albumId: number;
    albumName: string;
  } | null>(null);
  const [deleteClearCache, setDeleteClearCache] = useState(false);
  const [clearCacheConfirm, setClearCacheConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nimaLoaded, setNimaLoaded] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Smart-view state machine: how photos are currently being browsed.
  type BrowseMode = "album" | "time" | "location" | "similar";
  const [browseMode, setBrowseMode] = useState<BrowseMode>("album");
  const [timeRange, setTimeRange] = useState<{ from?: string; to?: string; label?: string }>({});
  const [timeTree, setTimeTree] = useState<TimeNode[] | null>(null);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[] | null>(null);
  const [similarGroups, setSimilarGroups] = useState<PhotoGroup[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [computingLocation, setComputingLocation] = useState(false);
  const [computingSimilar, setComputingSimilar] = useState(false);
  // Background import progress (null when no import is running).
  const [importProgress, setImportProgress] = useState<{
    stage: string;
    current: number;
    total: number;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Load albums + check NIMA status on mount
  useEffect(() => {
    loadAlbums();
    getNimaStatus().then(setNimaLoaded).catch(() => setNimaLoaded(false));
  }, []);

  // Load photos when album, view mode, or filter changes
  useEffect(() => {
    if (selectedAlbumId !== null) {
      loadPhotos();
      loadStats();
    } else {
      setPhotos([]);
      setStats(null);
    }
  }, [
    selectedAlbumId,
    browseMode,
    timeRange,
    selectedLocationId,
    selectedGroupId,
    sortBy,
    sortDesc,
    statusFilter,
    minScore,
  ]);

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

  // Listen for background import progress + completion.
  // Import runs off the main thread on the Rust side; here we just render the
  // live progress and finalize (refresh albums + auto-select) when it finishes.
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    onScanProgress((payload) => {
      setImportProgress(payload);
    }).then((fn) => {
      unlistenProgress = fn;
    });

    onScanComplete((payload) => {
      void (async () => {
        await loadAlbums();
        resetView();
        setSelectedAlbumId(payload.album_id);
        loadTimeTree(payload.album_id);
        setImportProgress(null);
        showToast(`导入完成：共 ${payload.total} 张照片`, "success");
      })();
    }).then((fn) => {
      unlistenComplete = fn;
    });

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (selectedAlbumId === null) {
      setPhotos([]);
      return;
    }
    setLoading(true);
    const label = `[perf] listPhotos IPC (mode=${browseMode}, album=${selectedAlbumId})`;
    console.time(label);
    try {
      let result: Photo[] = [];
      if (browseMode === "album" || browseMode === "time") {
        result = await listPhotos({
          album_id: selectedAlbumId,
          status: statusFilter,
          min_score: minScore,
          date_from: browseMode === "time" ? (timeRange.from ?? null) : null,
          date_to: browseMode === "time" ? (timeRange.to ?? null) : null,
          sort_by: sortBy,
          sort_desc: sortDesc,
        });
      } else if (browseMode === "location" && locationGroups) {
        const g = locationGroups.find((g) => g.id === selectedLocationId);
        result = g ? g.photos : [];
      } else if (browseMode === "similar" && similarGroups) {
        const g = similarGroups.find((g) => g.id === selectedGroupId);
        result = g ? g.photos : [];
      }
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

  const resetView = () => {
    setBrowseMode("album");
    setTimeRange({});
    setLocationGroups(null);
    setSimilarGroups(null);
    setSelectedLocationId(null);
    setSelectedGroupId(null);
  };

  const loadTimeTree = async (albumId: number) => {
    try {
      const tree = await getTimeTree(albumId);
      setTimeTree(tree);
    } catch (e) {
      console.error("Failed to load time tree:", e);
    }
  };

  const handleSelectAlbum = (albumId: number) => {
    if (albumId === selectedAlbumId) {
      // Re-clicking the current album returns to its plain album view.
      resetView();
    } else {
      resetView();
      setSelectedAlbumId(albumId);
    }
    loadTimeTree(albumId);
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

      // Fire-and-forget: the heavy scan runs in the background on the Rust side.
      // Progress is shown via the scan-progress event; completion is handled by the
      // scan-complete listener above. This keeps the UI fully responsive during import.
      setImportProgress({ stage: "scanning", current: 0, total: 0 });
      showToast("后台导入中…", "info");
      scanDirectory(selected, albumName)
        .then(() => {
          // Result is consumed via the scan-complete event; nothing else to do here.
        })
        .catch((e) => {
          console.error("Failed to scan directory:", e);
          setImportProgress(null);
          showToast(`扫描失败: ${e}`, "error");
        });
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const handleSelectTime = (from: string, to: string, label: string) => {
    setTimeRange({ from, to, label });
    setBrowseMode("time");
  };

  // Switch the smart-classification view via the segmented nav.
  // Auto-triggers location/similar analysis on first open.
  const handleSelectBrowseMode = (mode: BrowseMode) => {
    if (selectedAlbumId === null) return;
    setBrowseMode(mode);
    if (mode === "location" && locationGroups === null) {
      void handleComputeLocation();
    } else if (mode === "similar" && similarGroups === null) {
      void handleComputeSimilar();
    }
  };

  const handleComputeLocation = async () => {
    if (selectedAlbumId === null) return;
    setComputingLocation(true);
    try {
      const groups = await getLocationGroups(selectedAlbumId);
      setLocationGroups(groups);
      const withGps = groups.filter((g) => g.lat !== null).length;
      if (groups.length > 0) {
        setSelectedLocationId(groups[0].id);
        setBrowseMode("location");
      }
      showToast(
        withGps > 0
          ? `已按地点分组：${withGps} 个地点${groups.some((g) => g.lat === null) ? "，另有未知位置" : ""}`
          : "没有带 GPS 信息的照片，无法按地点分组",
        withGps > 0 ? "success" : "warning"
      );
    } catch (e) {
      console.error("Location grouping failed:", e);
      showToast(`地点分组失败: ${e}`, "error");
    } finally {
      setComputingLocation(false);
    }
  };

  const handleSelectLocation = (id: number) => {
    setSelectedLocationId(id);
    setBrowseMode("location");
  };

  const handleComputeSimilar = async () => {
    if (selectedAlbumId === null) return;
    setComputingSimilar(true);
    try {
      const groups = await getSimilarGroups(selectedAlbumId);
      setSimilarGroups(groups);
      if (groups.length > 0) {
        setSelectedGroupId(groups[0].id);
        setBrowseMode("similar");
      }
      const dupCount = groups.reduce((acc, g) => acc + g.count, 0);
      showToast(
        groups.length > 0
          ? `找到 ${groups.length} 组相似照片（共 ${dupCount} 张），每组已按评分排好序`
          : "未找到相似/重复照片",
        groups.length > 0 ? "success" : "warning"
      );
    } catch (e) {
      console.error("Similar grouping failed:", e);
      showToast(`相似分组失败: ${e}`, "error");
    } finally {
      setComputingSimilar(false);
    }
  };

  const handleSelectSimilar = (id: number) => {
    setSelectedGroupId(id);
    setBrowseMode("similar");
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
      showToast(`评分失败: ${e}`, "error");
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
      showToast(`删除失败: ${e}`, "error");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleClearAllCache = async () => {
    setClearCacheConfirm(false);
    try {
      const removed = await clearAllCache();
      thumbUrlCache.clear();
      showToast(`已清理 ${removed} 个缓存文件`, "success");
    } catch (e) {
      console.error("Failed to clear cache:", e);
      showToast(`清理缓存失败: ${e}`, "error");
    }
  };

  const handleExport = async (dest: string, mode: string) => {
    const selectedPhotos = photos.filter((p) => p.status === "keep");
    try {
      const result = await exportSelection(
        selectedPhotos.map((p) => p.path),
        dest,
        mode
      );
      const detail = result.errors.length
        ? "\n" + result.errors.join("\n")
        : "";
      if (result.failed_count > 0) {
        showToast(
          `导出完成：成功 ${result.success_count} 张，失败 ${result.failed_count} 张${detail}`,
          "warning"
        );
      } else {
        showToast(
          `导出完成：成功 ${result.success_count} 张，失败 ${result.failed_count} 张${detail}`,
          "success"
        );
      }
    } catch (e) {
      console.error("Export failed:", e);
      showToast(`导出失败: ${e}`, "error");
    }
  };

  const handleRescanMetadata = () => {
    if (selectedAlbumId === null) return;
    // Fire-and-forget: the (now async) rescan runs off the main thread, so the
    // UI stays responsive. Show a start toast, then refresh on completion.
    showToast("正在重新读取拍摄参数…", "info");
    rescanMetadata(selectedAlbumId)
      .then(async (count) => {
        await loadPhotos();
        showToast(`已重新读取 ${count} 张照片的拍摄参数`, "success");
      })
      .catch((e) => {
        console.error("Rescan metadata failed:", e);
        showToast(`刷新元数据失败: ${e}`, "error");
      });
  };

  const handleSelectExportFolder = async () => {
    // Warn immediately (before opening the folder dialog) if nothing is marked keep
    const keepCount = photos.filter((p) => p.status === "keep").length;
    if (keepCount === 0) {
      showToast("没有标记为保留的照片，请先标记后再导出。", "warning");
      return;
    }
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
    <SettingsProvider>
      <div className="flex flex-col h-screen w-screen bg-base relative overflow-hidden">
      {/* Ambient accent glows */}
      <div className="ambient-glow-tl" />
      <div className="ambient-glow-br" />

      <Titlebar />

      <div className="flex flex-1 min-h-0">
        <Sidebar
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        onSelectAlbum={handleSelectAlbum}
        onScanDirectory={handleScanDirectory}
        onDeleteAlbum={handleDeleteAlbum}
        onClearCache={() => setClearCacheConfirm(true)}
        stats={stats}
        collapsed={sidebarCollapsed}
        browseMode={browseMode}
        onSelectBrowseMode={handleSelectBrowseMode}
        onSelectTime={handleSelectTime}
        timeRangeLabel={timeRange.label}
        timeTree={timeTree}
        onComputeLocation={handleComputeLocation}
        onSelectLocation={handleSelectLocation}
        locationGroups={locationGroups}
        computingLocation={computingLocation}
        selectedLocationId={selectedLocationId}
        onComputeSimilar={handleComputeSimilar}
        onSelectSimilar={handleSelectSimilar}
        similarGroups={similarGroups}
        computingSimilar={computingSimilar}
        selectedGroupId={selectedGroupId}
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
          minScore={minScore}
          onMinScoreChange={setMinScore}
          onBatchScore={handleBatchScore}
          onExport={handleSelectExportFolder}
          onRescanMetadata={handleRescanMetadata}
          canRescan={selectedAlbumId !== null}
          scoring={scoring}
          scoreProgress={scoreProgress}
          photoCount={photos.length}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onOpenSettings={() => setSettingsOpen(true)}
          nimaLoaded={nimaLoaded}
        />
        <PhotoGrid
          photos={photos}
          loading={loading}
          onRate={handleRate}
          onPhotoClick={(index) => setLightboxIndex(index)}
          thumbSize={400}
          sidebarWidth={sidebarCollapsed ? 0 : 260}
          keyboardEnabled={lightboxIndex === null}
        />
        <StatusBar stats={stats} photoCount={photos.length} loading={loading} importProgress={importProgress} />
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

      {/* Clear cache confirmation */}
      <ConfirmDialog
        open={clearCacheConfirm}
        title="清除所有缓存"
        message="将删除所有相册的缩略图磁盘缓存，下次浏览时需重新生成。此操作不影响照片文件和评分数据。"
        confirmLabel="清除"
        cancelLabel="取消"
        variant="danger"
        onConfirm={handleClearAllCache}
        onCancel={() => setClearCacheConfirm(false)}
      />

      {/* Settings panel */}
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
    </SettingsProvider>
  );
}
