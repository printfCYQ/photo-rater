import type { PhotoStats } from "../types";

interface StatusBarProps {
  stats: PhotoStats | null;
  photoCount: number;
  loading: boolean;
}

export function StatusBar({ stats, photoCount, loading }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-left">
        {loading ? (
          <span className="status-item">加载中...</span>
        ) : (
          <span className="status-item">显示 {photoCount} 张照片</span>
        )}
        {stats && (
          <>
            <span className="status-separator">|</span>
            <span className="status-item">共 {stats.total} 张</span>
            <span className="status-separator">|</span>
            <span className="status-item">已评分 {stats.scored}</span>
            <span className="status-separator">|</span>
            <span className="status-item status-kept">
              保留 {stats.kept}
            </span>
            <span className="status-separator">|</span>
            <span className="status-item status-rejected">
              淘汰 {stats.rejected}
            </span>
          </>
        )}
      </div>
      <div className="status-right">
        <span className="status-item">Photo Rater v0.1</span>
      </div>
    </div>
  );
}
