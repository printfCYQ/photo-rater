import type { Album, PhotoStats } from "../types";

interface SidebarProps {
  albums: Album[];
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number) => void;
  onScanDirectory: () => void;
  onDeleteAlbum: (id: number, name: string) => void;
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
    <aside className="w-[260px] bg-surface flex flex-col flex-shrink-0 border-r border-base-800/60 relative z-10">
      {/* Header */}
      <div className="px-[18px] pt-5 pb-4 border-b border-base-800/60 relative">
        {/* Subtle accent line */}
        <div className="absolute bottom-0 left-[18px] right-[18px] h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <div className="flex items-center gap-2.5">
          {/* Brand icon */}
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent to-accent-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-accent/25">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-base-50 tracking-[-0.2px] leading-tight">
              Photo Rater
            </h1>
            <p className="text-2xs text-base-500 mt-0.5">照片筛选管理</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-6 px-3.5 py-4 custom-scrollbar overflow-y-auto">

        {/* Import Button */}
        <button
          className="btn-primary text-[13px] py-2.5 px-4 w-full"
          onClick={onScanDirectory}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          导入照片文件夹
        </button>

        {/* Album Section */}
        <div className="flex flex-col gap-1.5">
          <div className="section-label flex items-center gap-1.5 px-1.5">
            相册
            {albums.length > 0 && (
              <span className="bg-surface-overlay text-base-400 text-[10px] font-semibold px-1.5 py-px rounded-full tracking-normal normal-case">
                {albums.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            {albums.length === 0 ? (
              <p className="text-xs text-base-500 py-2 px-1.5">
                暂无相册，点击上方按钮导入
              </p>
            ) : (
              albums.map((album) => (
                <div
                  key={album.id}
                  className={`group flex items-center py-2 px-2.5 rounded-md cursor-pointer transition-all duration-150
                    border border-transparent relative
                    ${selectedAlbumId === album.id
                      ? 'bg-accent/8 border-accent/30'
                      : 'hover:bg-surface-alt'
                    }`}
                  onClick={() => onSelectAlbum(album.id!)}
                >
                  {/* Active indicator bar */}
                  {selectedAlbumId === album.id && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px] bg-accent" />
                  )}

                  {/* Album icon */}
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 mr-2.5 transition-colors duration-150
                    ${selectedAlbumId === album.id
                      ? 'bg-accent/10 text-accent'
                      : 'bg-surface-raised text-base-500 group-hover:text-base-400'
                    }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-px">
                    <span className="text-[13px] font-medium text-base-100 truncate">
                      {album.name}
                    </span>
                    <span className="text-2xs text-base-500">
                      {album.photo_count} 张照片
                    </span>
                  </div>

                  <button
                    className="w-6 h-6 rounded-sm flex items-center justify-center
                      opacity-0 group-hover:opacity-100 text-base-500
                      hover:text-reject hover:bg-reject/10 transition-all duration-150 flex-shrink-0 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAlbum(album.id!, album.name);
                    }}
                    title="删除相册"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="flex flex-col gap-1.5">
            <div className="section-label px-1.5">统计</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-base-700/50 transition-colors duration-150">
                <span className="text-xl font-bold text-base-50 tracking-[-0.3px] leading-none tabular-nums">
                  {stats.total}
                </span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">总数</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-base-700/50 transition-colors duration-150">
                <span className="text-xl font-bold text-base-50 tracking-[-0.3px] leading-none tabular-nums">
                  {stats.scored}
                </span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">已评分</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-keep/20 transition-colors duration-150">
                <span className="text-xl font-bold text-keep tracking-[-0.3px] leading-none tabular-nums">
                  {stats.kept}
                </span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">保留</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-reject/20 transition-colors duration-150">
                <span className="text-xl font-bold text-reject tracking-[-0.3px] leading-none tabular-nums">
                  {stats.rejected}
                </span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">淘汰</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
