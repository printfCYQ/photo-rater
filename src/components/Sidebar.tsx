import { useState, type ReactNode } from "react";
import type {
  Album,
  LocationGroup,
  PhotoGroup,
  PhotoStats,
  TimeNode,
} from "../types";

type BrowseMode = "album" | "time" | "location" | "similar";

interface SidebarProps {
  albums: Album[];
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number) => void;
  onScanDirectory: () => void;
  onDeleteAlbum: (id: number, name: string) => void;
  onClearCache: () => void;
  stats: PhotoStats | null;
  collapsed: boolean;
  browseMode: BrowseMode;
  onSelectBrowseMode: (mode: BrowseMode) => void;
  onSelectTime: (from: string, to: string, label: string) => void;
  timeRangeLabel?: string;
  timeTree: TimeNode[] | null;
  onComputeLocation: () => void;
  onSelectLocation: (id: number) => void;
  locationGroups: LocationGroup[] | null;
  computingLocation: boolean;
  selectedLocationId: number | null;
  onComputeSimilar: () => void;
  onSelectSimilar: (id: number) => void;
  similarGroups: PhotoGroup[] | null;
  computingSimilar: boolean;
  selectedGroupId: number | null;
}

export function Sidebar({
  albums,
  selectedAlbumId,
  onSelectAlbum,
  onScanDirectory,
  onDeleteAlbum,
  onClearCache,
  stats,
  collapsed,
  browseMode,
  onSelectBrowseMode,
  onSelectTime,
  timeRangeLabel,
  timeTree,
  onComputeLocation,
  onSelectLocation,
  locationGroups,
  computingLocation,
  selectedLocationId,
  onComputeSimilar,
  onSelectSimilar,
  similarGroups,
  computingSimilar,
  selectedGroupId,
}: SidebarProps) {
  return (
    <aside
      className={`bg-surface flex flex-col flex-shrink-0 border-r border-base-800/60 relative z-10 overflow-hidden
        transition-all duration-300 ease-in-out
        ${collapsed ? "!w-0 opacity-0 border-r-0" : "w-[260px] opacity-100"}`}
    >
      {/* Header */}
      <div className="px-[18px] pt-5 pb-4 border-b border-base-800/60 relative">
        <div className="absolute bottom-0 left-[18px] right-[18px] h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-5 px-3.5 py-4 custom-scrollbar overflow-y-auto">
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
              <p className="text-xs text-base-500 py-2 px-1.5">暂无相册，点击上方按钮导入</p>
            ) : (
              albums.map((album) => (
                <div
                  key={album.id}
                  className={`group flex items-center py-2 px-2.5 rounded-md cursor-pointer transition-all duration-150
                    border border-transparent relative
                    ${selectedAlbumId === album.id && browseMode === "album"
                      ? "bg-accent/8 border-accent/30"
                      : "hover:bg-surface-alt"
                    }`}
                  onClick={() => onSelectAlbum(album.id!)}
                >
                  {selectedAlbumId === album.id && browseMode === "album" && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px] bg-accent" />
                  )}
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 mr-2.5 transition-colors duration-150
                    ${selectedAlbumId === album.id && browseMode === "album"
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-raised text-base-500 group-hover:text-base-400"
                    }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-px">
                    <span className="text-[13px] font-medium text-base-100 truncate">{album.name}</span>
                    <span className="text-2xs text-base-500">{album.photo_count} 张照片</span>
                  </div>
                  <button
                    className="w-6 h-6 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 text-base-500 hover:text-reject hover:bg-reject/10 transition-all duration-150 flex-shrink-0 ml-1"
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

        {/* Divider between albums and smart classification */}
        <div className="h-px bg-base-800/60 mx-1.5" />

        {/* Smart classification section */}
        <div className="flex flex-col gap-3">
          <div className="section-label px-1.5">智能分类</div>

          {/* Segmented nav: time / location / similar */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-alt/70 border border-base-800/60">
            <SmartTab
              active={browseMode === "time"}
              disabled={selectedAlbumId === null}
              label="时间"
              onClick={() => onSelectBrowseMode("time")}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
              }
            />
            <SmartTab
              active={browseMode === "location"}
              disabled={selectedAlbumId === null}
              label="地点"
              onClick={() => onSelectBrowseMode("location")}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            />
            <SmartTab
              active={browseMode === "similar"}
              disabled={selectedAlbumId === null}
              label="相似"
              onClick={() => onSelectBrowseMode("similar")}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              }
            />
          </div>

          {/* Active view content (only the selected smart view is shown) */}
          <div className="flex flex-col gap-1 min-h-0">
            {browseMode === "time" && (
              <>
                {timeRangeLabel && (
                  <div className="px-1.5 pb-0.5 text-[10px] text-accent truncate">当前：{timeRangeLabel}</div>
                )}
                {timeTree === null ? (
                  <p className="text-2xs text-base-600 px-1.5 py-1">选择一个相册后显示</p>
                ) : timeTree.length === 0 ? (
                  <p className="text-2xs text-base-600 px-1.5 py-1">没有可读的拍摄时间</p>
                ) : (
                  timeTree.map((node) => (
                    <TimeTreeNode key={node.key} node={node} depth={0} onSelectTime={onSelectTime} activeLabel={browseMode === "time" ? timeRangeLabel : undefined} />
                  ))
                )}
              </>
            )}

            {browseMode === "location" && (
              locationGroups === null ? (
                <button
                  className="text-[11px] text-accent hover:text-accent-600 px-1.5 py-1.5 text-left rounded-md hover:bg-surface-alt transition-colors duration-150"
                  onClick={onComputeLocation}
                  disabled={computingLocation || selectedAlbumId === null}
                >
                  {computingLocation ? "分析中…" : "分析地点分组"}
                </button>
              ) : locationGroups.length === 0 ? (
                <p className="text-2xs text-base-600 px-1.5 py-1">没有带 GPS 的照片</p>
              ) : (
                locationGroups.map((g) => (
                  <button
                    key={g.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] transition-colors duration-150
                      ${selectedLocationId === g.id && browseMode === "location"
                        ? "bg-accent/10 text-accent"
                        : "text-base-300 hover:bg-surface-alt"
                      }`}
                    onClick={() => onSelectLocation(g.id)}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {g.lat === null && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      )}
                      <span className="truncate">{g.label}</span>
                    </span>
                    <span className="text-2xs text-base-500 ml-1.5 tabular-nums">{g.count}</span>
                  </button>
                ))
              )
            )}

            {browseMode === "similar" && (
              similarGroups === null ? (
                <button
                  className="text-[11px] text-accent hover:text-accent-600 px-1.5 py-1.5 text-left rounded-md hover:bg-surface-alt transition-colors duration-150"
                  onClick={onComputeSimilar}
                  disabled={computingSimilar || selectedAlbumId === null}
                >
                  {computingSimilar ? "比对中…（首次较慢）" : "查找相似 / 重复"}
                </button>
              ) : similarGroups.length === 0 ? (
                <p className="text-2xs text-base-600 px-1.5 py-1">未找到相似照片</p>
              ) : (
                similarGroups.map((g) => (
                  <button
                    key={g.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] transition-colors duration-150
                      ${selectedGroupId === g.id && browseMode === "similar"
                        ? "bg-accent/10 text-accent"
                        : "text-base-300 hover:bg-surface-alt"
                      }`}
                    onClick={() => onSelectSimilar(g.id)}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="truncate">第 {g.id} 组</span>
                      {g.best_score !== null && (
                        <span className="text-2xs text-base-600">· {g.best_score.toFixed(1)}</span>
                      )}
                    </span>
                    <span className="text-2xs text-base-500 ml-1.5 tabular-nums">{g.count} 张</span>
                  </button>
                ))
              )
            )}

            {browseMode === "album" && (
              <p className="text-2xs text-base-600 px-1.5 py-1 leading-relaxed">
                在上方选择一个智能分类（时间 / 地点 / 相似）来筛选照片
              </p>
            )}
          </div>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="flex flex-col gap-1.5">
            <div className="section-label px-1.5">统计</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-base-700/50 transition-colors duration-150">
                <span className="text-xl font-bold text-base-50 tracking-[-0.3px] leading-none tabular-nums">{stats.total}</span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">总数</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-base-700/50 transition-colors duration-150">
                <span className="text-xl font-bold text-base-50 tracking-[-0.3px] leading-none tabular-nums">{stats.scored}</span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">已评分</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-keep/20 transition-colors duration-150">
                <span className="text-xl font-bold text-keep tracking-[-0.3px] leading-none tabular-nums">{stats.kept}</span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">保留</span>
              </div>
              <div className="bg-surface-alt rounded-md p-2.5 border border-base-800/50 flex flex-col gap-0.5 hover:border-reject/20 transition-colors duration-150">
                <span className="text-xl font-bold text-reject tracking-[-0.3px] leading-none tabular-nums">{stats.rejected}</span>
                <span className="text-2xs text-base-500 uppercase tracking-[0.8px] font-semibold">淘汰</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 border-t border-base-800/60">
        <button
          className="flex items-center gap-2 w-full py-2 px-2.5 rounded-md text-[12px] text-base-500 hover:text-base-300 hover:bg-surface-alt transition-colors duration-150"
          onClick={onClearCache}
          title="清除所有缩略图缓存"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          清除所有缓存
        </button>
      </div>
    </aside>
  );
}

/// Recursive renderer for the year → month → day time tree.
function TimeTreeNode({
  node,
  depth,
  onSelectTime,
  activeLabel,
}: {
  node: TimeNode;
  depth: number;
  onSelectTime: (from: string, to: string, label: string) => void;
  activeLabel?: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isActive = activeLabel === node.label;

  return (
    <div>
      <div
        className={`flex items-center gap-0.5 rounded-md px-1 py-1 cursor-pointer transition-colors duration-150
          ${isActive ? "bg-accent/10 text-accent" : "text-base-300 hover:bg-surface-alt"}`}
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
        onClick={() => onSelectTime(node.from, node.to, node.label)}
      >
        {hasChildren ? (
          <button
            className="w-4 h-4 flex items-center justify-center text-base-500 hover:text-base-300"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 truncate text-[12px]">{node.label}</span>
        <span className="text-2xs text-base-500 tabular-nums ml-1">{node.count}</span>
      </div>
      {expanded &&
        node.children.map((child) => (
          <TimeTreeNode
            key={child.key}
            node={child}
            depth={depth + 1}
            onSelectTime={onSelectTime}
            activeLabel={activeLabel}
          />
        ))}
    </div>
  );
}

/// Segmented-control tab used in the smart-classification nav.
function SmartTab({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[11px] font-medium transition-all duration-150
        ${disabled
          ? "opacity-40 cursor-not-allowed text-base-500"
          : active
            ? "bg-accent/15 text-accent shadow-sm shadow-accent/10"
            : "text-base-400 hover:bg-surface-hover hover:text-base-200"
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
