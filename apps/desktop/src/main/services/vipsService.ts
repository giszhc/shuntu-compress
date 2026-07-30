/**
 * libvips 检测与 Windows 自动安装（封装 core 的 VipsDetector + installWindowsVips）。
 * 安装进度通过事件推送给渲染进程。
 */
import fs from "node:fs";
import {
  AbortError,
  InstallError,
  MISSING_VIPS_MESSAGE,
  VipsDetector,
  installWindowsVips,
  installMacOSVips,
  spawnAsync,
  buildVipsEnv,
  isAbortError
} from "@giszhc/vips-thumbnail-core";
import type { InstallErrorEvent, VipsStatus } from "../../shared/ipc-types";
import type { InstallProgress } from "@giszhc/vips-thumbnail-core";

export interface VipsServiceEvents {
  onInstallProgress: (progress: InstallProgress) => void;
  onInstallError: (error: InstallErrorEvent) => void;
}

export class VipsService {
  private detector: VipsDetector;
  private resolvedCommand: string | null = null;
  private version: string | null = null;
  private installController: AbortController | null = null;

  constructor(
    private readonly events: VipsServiceEvents,
    cacheRoot?: string
  ) {
    this.detector = new VipsDetector({ cacheRoot });
  }

  /** 当前已解析的 vips 命令（未检测/未安装时为 null） */
  get command(): string | null {
    return this.resolvedCommand;
  }

  async detect(): Promise<VipsStatus> {
    const canAutoInstall =
      (process.platform === "win32" && process.arch === "x64") ||
      (process.platform === "darwin" && this.detector.hasHomebrew());
    const found = this.detector.detect();
    if (!found) {
      this.resolvedCommand = null;
      return {
        available: false,
        canAutoInstall,
        guide: canAutoInstall
          ? undefined
          : process.platform === "darwin"
            ? "未检测到 Homebrew，请先安装 Homebrew 后重试，或手动执行 `brew install vips`。"
            : MISSING_VIPS_MESSAGE
      };
    }
    this.resolvedCommand = found;
    this.version = await this.queryVersion(found);
    return {
      available: true,
      version: this.version ?? undefined,
      path: found,
      canAutoInstall
    };
  }

  async install(): Promise<{ executable: string }> {
    if (this.installController) {
      throw new InstallError("安装正在进行中，请稍候", "precheck");
    }
    this.installController = new AbortController();
    try {
      let executable: string;
      if (process.platform === "darwin") {
        executable = await installMacOSVips({
          signal: this.installController.signal,
          onProgress: progress => this.events.onInstallProgress(progress)
        });
      } else {
        executable = await installWindowsVips({
          cacheRoot: this.detector.cacheRoot,
          signal: this.installController.signal,
          onProgress: progress => this.events.onInstallProgress(progress)
        });
      }
      this.resolvedCommand = executable;
      this.version = await this.queryVersion(executable);
      return { executable };
    } catch (error) {
      const event: InstallErrorEvent = isAbortError(error)
        ? { message: "安装已取消", phase: "canceled" }
        : {
            message: error instanceof Error ? error.message : String(error),
            phase: error instanceof InstallError ? (error.phase ?? "unknown") : "unknown"
          };
      this.events.onInstallError(event);
      throw error;
    } finally {
      this.installController = null;
    }
  }

  cancelInstall(): void {
    this.installController?.abort();
  }

  clearCache(): void {
    if (this.installController) {
      throw new InstallError("安装进行中，无法清除缓存", "precheck");
    }
    const { installRoot } = this.detector.getWindowsPaths();
    fs.rmSync(installRoot, { recursive: true, force: true });
    this.resolvedCommand = null;
    this.version = null;
  }

  /** 确保 vips 可用；不可用时抛错（由任务启动前调用） */
  async ensureReady(): Promise<string> {
    if (this.resolvedCommand) return this.resolvedCommand;
    const status = await this.detect();
    if (status.available && this.resolvedCommand) return this.resolvedCommand;
    if (status.canAutoInstall) {
      throw new InstallError("压缩引擎尚未安装，请先完成安装", "precheck");
    }
    throw new AbortError(MISSING_VIPS_MESSAGE);
  }

  private async queryVersion(command: string): Promise<string | null> {
    try {
      const result = await spawnAsync(command, ["--version"], {
        env: buildVipsEnv(command)
      });
      if (result.status === 0) {
        // 输出形如 "vips-8.18.4"
        return result.stdout.trim() || result.stderr.trim() || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
