import type { Album, PhotoStats } from "../types";

interface SidebarProps {
  albums: Album[];
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number) => void;
  onScanDirectory: () => void;
  onDeleteAlbum: (id: number) => void;
  stats: PhotoStats | null;
}

export function Sidebar({
  albums,
  selectedAlbumId,
  onSelectAlbum,
  onScanDirectory,
  onDeleteAlbum,
  stats,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">Photo Rater</h1>
        <p className="app-subtitle">照片打分筛选</p>
      </div>

      <button className="btn-primary scan-btn" onClick={onScanDirectory}>
        <span className="icon">📁</span>
        导入照片文件夹
      </button>

      <div className="sidebar-section">
        <h2 className="section-title">相册</h2>
        <div className="album-list">
          {albums.length === 0 ? (
            <p className="empty-text">暂无相册，点击上方按钮导入</p>
          ) : (
            albums.map((album) => (
              <div
                key={album.id}
                className={`album-item ${
                  selectedAlbumId === album.id ? "active" : ""
                }`}
                onClick={() => onSelectAlbum(album.id!)}
              >
                <div className="album-info">
                  <span className="album-name">{album.name}</span>
                  <span className="album-count">{album.photo_count} 张照片</span>
                </div>
                <button
                  className="album-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAlbum(album.id!);
                  }}
                  title="删除相册"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {stats && (
        <div className="sidebar-section stats-section">
          <h2 className="section-title">统计</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">总数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.scored}</span>
              <span className="stat-label">已评分</span>
            </div>
            <div className="stat-item kept">
              <span className="stat-value">{stats.kept}</span>
              <span className="stat-label">保留</span>
            </div>
            <div className="stat-item rejected">
              <span className="stat-value">{stats.rejected}</span>
              <span className="stat-label">淘汰</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
