import type { PhotoStats } from "../types";

interface StatusBarProps {
  stats: PhotoStats | null;
  photoCount: number;
  loading: boolean;
}

export function StatusBar({ stats, photoCount, loading }: StatusBarProps) {
  return (
    <div className="h-[30px] glass-surface flex items-center justify-between px-4 text-xs text-base-500 flex-shrink-0 border-t border-base-800/60">
      <div className="flex items-center gap-2">
        {loading ? (
          <span>加载中...</span>
        ) : (
          <span>显示 {photoCount} 张照片</span>
        )}
        {stats && (
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
