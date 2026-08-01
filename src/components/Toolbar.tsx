interface ToolbarProps {
  sortBy: string;
  sortDesc: boolean;
  onSortChange: (col: string, desc: boolean) => void;
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  onBatchScore: () => void;
  onExport: () => void;
  scoring: boolean;
  scoreProgress: { current: number; total: number };
  photoCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function Toolbar({
  sortBy,
  sortDesc,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  onBatchScore,
  onExport,
  scoring,
  scoreProgress,
  photoCount,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSettings,
}: ToolbarProps) {
  const sortOptions = [
    { value: "composite_score", label: "综合分" },
    { value: "ai_score", label: "AI 分" },
    { value: "blur_score", label: "清晰度" },
    { value: "user_rating", label: "我的评分" },
    { value: "file_name", label: "文件名" },
    { value: "created_at", label: "导入时间" },
  ];

  const statusOptions = [
    { value: null, label: "全部" },
    { value: "pending", label: "待评" },
    { value: "keep", label: "保留" },
    { value: "reject", label: "淘汰" },
  ];

  return (
    <div className="h-14 glass-surface flex items-center px-4 gap-4 flex-shrink-0 relative z-20">
      {/* Sidebar toggle */}
      <button
        className="w-8 h-8 rounded-md flex items-center justify-center text-base-400
          hover:text-base-200 hover:bg-surface-alt transition-colors duration-150 flex-shrink-0"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {/* Sort Group */}
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-[0.8px] text-base-500 whitespace-nowrap">
          排序
        </span>
        <select
          className="appearance-none bg-surface-raised border border-base-700/60 rounded-md py-1.5 pl-2.5 pr-7
            text-[13px] text-base-100 outline-none cursor-pointer
            hover:border-base-600/60 hover:bg-surface-overlay
            focus:border-accent focus:shadow-[0_0_0_3px] focus:shadow-accent/20
            transition-all duration-150 min-w-[90px]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 7px center",
            backgroundSize: "12px",
          }}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value, sortDesc)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          className="w-[30px] h-[30px] rounded-md bg-surface-raised border border-base-700/60
            flex items-center justify-center text-sm text-base-400
            hover:bg-surface-overlay hover:border-base-600/60 hover:text-base-200
            active:scale-95 transition-all duration-150"
          onClick={() => onSortChange(sortBy, !sortDesc)}
          title={sortDesc ? "降序" : "升序"}
        >
          {sortDesc ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-[0.8px] text-base-500 whitespace-nowrap">
          筛选
        </span>
        <div className="flex gap-0.5 bg-surface-raised rounded-lg p-0.5 border border-base-700/60">
          {statusOptions.map((opt) => (
            <button
              key={opt.label}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150
                ${statusFilter === opt.value
                  ? 'bg-accent text-white font-semibold shadow-sm shadow-accent/25'
                  : 'text-base-400 hover:text-base-100'
                }`}
              onClick={() => onStatusFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {scoring ? (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-[140px] progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    scoreProgress.total > 0
                      ? (scoreProgress.current / scoreProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="text-xs text-base-400 whitespace-nowrap tabular-nums">
              {scoreProgress.current}/{scoreProgress.total}
            </span>
          </div>
        ) : (
          <>
            <div className="scoring-tooltip-trigger">
              <button
                className="btn-secondary text-[13px] py-1.5 px-3.5"
                onClick={onBatchScore}
                disabled={photoCount === 0}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                批量评分
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 opacity-50">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>

              {/* Scoring Rules Tooltip */}
              <div className="scoring-tooltip w-80 p-3.5 rounded-xl
                bg-surface-overlay border border-base-700/60
                shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                {/* Title */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span className="text-[13px] font-bold text-base-50">评分规则</span>
                  <span className="text-[10px] text-base-400 ml-auto">六维分析</span>
                </div>

                {/* Formula */}
                <div className="flex flex-col gap-1 p-2.5 mb-2.5 rounded-lg
                  bg-base-800/60 border border-base-700/40
                  font-mono text-[11px] leading-relaxed">
                  <span className="text-base-300">清晰度 28% + 色彩 30% + 构图 27%</span>
                  <span className="text-base-300">+ 曝光 15% + 噪点惩罚</span>
                  <span className="font-bold text-warning-light">→ 0 – 10 分</span>
                </div>

                {/* Signals */}
                <div className="space-y-2">
                  {/* Sharpness */}
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.5)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-base-100">清晰度 (28%)</div>
                      <div className="text-[11px] text-base-300 leading-relaxed">Laplacian 方差 + 多尺度频域分析，检测图像锐度和高��细节</div>
                    </div>
                  </div>

                  {/* Color Harmony */}
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-base-100">色彩和谐 (30%)</div>
                      <div className="text-[11px] text-base-300 leading-relaxed">饱和度分布 + 色相多样性，灰蒙蒙的照片得分低</div>
                    </div>
                  </div>

                  {/* Composition */}
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-base-100">构图 (27%)</div>
                      <div className="text-[11px] text-base-300 leading-relaxed">三分法对齐检测，兴趣点越靠近九宫格交叉点分越高</div>
                    </div>
                  </div>

                  {/* Exposure */}
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-warning shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-base-100">曝光 (15%)</div>
                      <div className="text-[11px] text-base-300 leading-relaxed">亮度偏离中间值（128）越少越好，过曝/欠曝扣分</div>
                    </div>
                  </div>

                  {/* Noise */}
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-base-100">噪点 (惩罚倍率)</div>
                      <div className="text-[11px] text-base-300 leading-relaxed">局部方差检测，高噪点照片总分 ×0.65–0.85 自动惩罚</div>
                    </div>
                  </div>
                </div>

                {/* Future */}
                <div className="flex items-start gap-1.5 mt-3 p-2 rounded-md
                  bg-accent/10 border border-accent/15 text-[11px] text-base-300 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 bg-accent-light/60" />
                  <span>后续版本将接入 <strong className="text-accent-light font-semibold">AI NIMA 模型</strong>（权重 50%），进一步提升评分准确度</span>
                </div>
              </div>
            </div>
            <button
              className="btn-secondary text-[13px] py-1.5 px-3.5"
              onClick={onExport}
              disabled={photoCount === 0}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              导出精选
            </button>
            <button
              className="w-[34px] h-[34px] rounded-lg flex items-center justify-center
                text-base-400 hover:text-base-200 hover:bg-surface-alt border border-transparent
                hover:border-base-700/60 transition-all duration-150 flex-shrink-0"
              onClick={onOpenSettings}
              title="设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
