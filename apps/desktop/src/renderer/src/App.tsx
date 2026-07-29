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
      }),
      window.app.onInstallProgress(e => {
        useUiStore.getState().setInstallProgress(e);
      }),
      window.app.onInstallError(e => {
        useUiStore.getState().setInstallError(e.message);
      }),
      window.app.onFilesDropped(paths => {
        void useFileStore.getState().addPaths(paths);
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
      <Toasts />
    </div>
  );
}
