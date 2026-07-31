/**
 * 主进程 ⇄ preload ⇄ 渲染进程共享的 IPC 类型定义。
 * 渲染进程仅能通过 preload 暴露的 window.app 访问这些能力。
 */
import type {
  FileEntry,
  InstallProgress,
  OutputExt,
  OutputMode,
  ProcessOptions,
  TaskResult,
  TaskStatus
} from "@giszhc/vips-thumbnail-core";

export type {
  FileEntry,
  InstallProgress,
  OutputExt,
  OutputMode,
  ProcessOptions,
  TaskResult,
  TaskStatus
};

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface Settings {
  /** 默认压缩质量 1-100 */
  quality: number;
  /** 默认最长边；null=保持原尺寸 */
  size: number | null;
  /** 默认输出格式；null=保持原格式 */
  ext: ".jpg" | ".png" | null;
  /** 默认递归子目录 */
  recursive: boolean;
  /** 默认保留目录结构 */
  preserveStructure: boolean;
  /** 并发数 1-4 */
  concurrency: number;
  /** 主题偏好 */
  theme: ThemePref;
  /** 固定输出目录；null=源目录旁 compressed */
  outputDir: string | null;
  /** 完成后自动打开输出目录 */
  openAfterFinish: boolean;
}

export interface VipsStatus {
  available: boolean;
  version?: string;
  path?: string;
  /** 当前平台是否支持一键安装（仅 Windows x64） */
  canAutoInstall: boolean;
  /** 不可自动安装时的中文安装指引 */
  guide?: string;
}

export interface ScanRequest {
  paths: string[];
  recursive: boolean;
}

export interface ScanProgressEvent {
  scanned: number;
  currentPath: string;
}

export interface TaskStartRequest {
  entries: FileEntry[];
  options: ProcessOptions;
  outputDir: string | null;
  mode: OutputMode;
  concurrency: number;
}

export interface TaskProgressEvent {
  taskId: string;
  done: number;
  total: number;
  percent: number;
  currentFile: string;
}

export interface TaskItemDoneEvent {
  taskId: string;
  index: number;
  result: TaskResult;
}

export interface TaskSummary {
  success: number;
  failed: number;
  skipped: number;
  canceled: number;
  originalTotal: number;
  compressedTotal: number;
  durationMs: number;
  outputDir: string;
}

export interface TaskFinishedEvent {
  taskId: string;
  summary: TaskSummary;
  results: TaskResult[];
}

export interface InstallErrorEvent {
  message: string;
  phase: string;
}

export interface ThumbnailResponse {
  dataUrl: string;
}

export interface WindowControlRequest {
  action: "min" | "max" | "close";
}

/** preload 暴露给渲染进程的完整 API 形状 */
export interface AppApi {
  /** 宿主平台（同步）；渲染层据此做平台相关 UI（如 macOS 隐藏自绘窗口控件） */
  readonly platform: NodeJS.Platform;
  // 对话框
  openFiles(): Promise<string[]>;
  openDirectory(): Promise<string | null>;
  pickOutputDirectory(): Promise<string | null>;
  // 扫描 / 文件
  scan(request: ScanRequest): Promise<FileEntry[]>;
  thumbnail(path: string): Promise<ThumbnailResponse>;
  openInExplorer(path: string): Promise<void>;
  // 任务
  startTask(request: TaskStartRequest): Promise<{ taskId: string }>;
  cancelTask(taskId: string): Promise<void>;
  // libvips
  vipsDetect(): Promise<VipsStatus>;
  vipsInstall(): Promise<{ executable: string }>;
  vipsCancelInstall(): Promise<void>;
  vipsClearCache(): Promise<void>;
  // 设置
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  // 应用 / 窗口
  getVersion(): Promise<string>;
  getSystemTheme(): Promise<ResolvedTheme>;
  windowControl(request: WindowControlRequest): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** 渲染进程把全局错误/未处理拒绝转发到主进程日志（crash.log） */
  log(message: string): Promise<boolean>;
  // 事件订阅（返回取消订阅函数）
  onScanProgress(cb: (e: ScanProgressEvent) => void): () => void;
  onTaskProgress(cb: (e: TaskProgressEvent) => void): () => void;
  onTaskItemDone(cb: (e: TaskItemDoneEvent) => void): () => void;
  onTaskFinished(cb: (e: TaskFinishedEvent) => void): () => void;
  onInstallProgress(cb: (e: InstallProgress) => void): () => void;
  onInstallError(cb: (e: InstallErrorEvent) => void): () => void;
  onSystemTheme(cb: (theme: ResolvedTheme) => void): () => void;
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
  onFilesDropped(cb: (paths: string[]) => void): () => void;
}

/** IPC channel 常量（invoke） */
export const IPC = {
  dialogOpenFiles: "dialog:openFiles",
  dialogOpenDirectory: "dialog:openDirectory",
  dialogPickOutputDir: "dialog:pickOutputDir",
  fsScan: "fs:scan",
  fsThumbnail: "fs:thumbnail",
  fsOpenInExplorer: "fs:openInExplorer",
  taskStart: "task:start",
  taskCancel: "task:cancel",
  vipsDetect: "vips:detect",
  vipsInstall: "vips:install",
  vipsCancelInstall: "vips:cancelInstall",
  vipsClearCache: "vips:clearCache",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  settingsReset: "settings:reset",
  appGetVersion: "app:getVersion",
  appGetSystemTheme: "app:getSystemTheme",
  windowControl: "window:control",
  windowIsMaximized: "window:isMaximized",
  appLog: "app:log"
} as const;

/** IPC 事件 channel 常量（主进程 → 渲染进程推送） */
export const IPC_EVENTS = {
  scanProgress: "scan:progress",
  taskProgress: "task:progress",
  taskItemDone: "task:itemDone",
  taskFinished: "task:finished",
  installProgress: "vips:install:progress",
  installError: "vips:install:error",
  systemTheme: "theme:system",
  maximizeChange: "window:maximizeChange",
  filesDropped: "files:dropped"
} as const;
