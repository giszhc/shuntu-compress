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
  ext: OutputExt | null;
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
  /** 任务名称（历史记录展示用；缺省时主进程回退为"图片优化"） */
  name?: string;
  /** true = 智能优化模式：主进程按每个文件的格式自动决定质量/格式/尺寸（忽略 options） */
  smart?: boolean;
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
  /** 任务名称（与 TaskStartRequest.name 对应，历史记录使用） */
  name?: string;
}

/** 一次压缩任务的持久化历史记录（optimization_history） */
export interface HistoryRecord {
  id: string;
  /** epoch ms */
  createTime: number;
  taskName: string;
  fileCount: number;
  beforeSize: number;
  afterSize: number;
  savedSize: number;
  savedPercent: number;
  durationMs: number;
  outputDir: string;
}

/** 历史记录聚合视图：累计数据 + 记录列表（新记录在前） */
export interface HistorySummary {
  /** 累计优化图片数量（所有记录 fileCount 之和） */
  totalCount: number;
  /** 累计节省空间（字节） */
  totalSaved: number;
  records: HistoryRecord[];
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

/** 用户反馈（渲染层 → 主进程 → SMTP 邮件） */
export interface FeedbackRequest {
  /** 称呼 */
  name: string;
  /** 联系邮箱 */
  email: string;
  /** 反馈内容，≤ 500 字 */
  content: string;
}

/** 反馈发送结果 */
export interface FeedbackResult {
  ok: boolean;
  message: string;
}

/** 更新检查结果 */
export interface UpdateCheckResult {
  /** 是否有可用更新 */
  hasUpdate: boolean;
  /** 当前版本 */
  currentVersion: string;
  /** 最新版本（无更新时为当前版本） */
  latestVersion: string;
  /** 更新说明 */
  notes?: string;
  /** 安装包下载地址（raw 直链） */
  downloadUrl?: string;
  /** 检查失败时的错误信息（成功时为空） */
  error?: string;
}

/** 更新流程状态（主进程 → 渲染进程推送） */
export type UpdateStatusEvent =
  | { phase: "checking" }
  | { phase: "none"; currentVersion: string }
  | { phase: "available"; currentVersion: string; latestVersion: string; notes?: string }
  | { phase: "downloading"; received: number; total: number; percent: number }
  | { phase: "error"; message: string };

/** preload 暴露给渲染进程的完整 API 形状 */
export interface AppApi {
  /** 宿主平台（同步）；渲染层据此做平台相关 UI（如 macOS 隐藏自绘窗口控件） */
  readonly platform: NodeJS.Platform;
  // 对话框
  openFiles(): Promise<string[]>;
  /** 选择文件夹（支持多选，返回所选目录数组） */
  openDirectory(): Promise<string[]>;
  pickOutputDirectory(): Promise<string | null>;
  // 扫描 / 文件
  scan(request: ScanRequest): Promise<FileEntry[]>;
  thumbnail(path: string): Promise<ThumbnailResponse>;
  /** 读取图片宽高（结果弹窗前后对比展示用；webp/gif 等无文件头可解析时返回 null） */
  imageInfo(path: string): Promise<{ width: number; height: number } | null>;
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
  // 历史优化记录
  getHistory(): Promise<HistorySummary>;
  clearHistory(): Promise<void>;
  // 应用 / 窗口
  getVersion(): Promise<string>;
  getSystemTheme(): Promise<ResolvedTheme>;
  windowControl(request: WindowControlRequest): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** 渲染进程把全局错误/未处理拒绝转发到主进程日志（crash.log） */
  log(message: string): Promise<boolean>;
  // 更新
  /** 检查更新（返回立即结果；后续状态经 onUpdateStatus 推送） */
  checkUpdate(): Promise<UpdateCheckResult>;
  /** 下载并安装更新（内部走静默安装后退出） */
  installUpdate(): Promise<void>;
  /** 用系统浏览器打开外部链接（官网等） */
  openExternal(url: string): Promise<void>;
  // 用户反馈
  /** 提交用户反馈（经 163 SMTP 直接发送到 shuntool@163.com） */
  sendFeedback(request: FeedbackRequest): Promise<FeedbackResult>;
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
  onUpdateStatus(cb: (e: UpdateStatusEvent) => void): () => void;
}

/** IPC channel 常量（invoke） */
export const IPC = {
  dialogOpenFiles: "dialog:openFiles",
  dialogOpenDirectory: "dialog:openDirectory",
  dialogPickOutputDir: "dialog:pickOutputDir",
  fsScan: "fs:scan",
  fsThumbnail: "fs:thumbnail",
  fsImageInfo: "fs:imageInfo",
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
  historyGet: "history:get",
  historyClear: "history:clear",
  appGetVersion: "app:getVersion",
  appGetSystemTheme: "app:getSystemTheme",
  windowControl: "window:control",
  windowIsMaximized: "window:isMaximized",
  appLog: "app:log",
  appCheckUpdate: "app:checkUpdate",
  appInstallUpdate: "app:installUpdate",
  appOpenExternal: "app:openExternal",
  feedbackSend: "feedback:send"
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
  filesDropped: "files:dropped",
  updateStatus: "update:status"
} as const;
