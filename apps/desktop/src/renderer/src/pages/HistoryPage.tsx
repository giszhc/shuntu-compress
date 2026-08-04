/**
 * 历史优化记录页：累计统计 + 每次优化任务的时间 / 数量 / 体积变化 / 节省比例。
 * 数据来自主进程 history.json（optimization_history）。
 */
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Clock,
  FolderOpen,
  History,
  ImageDown,
  Images,
  Trash2
} from "lucide-react";
import type { HistoryRecord } from "../../../shared/ipc-types";
import { useHistoryStore } from "../stores/historyStore";
import { useUiStore } from "../stores/uiStore";
import { formatBytes, formatDuration, formatPercent } from "../utils/format";
import { openFolder } from "../utils/openFolder";
import "../styles/history.css";
import "../styles/settings.css";

/** epoch ms → “2026-08-04 09:20” */
function formatTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryPage(): React.JSX.Element {
  const summary = useHistoryStore(s => s.summary);
  const loaded = useHistoryStore(s => s.loaded);
  const clear = useHistoryStore(s => s.clear);
  const toast = useUiStore(s => s.toast);
  const [confirmingClear, setConfirmingClear] = useState(false);

  // 首次进入页面时若无数据则拉取一次（兜底：应用启动 load 失败后重试）
  useEffect(() => {
    if (loaded && summary === null) {
      void useHistoryStore.getState().refresh();
    }
  }, [loaded, summary]);

  const records = summary?.records ?? [];
  const totalCount = summary?.totalCount ?? 0;
  const totalSaved = summary?.totalSaved ?? 0;

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    void clear()
      .then(() => toast("历史记录已清空", "success"))
      .catch(() => toast("清空失败，请重试", "error"));
  };

  const renderRecord = (record: HistoryRecord): React.JSX.Element => (
    <div className="settings-card history-card" key={record.id}>
      <div className="history-row">
        <div className="history-main">
          <div className="history-name" title={record.taskName}>
            {record.taskName}
          </div>
          <div className="history-time">
            <Clock size={12} /> {formatTime(record.createTime)} · {record.fileCount} 张 ·{" "}
            {formatDuration(record.durationMs)}
          </div>
        </div>
        <div className="history-sizes">
          <span className="before">{formatBytes(record.beforeSize)}</span>
          <ArrowRight size={13} className="history-arrow" />
          <span className="after">{formatBytes(record.afterSize)}</span>
          <span className="history-saving">节省 {formatPercent(record.beforeSize, record.afterSize)}</span>
        </div>
        <button
          type="button"
          className="history-open"
          title={record.outputDir}
          disabled={!record.outputDir}
          onClick={() => void openFolder(record.outputDir)}
        >
          <FolderOpen size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="history-page">
        <header className="settings-header history-header">
          <h1>历史优化记录</h1>
          <p className="subtitle">回顾每次优化的收益，掌握图片资产的变化</p>
          {records.length > 0 && (
            <button
              type="button"
              className={`btn history-clear${confirmingClear ? " danger" : ""}`}
              onClick={handleClear}
              onBlur={() => setConfirmingClear(false)}
            >
              <Trash2 size={13} />
              {confirmingClear ? "再次点击确认清空" : "清空记录"}
            </button>
          )}
        </header>

        {/* 累计统计 */}
        <div className="history-stats">
          <div className="history-stat">
            <div className="history-stat-icon history-stat-icon--blue">
              <History size={18} />
            </div>
            <div className="k">优化次数</div>
            <div className="v">{records.length}</div>
          </div>
          <div className="history-stat">
            <div className="history-stat-icon history-stat-icon--green">
              <Images size={18} />
            </div>
            <div className="k">累计优化图片</div>
            <div className="v">{totalCount}</div>
          </div>
          <div className="history-stat">
            <div className="history-stat-icon history-stat-icon--purple">
              <ImageDown size={18} />
            </div>
            <div className="k">累计节省空间</div>
            <div className="v">{formatBytes(totalSaved)}</div>
          </div>
        </div>

        {/* 记录列表 */}
        {records.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">
              <History size={32} />
            </div>
            <h3>还没有优化记录</h3>
            <p>完成一次图片优化后，结果会展示在这里</p>
          </div>
        ) : (
          <div className="history-list">{records.map(renderRecord)}</div>
        )}
      </div>
    </div>
  );
}
