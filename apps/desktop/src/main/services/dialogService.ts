/**
 * 系统对话框与资源管理器操作。
 */
import fs from "node:fs";
import { BrowserWindow, dialog, shell } from "electron";
import { ConfigError } from "@giszhc/vips-thumbnail-core";

export class DialogService {
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async openFiles(): Promise<string[]> {
    const window = this.getWindow();
    if (!window) return [];
    const result = await dialog.showOpenDialog(window, {
      title: "选择图片",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "图片文件", extensions: ["jpg", "jpeg", "png"] }]
    });
    return result.canceled ? [] : result.filePaths;
  }

  async openDirectory(): Promise<string | null> {
    const window = this.getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: "选择文件夹",
      properties: ["openDirectory"]
    });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  }

  async pickOutputDirectory(): Promise<string | null> {
    const window = this.getWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: "选择输出目录",
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  }

  async openInExplorer(targetPath: string): Promise<void> {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(targetPath);
    } catch {
      throw new ConfigError("路径不存在或已被移动");
    }
    if (stat.isDirectory()) {
      const error = await shell.openPath(targetPath);
      if (error) throw new ConfigError(`无法打开目录：${error}`);
    } else {
      shell.showItemInFolder(targetPath);
    }
  }
}
