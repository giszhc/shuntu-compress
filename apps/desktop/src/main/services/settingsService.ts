/**
 * 设置持久化：userData/settings.json（UTF-8）。
 * 读取失败/损坏时回退默认值并重写文件。
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_QUALITY
} from "@giszhc/vips-thumbnail-core";
import type { Settings } from "../../shared/ipc-types";
import { validateSettingsPatch } from "../validate";

export const DEFAULT_SETTINGS: Settings = {
  quality: DEFAULT_QUALITY,
  size: null,
  ext: null,
  recursive: true,
  preserveStructure: true,
  concurrency: DEFAULT_CONCURRENCY,
  theme: "system",
  outputDir: null,
  openAfterFinish: false
};

export class SettingsService {
  private cache: Settings | null = null;

  constructor(private readonly filePath = path.join(app.getPath("userData"), "settings.json")) {}

  get(): Settings {
    if (this.cache) return this.cache;
    let loaded: Partial<Settings> = {};
    try {
      const text = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(text);
      // 逐字段校验，非法字段回退默认
      try {
        loaded = validateSettingsPatch(parsed);
      } catch {
        loaded = {};
      }
    } catch {
      loaded = {};
    }
    this.cache = { ...DEFAULT_SETTINGS, ...loaded };
    return this.cache;
  }

  set(patch: Partial<Settings>): Settings {
    const merged = { ...this.get(), ...patch };
    this.cache = merged;
    this.persist(merged);
    return merged;
  }

  reset(): Settings {
    this.cache = { ...DEFAULT_SETTINGS };
    this.persist(this.cache);
    return this.cache;
  }

  private persist(settings: Settings): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(settings, null, 2), "utf8");
    } catch {
      // 写失败不阻断使用（下次启动回退默认）
    }
  }
}
