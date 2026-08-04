/**
 * preload：contextBridge 暴露类型化 API，渲染进程无 Node 能力。
 */
import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  IPC,
  IPC_EVENTS,
  type AppApi,
  type FeedbackRequest,
  type ScanRequest,
  type Settings,
  type TaskStartRequest,
  type WindowControlRequest
} from "../shared/ipc-types";

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: AppApi = {
  // 同步字段
  platform: process.platform,

  openFiles: () => ipcRenderer.invoke(IPC.dialogOpenFiles),
  openDirectory: () => ipcRenderer.invoke(IPC.dialogOpenDirectory),
  pickOutputDirectory: () => ipcRenderer.invoke(IPC.dialogPickOutputDir),

  scan: (request: ScanRequest) => ipcRenderer.invoke(IPC.fsScan, request),
  thumbnail: (path: string) => ipcRenderer.invoke(IPC.fsThumbnail, path),
  imageInfo: (path: string) => ipcRenderer.invoke(IPC.fsImageInfo, path),
  openInExplorer: (path: string) => ipcRenderer.invoke(IPC.fsOpenInExplorer, path),

  startTask: (request: TaskStartRequest) => ipcRenderer.invoke(IPC.taskStart, request),
  cancelTask: (taskId: string) => ipcRenderer.invoke(IPC.taskCancel, taskId),

  vipsDetect: () => ipcRenderer.invoke(IPC.vipsDetect),
  vipsInstall: () => ipcRenderer.invoke(IPC.vipsInstall),
  vipsCancelInstall: () => ipcRenderer.invoke(IPC.vipsCancelInstall),
  vipsClearCache: () => ipcRenderer.invoke(IPC.vipsClearCache),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.settingsSet, patch),
  resetSettings: () => ipcRenderer.invoke(IPC.settingsReset),

  getHistory: () => ipcRenderer.invoke(IPC.historyGet),
  clearHistory: () => ipcRenderer.invoke(IPC.historyClear),

  getVersion: () => ipcRenderer.invoke(IPC.appGetVersion),
  getSystemTheme: () => ipcRenderer.invoke(IPC.appGetSystemTheme),
  windowControl: (request: WindowControlRequest) =>
    ipcRenderer.invoke(IPC.windowControl, request),
  isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
  log: (message: string) => ipcRenderer.invoke(IPC.appLog, message),

  checkUpdate: () => ipcRenderer.invoke(IPC.appCheckUpdate),
  installUpdate: () => ipcRenderer.invoke(IPC.appInstallUpdate),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.appOpenExternal, url),

  sendFeedback: (request: FeedbackRequest) =>
    ipcRenderer.invoke(IPC.feedbackSend, request),

  onScanProgress: cb => subscribe(IPC_EVENTS.scanProgress, cb),
  onTaskProgress: cb => subscribe(IPC_EVENTS.taskProgress, cb),
  onTaskItemDone: cb => subscribe(IPC_EVENTS.taskItemDone, cb),
  onTaskFinished: cb => subscribe(IPC_EVENTS.taskFinished, cb),
  onInstallProgress: cb => subscribe(IPC_EVENTS.installProgress, cb),
  onInstallError: cb => subscribe(IPC_EVENTS.installError, cb),
  onSystemTheme: cb => subscribe(IPC_EVENTS.systemTheme, cb),
  onMaximizeChange: cb => subscribe(IPC_EVENTS.maximizeChange, cb),
  onFilesDropped: cb => subscribe(IPC_EVENTS.filesDropped, cb),
  onUpdateStatus: cb => subscribe(IPC_EVENTS.updateStatus, cb)
};

contextBridge.exposeInMainWorld("app", api);

/**
 * 拖拽文件路径提取：渲染进程拿不到 File.path（contextIsolation），
 * 由 preload 的 webUtils.getPathForFile 转换后回传。
 */
contextBridge.exposeInMainWorld("dropUtils", {
  getPathsForFiles(files: File[]): string[] {
    return files
      .map(file => {
        try {
          return webUtils.getPathForFile(file);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  }
});
