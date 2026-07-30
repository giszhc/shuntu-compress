/**
 * libvips 一键安装弹窗：确认 → 下载/校验/解压进度 → 成功自动重试 / 失败可重试。
 */
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { formatBytes } from "../utils/format";

const PHASE_LABEL: Record<string, string> = {
  download: "正在下载压缩引擎…",
  verify: "正在校验文件完整性…",
  extract: "正在解压…",
  finalize: "正在完成安装…"
};

export function VipsInstallModal(): React.JSX.Element | null {
  const phase = useUiStore(s => s.vipsModal);
  const progress = useUiStore(s => s.installProgress);
  const error = useUiStore(s => s.installError);
  const afterInstall = useUiStore(s => s.afterInstall);
  const setVipsModal = useUiStore(s => s.setVipsModal);
  const closeVipsModal = useUiStore(s => s.closeVipsModal);
  const toast = useUiStore(s => s.toast);

  if (phase === "hidden") return null;

  const runInstall = () => {
    setVipsModal("installing");
    void window.app
      .vipsInstall()
      .then(() => {
        const retry = afterInstall;
        closeVipsModal();
        toast("压缩引擎安装完成", "success");
        retry?.();
      })
      .catch((err: unknown) => {
        // 主进程同时会推送 install:error 事件；这里兜底
        useUiStore
          .getState()
          .setInstallError(err instanceof Error ? err.message : "安装失败");
      });
  };

  const cancelInstall = () => {
    void window.app.vipsCancelInstall();
    closeVipsModal();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        {phase === "confirm" && (
          <>
            <h2>
              <Download size={16} /> 需要安装压缩引擎
            </h2>
            <p>
              首次使用需要安装图像压缩引擎（libvips）。安装过程在本机完成，
              不会上传任何文件；安装结束后即可开始压缩，可随时在设置中清除缓存。
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeVipsModal}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={runInstall}>
                <Download size={14} /> 立即安装
              </button>
            </div>
          </>
        )}

        {phase === "installing" && (
          <>
            <h2>
              <Loader2 size={16} className="spin" /> 正在安装压缩引擎
            </h2>
            <div className="install-progress">
              <div className="install-phase">
                <span>{PHASE_LABEL[progress?.phase ?? "download"] ?? "准备中…"}</span>
                {progress?.phase === "download" && progress.total > 0 && (
                  <span>
                    {formatBytes(progress.received)} / {formatBytes(progress.total)}
                  </span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelInstall}>
                取消安装
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <h2>
              <AlertTriangle size={16} color="var(--danger)" /> 安装失败
            </h2>
            <p>{error ?? "未知错误"}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeVipsModal}>
                关闭
              </button>
              <button type="button" className="btn btn-primary" onClick={runInstall}>
                重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
