/**
 * 更新弹窗：
 * - update：检测到新版本，显示版本号与更新说明，提供「立即更新 / 跳过」。
 * - installing：下载安装中，显示进度。
 * - error：下载/检查失败。
 */
import { AlertTriangle, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { formatBytes } from "../utils/format";

export function UpdateModal(): React.JSX.Element | null {
  const phase = useUiStore(s => s.updateModal);
  const event = useUiStore(s => s.updateEvent);
  const error = useUiStore(s => s.updateError);
  const closeUpdateModal = useUiStore(s => s.closeUpdateModal);
  const toast = useUiStore(s => s.toast);

  if (phase === "hidden") return null;

  const startInstall = () => {
    void window.app
      .installUpdate()
      .catch((err: unknown) => {
        useUiStore
          .getState()
          .toast(err instanceof Error ? err.message : "下载更新失败", "error");
        useUiStore.getState().closeUpdateModal();
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        {phase === "update" && (
          <>
            <h2>
              <Sparkles size={16} color="var(--accent)" /> 发现新版本
            </h2>
            <div className="update-info">
              <div className="update-versions">
                <span className="update-ver-old">当前 v{event && event.phase === "available" ? event.currentVersion : ""}</span>
                <span className="update-arrow">→</span>
                <span className="update-ver-new">
                  v{event && event.phase === "available" ? event.latestVersion : ""}
                </span>
              </div>
              {event && event.phase === "available" && event.notes && (
                <p className="update-notes">{event.notes}</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeUpdateModal}>
                跳过
              </button>
              <button type="button" className="btn btn-primary" onClick={startInstall}>
                <Download size={14} /> 立即更新
              </button>
            </div>
          </>
        )}

        {phase === "installing" && (
          <>
            <h2>
              <Loader2 size={16} className="spin" /> 正在下载更新
            </h2>
            {event && event.phase === "downloading" && event.total > 0 && (
              <div className="install-progress">
                <div className="install-phase">
                  <span>
                    {formatBytes(event.received)} / {formatBytes(event.total)}
                  </span>
                  <span>{event.percent}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${event.percent}%` }} />
                </div>
              </div>
            )}
            {!(event && event.phase === "downloading") && (
              <p>正在连接服务器…</p>
            )}
            <p className="update-hint">下载完成后将自动安装并重启应用</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  toast("已取消本次更新", "info");
                  closeUpdateModal();
                }}
              >
                取消
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <h2>
              <AlertTriangle size={16} color="var(--danger)" /> 更新失败
            </h2>
            <p>{error ?? "未知错误"}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeUpdateModal}>
                关闭
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  // 重试：installUpdate 内部会重新 check，available 事件会重置错误态
                  void window.app
                    .installUpdate()
                    .catch((err: unknown) => {
                      useUiStore
                        .getState()
                        .toast(err instanceof Error ? err.message : "下载更新失败", "error");
                      useUiStore.getState().closeUpdateModal();
                    });
                }}
              >
                <RefreshCw size={14} /> 重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
