/**
 * 底部操作栏：统计信息 + 进度条 + 开始/取消按钮。
 * 视觉与设计图保持一致：左侧带图标的文件统计，中间进度条，右侧主操作按钮。
 */
import { FolderOpen, Loader2, Play, Square } from "lucide-react";
import { useFileStore } from "../stores/fileStore";
import { useTaskStore } from "../stores/taskStore";
import { formatBytes } from "../utils/format";

export function ActionBar(): React.JSX.Element {
  const entries = useFileStore(s => s.entries);
  const scanning = useFileStore(s => s.scanning);
  const running = useTaskStore(s => s.running);
  const canceling = useTaskStore(s => s.canceling);
  const progress = useTaskStore(s => s.progress);
  const start = useTaskStore(s => s.start);
  const cancel = useTaskStore(s => s.cancel);

  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  const percent = progress?.percent ?? 0;
  const finishing = useTaskStore(s => s.finishing);

  return (
    <footer className="action-bar">
      <div className="action-stats">
        <FolderOpen size={14} className="action-stats-icon" />
        {entries.length > 0
          ? `${entries.length} 个文件 · ${formatBytes(totalSize)}`
          : "尚未添加文件"}
      </div>

      <div className="action-progress">
        {running || finishing ? (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="progress-text" title={progress?.currentFile}>
              {finishing ? (
                "处理完成，正在整理结果…"
              ) : (
                <>
                  {progress?.done}/{progress?.total} · {percent}% ·{" "}
                  {progress?.currentFile.split(/[\\/]/).pop() || "…"}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="progress-track" style={{ opacity: 0.35 }}>
            <div className="progress-fill" style={{ width: 0 }} />
          </div>
        )}
      </div>

      <div className="action-buttons">
        {running ? (
          <button
            type="button"
            className="btn btn-danger-ghost btn-lg"
            disabled={canceling}
            onClick={() => void cancel()}
          >
            {canceling ? (
              <>
                <Loader2 size={15} className="spin" /> 正在取消…
              </>
            ) : (
              <>
                <Square size={15} /> 取消
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={entries.length === 0 || scanning}
            onClick={() => void start()}
          >
            <Play size={15} /> 开始压缩
          </button>
        )}
      </div>
    </footer>
  );
}
