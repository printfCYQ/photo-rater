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
                </div>

                {/* Formula */}
                <div className="flex flex-col gap-1 p-2.5 mb-2.5 rounded-lg
                  bg-base-800/60 border border-base-700/40
                  font-mono text-[11px] leading-relaxed">
                  <span className="text-base-200">综合分 = (清晰度 × 0.67 + 曝光 × 0.33) × 10</span>
                  <span className="font-bold text-warning-light">→ 0 – 10 分</span>
                </div>

                {/* Clarity */}
                <div className="flex items-start gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-accent shadow-[0_0_6px_rgba(8,151,168,0.5)]" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-base-100">清晰度 (权重 67%)</div>
                    <div className="text-[11px] text-base-300 leading-relaxed">Laplacian 方差算法检测图像边缘锐度，越高越清晰</div>
                  </div>
                </div>

                {/* Exposure */}
                <div className="flex items-start gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-warning shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-base-100">曝光 (权重 33%)</div>
                    <div className="text-[11px] text-base-300 leading-relaxed">平均亮度越接近中间值（128）评分越高，过曝或欠曝均扣分</div>
                  </div>
                </div>

                {/* Future */}
                <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md
                  bg-accent/10 border border-accent/15 text-[11px] text-base-300 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 bg-accent-light/60" />
                  <span>后续版本将接入 <strong className="text-accent-light font-semibold">AI NIMA 模型</strong>（权重 70%），届时评分会更贴近人眼审美</span>
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
          </>
        )}
      </div>
    </div>
  );
}
