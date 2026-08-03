/**
 * IPC 注册：所有 handler 先经 validate 校验，再调 service。
 */
import { BrowserWindow, app, ipcMain, nativeTheme, shell } from "electron";
import { ConfigError } from "@giszhc/vips-thumbnail-core";
import { IPC, IPC_EVENTS } from "../shared/ipc-types";
import type { DialogService } from "./services/dialogService";
import type { ProcessService } from "./services/processService";
import type { SettingsService } from "./services/settingsService";
import type { ThumbnailService } from "./services/thumbnailService";
import type { UpdateService } from "./services/updateService";
import type { VipsService } from "./services/vipsService";
import { logCrash } from "./crash-logger";
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
  update: UpdateService;
}

export function sendToAll(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    try {
      // 单窗口发送失败（窗口正在销毁、payload 不可序列化等）不应中断主进程，
      // 否则会冒泡成未捕获 rejection / 异常导致整个程序闪退。
      if (!window.webContents.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    } catch (err) {
      logCrash("sendToAll", `${channel}: ${err instanceof Error ? err.message : String(err)}`);
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
  ipcMain.handle(IPC.appCheckUpdate, () => services.update.check());
  ipcMain.handle(IPC.appInstallUpdate, () => services.update.install());
  ipcMain.handle(IPC.appOpenExternal, (_event, raw) => {
    if (typeof raw !== "string" || !/^https?:\/\//i.test(raw)) {
      throw new ConfigError("仅支持打开 http/https 链接");
    }
    return shell.openExternal(raw);
  });
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

  // 渲染进程把全局错误转发到主进程日志（打包后无 console 输出）
  ipcMain.handle(IPC.appLog, (_event, raw) => {
    logCrash("renderer", typeof raw === "string" ? raw : JSON.stringify(raw));
    return true;
  });

  // ---- 系统主题变化推送 ----
  nativeTheme.on("updated", () => {
    sendToAll(
      IPC_EVENTS.systemTheme,
      nativeTheme.shouldUseDarkColors ? "dark" : "light"
    );
  });
}
