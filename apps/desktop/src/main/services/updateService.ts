/**
 * 自动更新服务：检查 Gitee 托管的 latest.json，下载新安装包并静默安装。
 *
 * 版本源约定（与 scripts/publish-application-to-gitee.mjs 一致）：
 *   仓库 giszhc/application-software 的 <GITEE_SUBDIR>/latest.json
 *   { "version": "1.1.0", "notes": "更新说明", "url": "<raw 直链>" }
 *
 * 检查走 Gitee contents API（实时、无 CDN 缓存延迟）；下载走 latest.json 里的 raw 直链。
 *
 * 流程：
 *   check()      → 拉取 latest.json，与当前版本对比，返回 UpdateCheckResult
 *   install()    → 下载安装包到临时目录 → 校验非空 → 启动安装器（NSIS /S 静默）→ 退出应用
 *
 * 仅 Windows 支持自动静默安装（NSIS /S）；macOS（dmg）不支持命令行静默，
 * 检查到更新时渲染层提示用户手动下载，install() 在非 Windows 下抛错。
 */
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { app, shell } from "electron";
import { IPC_EVENTS, type UpdateCheckResult, type UpdateStatusEvent } from "../../shared/ipc-types";
import { logInfo } from "../crash-logger";

/** Gitee 仓库 API（实时读取文件内容，无 CDN 缓存） */
const VERSION_FILE_API =
  "https://gitee.com/api/v5/repos/giszhc/application-software/contents/%E7%9E%AC%E5%9B%BE%E5%8E%8B%E7%BC%A9/latest.json";

interface LatestJson {
  version?: string;
  notes?: string;
  url?: string;
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map(n => parseInt(n, 10) || 0);
}

/** 语义化版本比较：a > b 返回 1，相等 0，小于 -1 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(fetchText(res.headers.location, timeoutMs));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`检查更新失败（HTTP ${res.statusCode}）`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c as Buffer));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("检查更新超时"));
    });
    req.on("error", reject);
  });
}

/** 从 Gitee contents API 响应中解出 latest.json 内容 */
function parseGiteeApi(raw: string): LatestJson {
  const json = JSON.parse(raw) as { content?: string; download_url?: string };
  let text: string;
  if (json.content) {
    // API 返回 base64 编码的文件内容
    text = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
  } else {
    text = raw;
  }
  return JSON.parse(text) as LatestJson;
}

export interface UpdateServiceCallbacks {
  /** 向渲染层推送更新状态事件 */
  onStatus: (event: UpdateStatusEvent) => void;
}

/** 官网地址（docs 部署的 GitHub Pages） */
export const OFFICIAL_SITE_URL = "https://giszhc.github.io/shuntu-compress";

export class UpdateService {
  private constructor(private readonly callbacks: UpdateServiceCallbacks) {}

  static create(callbacks: UpdateServiceCallbacks): UpdateService {
    return new UpdateService(callbacks);
  }

  private push(event: UpdateStatusEvent): void {
    try {
      this.callbacks.onStatus(event);
    } catch {
      // 推送失败不阻断更新流程
    }
  }

  /** 检查是否有可用更新（同时推送 checking 状态） */
  async check(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion();
    this.push({ phase: "checking" });
    try {
      const raw = await fetchText(VERSION_FILE_API);
      const data = parseGiteeApi(raw);
      const latestVersion = String(data.version ?? "").trim();
      if (!latestVersion) throw new Error("版本文件格式无效");
      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      logInfo("update", `检查更新完成：current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate}`);
      if (hasUpdate) {
        this.push({
          phase: "available",
          currentVersion,
          latestVersion,
          notes: data.notes
        });
      } else {
        this.push({ phase: "none", currentVersion });
      }
      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        notes: data.notes,
        downloadUrl: data.url
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "检查更新失败";
      logInfo("update", `检查更新失败：${message}`);
      this.push({ phase: "error", message });
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: undefined
      };
    }
  }

/**
 * 下载并静默安装新版本（Windows NSIS /S；macOS 不支持自动安装）。
 *  Gitee raw CDN 偶尔对本机出口 IP 做访问频率限制（HTTP 403），
 *  自动下载会失败 → 提示版本过旧并打开官网让用户重新下载。 */
  async install(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("当前平台暂不支持自动安装，请前往官网手动下载");
    }
    const result = await this.check();
    if (!result.hasUpdate || !result.downloadUrl) {
      throw new Error("没有可安装的更新");
    }
    const target = path.join(
      os.tmpdir(),
      `shuntu-desktop-setup-${result.latestVersion}.exe`
    );
    logInfo("update", `开始下载更新：${result.downloadUrl} → ${target}`);
    try {
      await this.downloadFile(result.downloadUrl, target);
      const stat = fs.statSync(target);
      if (stat.size < 1024 * 1024) {
        throw new Error("下载的安装包无效（文件过小）");
      }
      logInfo("update", `下载完成（${stat.size} 字节），启动安装器…`);
      // NSIS 静默安装：/S 不弹向导；安装完成后自动启动新版本（默认行为）。
      // detached + unref：安装器独立于本进程运行，随后本应用退出。
      const child = spawn(target, ["/S"], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
      // 让渲染层有足够时间收到推送，再退出应用
      setTimeout(() => {
        app.quit();
      }, 800);
    } catch (err) {
      // 自动下载失败（Gitee CDN 限流等）：提示版本过旧 + 打开官网重新下载
      const message = err instanceof Error ? err.message : "下载更新失败";
      const isCdnLimit = /HTTP\s*403|HTTP\s*429|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(message);
      logInfo("update", `自动下载失败（${message}），isCdnLimit=${isCdnLimit}`);
      if (isCdnLimit) {
        try {
          await shell.openExternal(OFFICIAL_SITE_URL);
          logInfo("update", `已打开官网：${OFFICIAL_SITE_URL}`);
        } catch (openErr) {
          logInfo("update", `打开官网失败：${openErr instanceof Error ? openErr.message : String(openErr)}`);
        }
        throw new Error(
          `当前版本过旧，自动更新暂不可用。已为你打开官网（${OFFICIAL_SITE_URL}），请下载最新版本重新安装。`
        );
      }
      throw err;
    }
  }

  private downloadFile(url: string, target: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(target);
      let received = 0;
      let total = 0;
      const req = https.get(url, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          file.close();
          fs.unlinkSync(target);
          resolve(this.downloadFile(res.headers.location, target));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          fs.unlinkSync(target);
          reject(new Error(`下载更新失败（HTTP ${res.statusCode}）`));
          return;
        }
        total = Number(res.headers["content-length"] ?? 0);
        res.on("data", chunk => {
          received += (chunk as Buffer).length;
          if (total > 0) {
            this.push({
              phase: "downloading",
              received,
              total,
              percent: Math.min(100, Math.round((received / total) * 100))
            });
          }
        });
        res.pipe(file);
      });
      req.setTimeout(60_000, () => {
        req.destroy(new Error("下载更新超时"));
      });
      req.on("error", err => {
        file.close();
        try {
          fs.unlinkSync(target);
        } catch {
          // 清理失败可忽略
        }
        reject(err);
      });
      file.on("finish", () => file.close());
      file.on("close", () => resolve());
      file.on("error", err => {
        req.destroy();
        reject(err);
      });
    });
  }
}
