/**
 * 应用根组件：布局 + 全局事件订阅 + e2e 测试钩子。
 */
import { useEffect } from "react";
import { ActionBar } from "./components/ActionBar";
import { FileArea } from "./components/FileArea";
import { ParamsPanel } from "./components/ParamsPanel";
import { ResultPanel } from "./components/ResultPanel";
import { Titlebar } from "./components/Titlebar";
import { Toasts } from "./components/Toasts";
import { UpdateModal } from "./components/UpdateModal";
import { VipsInstallModal } from "./components/VipsInstallModal";
import { AboutPage } from "./pages/AboutPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useFileStore } from "./stores/fileStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useTaskStore } from "./stores/taskStore";
import { useUiStore } from "./stores/uiStore";

export function App(): React.JSX.Element {
  const page = useUiStore(s => s.page);
  const loaded = useSettingsStore(s => s.loaded);

  // 初始化 + 全局事件订阅（只挂一次）
  useEffect(() => {
    void useSettingsStore.getState().load();

    const offs = [
      window.app.onSystemTheme(theme => {
        useSettingsStore.getState().setSystemTheme(theme);
      }),
      window.app.onScanProgress(e => {
        useFileStore.getState().setScanProgress(e.scanned);
      }),
      window.app.onTaskProgress(e => {
        useTaskStore.getState().onProgress(e);
      }),
      window.app.onTaskItemDone(e => {
        useFileStore.getState().applyResult(e.result.input, {
          status: e.result.status,
          output: e.result.output,
          compressedSize: e.result.compressedSize,
          error: e.result.error
        });
      }),
      window.app.onTaskFinished(e => {
        useTaskStore.getState().onFinished(e);
        const fs = useFileStore.getState();
        // 把本次任务有有效 key 的条目最终状态回填（队列对“未启动”项标 canceled 时
        // input 为空，渲染层无法据此定位，故下面再兜底清扫）。
        for (const r of e.results) {
          if (r.input) {
            fs.applyResult(r.input, {
              status: r.status,
              output: r.output,
              compressedSize: r.compressedSize,
              error: r.error
            });
          }
        }
        // 兜底：任务已结束，任何仍是 transient（pending/processing）的条目，
        // 只能是“未启动被取消”的残留（其 input 为空、未被上面回填）。
        // 否则取消后这些项卡在 pending，文件夹聚合行的“处理中”图标一直转圈。
        for (const [key, item] of Object.entries(useFileStore.getState().items)) {
          if (item.status === "pending" || item.status === "processing") {
            useFileStore.getState().applyResult(key, { ...item, status: "canceled" });
          }
        }
      }),
      window.app.onInstallProgress(e => {
        useUiStore.getState().setInstallProgress(e);
      }),
      window.app.onInstallError(e => {
        useUiStore.getState().setInstallError(e.message);
      }),
      window.app.onFilesDropped(paths => {
        void useFileStore.getState().addPaths(paths);
      }),
      window.app.onUpdateStatus(e => {
        useUiStore.getState().onUpdateStatus(e);
      })
    ];

    // e2e 测试钩子：Playwright 通过 window.__e2e 确定性驱动
    window.__e2e = {
      addPaths: paths => useFileStore.getState().addPaths(paths),
      start: () => useTaskStore.getState().start(),
      getSnapshot: () => {
        const files = useFileStore.getState();
        const task = useTaskStore.getState();
        return {
          entryCount: files.entries.length,
          items: files.items,
          running: task.running,
          summary: task.summary,
          showResult: task.showResult
        };
      }
    };

    return () => {
      offs.forEach(off => off());
      delete window.__e2e;
    };
  }, []);

  if (!loaded) {
    return <div className="app-shell" />;
  }

  return (
    <div className="app-shell">
      <Titlebar />
      <div className="app-body">
        <main className="app-content">
          {page === "main" && (
            <>
              <FileArea />
              <ParamsPanel />
            </>
          )}
          {page === "settings" && <SettingsPage />}
          {page === "about" && <AboutPage />}
        </main>
      </div>
      {page === "main" && <ActionBar />}
      <ResultPanel />
      <VipsInstallModal />
      <UpdateModal />
      <Toasts />
    </div>
  );
}
