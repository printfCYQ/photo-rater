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
    <div className="toolbar">
      <div className="toolbar-group">
        <label className="toolbar-label">排序</label>
        <select
          className="select"
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
          className="btn-icon"
          onClick={() => onSortChange(sortBy, !sortDesc)}
          title={sortDesc ? "降序" : "升序"}
        >
          {sortDesc ? "↓" : "↑"}
        </button>
      </div>

      <div className="toolbar-group">
        <label className="toolbar-label">筛选</label>
        <div className="filter-chips">
          {statusOptions.map((opt) => (
            <button
              key={opt.label}
              className={`chip ${statusFilter === opt.value ? "active" : ""}`}
              onClick={() => onStatusFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        {scoring ? (
          <div className="scoring-progress">
            <div className="progress-bar">
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
            <span className="progress-text">
              评分中 {scoreProgress.current}/{scoreProgress.total}
            </span>
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={onBatchScore}
            disabled={photoCount === 0}
          >
            ⚡ 批量评分
          </button>
        )}
        <button
          className="btn-secondary"
          onClick={onExport}
          disabled={photoCount === 0}
        >
          📤 导出精选
        </button>
      </div>
    </div>
  );
}
