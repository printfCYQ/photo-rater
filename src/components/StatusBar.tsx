import type { PhotoStats } from "../types";

interface StatusBarProps {
  stats: PhotoStats | null;
  photoCount: number;
  loading: boolean;
  importProgress?: { stage: string; current: number; total: number } | null;
}

const STAGE_LABEL: Record<string, string> = {
  scanning: "扫描中",
  saving: "写入数据库",
  done: "完成",
};

export function StatusBar({ stats, photoCount, loading, importProgress }: StatusBarProps) {
  const percent =
    importProgress && importProgress.total > 0
      ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
      : importProgress
        ? 0
        : 100;

  return (
    <div className="h-[30px] glass-surface flex items-center justify-between px-4 text-xs text-base-500 flex-shrink-0 border-t border-base-800/60">
      <div className="flex items-center gap-2 min-w-0">
        {importProgress ? (
          <>
            <span className="text-accent font-medium shrink-0">
              {STAGE_LABEL[importProgress.stage] ?? importProgress.stage}
            </span>
            <div className="w-32 h-1.5 rounded-full bg-base-800 overflow-hidden shrink-0">
              <div
                className="h-full bg-accent transition-[width] duration-150 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0">
              {importProgress.total > 0
                ? `${importProgress.current} / ${importProgress.total}`
                : "准备中…"}
            </span>
          </>
        ) : loading ? (
          <span>加载中...</span>
        ) : (
          <span>显示 {photoCount} 张照片</span>
        )}
        {!importProgress && stats && (
          <>
            <span className="text-base-700">|</span>
            <span>共 {stats.total} 张</span>
            <span className="text-base-700">|</span>
            <span>已评分 {stats.scored}</span>
            <span className="text-base-700">|</span>
            <span className="text-keep">保留 {stats.kept}</span>
            <span className="text-base-700">|</span>
            <span className="text-reject">淘汰 {stats.rejected}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span>Photo Rater v0.1</span>
      </div>
    </div>
  );
}
