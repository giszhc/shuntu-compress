/**
 * SettingsService 单测：默认值、持久化、损坏文件回退、非法字段回退。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 单测环境无 Electron 运行时，mock 掉 app.getPath
vi.mock("electron", () => ({
  app: {
    getPath: () => os.tmpdir()
  }
}));

import { DEFAULT_SETTINGS, SettingsService } from "../services/settingsService";

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "vips-settings-"));
  file = path.join(dir, "settings.json");
});

afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 忽略清理失败 */
  }
});

describe("SettingsService", () => {
  it("文件不存在时返回默认值", () => {
    const svc = new SettingsService(file);
    expect(svc.get()).toEqual(DEFAULT_SETTINGS);
  });

  it("set 后持久化到磁盘并可重新读取", () => {
    const svc = new SettingsService(file);
    const updated = svc.set({ quality: 60, theme: "dark" });
    expect(updated.quality).toBe(60);
    expect(updated.theme).toBe("dark");

    const fresh = new SettingsService(file);
    expect(fresh.get().quality).toBe(60);
    expect(fresh.get().theme).toBe("dark");
    // 其余字段保持默认
    expect(fresh.get().concurrency).toBe(DEFAULT_SETTINGS.concurrency);
  });

  it("JSON 损坏时回退默认值", () => {
    fs.writeFileSync(file, "{ 这不是合法 JSON", "utf8");
    const svc = new SettingsService(file);
    expect(svc.get()).toEqual(DEFAULT_SETTINGS);
  });

  it("包含非法字段时整体回退默认值", () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ quality: 9999, hacker: true }),
      "utf8"
    );
    const svc = new SettingsService(file);
    expect(svc.get()).toEqual(DEFAULT_SETTINGS);
  });

  it("reset 恢复默认并写盘", () => {
    const svc = new SettingsService(file);
    svc.set({ quality: 10 });
    const restored = svc.reset();
    expect(restored).toEqual(DEFAULT_SETTINGS);
    const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(onDisk.quality).toBe(DEFAULT_SETTINGS.quality);
  });

  it("设置文件为 UTF-8 且中文路径可用", () => {
    const zhDir = path.join(dir, "中文 目录");
    const zhFile = path.join(zhDir, "settings.json");
    const svc = new SettingsService(zhFile);
    svc.set({ outputDir: "D:\\图片 输出" });
    const text = fs.readFileSync(zhFile, "utf8");
    expect(text).toContain("图片 输出");
  });
});
