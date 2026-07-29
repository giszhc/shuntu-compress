/**
 * IPC 注册：所有 handler 先经 validate 校验，再调 service。
 */
import { BrowserWindow, app, ipcMain, nativeTheme } from "electron";
import { IPC, IPC_EVENTS } from "../shared/ipc-types";
import type { DialogService } from "./services/dialogService";
import type { ProcessService } from "./services/processService";
import type { SettingsService } from "./services/settingsService";
import type { ThumbnailService } from "./services/thumbnailService";
import type { VipsService } from "./services/vipsService";
import {
  assertAbsolutePath,
  validateScanRequest,
  validateSettingsPatch,
  validateTaskId,
  validateTaskStartRequest,
  validateWindowControl
} from "./validate";

export interface Services {
  vips: VipsService;
  process: ProcessService;
  thumbnail: ThumbnailService;
  dialog: DialogService;
  settings: SettingsService;
}

export function sendToAll(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

export function registerIpc(services: Services): void {
  // ---- 对话框 ----
  ipcMain.handle(IPC.dialogOpenFiles, () => services.dialog.openFiles());
  ipcMain.handle(IPC.dialogOpenDirectory, () => services.dialog.openDirectory());
  ipcMain.handle(IPC.dialogPickOutputDir, () =>
    services.dialog.pickOutputDirectory()
  );

  // ---- 扫描 / 文件 ----
  ipcMain.handle(IPC.fsScan, (_event, raw) =>
    services.process.scan(validateScanRequest(raw))
  );
  ipcMain.handle(IPC.fsThumbnail, async (_event, raw) => {
    const filePath = assertAbsolutePath(raw, "文件路径");
    return { dataUrl: await services.thumbnail.get(filePath) };
  });
  ipcMain.handle(IPC.fsOpenInExplorer, (_event, raw) =>
    services.dialog.openInExplorer(assertAbsolutePath(raw, "路径"))
  );

  // ---- 任务 ----
  ipcMain.handle(IPC.taskStart, (_event, raw) =>
    services.process.start(validateTaskStartRequest(raw))
  );
  ipcMain.handle(IPC.taskCancel, (_event, raw) => {
    services.process.cancel(validateTaskId(raw));
  });

  // ---- libvips ----
  ipcMain.handle(IPC.vipsDetect, () => services.vips.detect());
  ipcMain.handle(IPC.vipsInstall, () => services.vips.install());
  ipcMain.handle(IPC.vipsCancelInstall, () => {
    services.vips.cancelInstall();
  });
  ipcMain.handle(IPC.vipsClearCache, () => {
    services.vips.clearCache();
  });

  // ---- 设置 ----
  ipcMain.handle(IPC.settingsGet, () => services.settings.get());
  ipcMain.handle(IPC.settingsSet, (_event, raw) =>
    services.settings.set(validateSettingsPatch(raw))
  );
  ipcMain.handle(IPC.settingsReset, () => services.settings.reset());

  // ---- 应用 / 窗口 ----
  ipcMain.handle(IPC.appGetVersion, () => app.getVersion());
  ipcMain.handle(IPC.appGetSystemTheme, () =>
    nativeTheme.shouldUseDarkColors ? "dark" : "light"
  );
  ipcMain.handle(IPC.windowControl, (event, raw) => {
    const { action } = validateWindowControl(raw);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (action === "min") window.minimize();
    else if (action === "max") {
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    } else window.close();
  });
  ipcMain.handle(IPC.windowIsMaximized, event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });

  // ---- 系统主题变化推送 ----
  nativeTheme.on("updated", () => {
    sendToAll(
      IPC_EVENTS.systemTheme,
      nativeTheme.shouldUseDarkColors ? "dark" : "light"
    );
  });
}
