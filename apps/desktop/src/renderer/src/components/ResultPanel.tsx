/**
 * 任务完成结果面板（模态）。
 */
import { CheckCircle2, FolderOpen } from "lucide-react";
import { useFileStore } from "../stores/fileStore";
import { useTaskStore } from "../stores/taskStore";
import { formatBytes, formatDuration, formatSaving } from "../utils/format";

export function ResultPanel(): React.JSX.Element | null {
  const showResult = useTaskStore(s => s.showResult);
  const summary = useTaskStore(s => s.summary);
  const closeResult = useTaskStore(s => s.closeResult);
  const items = useFileStore(s => s.items);

  if (!showResult || !summary) return null;

  const failures = Object.entries(items).filter(
    ([, item]) => item.status === "failed" && item.error
  );

  return (
    <div className="result-overlay" onClick={closeResult}>
      <div className="result-panel" onClick={e => e.stopPropagation()}>
        <div className="result-header">
          <CheckCircle2 size={20} color="var(--success)" />
          <h2>压缩完成</h2>
        </div>
        <div className="result-grid">
          <div className="result-item">
            <div className="k">成功</div>
            <div className="v success">{summary.success}</div>
          </div>
          <div className="result-item">
            <div className="k">失败 / 跳过 / 取消</div>
            <div className={`v${summary.failed > 0 ? " danger" : ""}`}>
              {summary.failed} / {summary.skipped} / {summary.canceled}
            </div>
          </div>
          <div className="result-item">
            <div className="k">原始总大小</div>
            <div className="v">{formatBytes(summary.originalTotal)}</div>
          </div>
          <div className="result-item">
            <div className="k">压缩后总大小</div>
            <div className="v">
              {formatBytes(summary.compressedTotal)}（
              {formatSaving(summary.originalTotal, summary.compressedTotal)}）
            </div>
          </div>
          <div className="result-item">
            <div className="k">耗时</div>
            <div className="v">{formatDuration(summary.durationMs)}</div>
          </div>
          <div className="result-item">
            <div className="k">输出目录</div>
            <div className="v" title={summary.outputDir} style={{ fontSize: 12 }}>
              {summary.outputDir}
            </div>
          </div>
        </div>
        {failures.length > 0 && (
          <div className="result-errors">
            {failures.map(([path, item]) => (
              <div key={path} title={`${path}: ${item.error}`}>
                {path}：{item.error}
              </div>
            ))}
          </div>
        )}
        <div className="result-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void window.app.openInExplorer(summary.outputDir)}
          >
            <FolderOpen size={14} /> 打开输出目录
          </button>
          <button type="button" className="btn btn-primary" onClick={closeResult}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
