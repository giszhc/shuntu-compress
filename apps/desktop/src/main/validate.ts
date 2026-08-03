/**
 * IPC 入参校验：所有来自渲染进程的数据必须先经此层。
 * 校验失败抛 ConfigError（中文提示），主进程 handler 直接向上抛给渲染层展示。
 */
import path from "node:path";
import {
  ConfigError,
  SUPPORTED_EXTS,
  validateConcurrency,
  validateExt,
  validateQuality,
  validateSize
} from "@giszhc/vips-thumbnail-core";
import type { SupportedExt } from "@giszhc/vips-thumbnail-core";
import type {
  FeedbackRequest,
  FileEntry,
  ProcessOptions,
  ScanRequest,
  Settings,
  TaskStartRequest,
  WindowControlRequest
} from "../shared/ipc-types";

export function assertAbsolutePath(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(`${label}不能为空`);
  }
  if (!path.isAbsolute(value)) {
    throw new ConfigError(`${label}必须是绝对路径`);
  }
  // 拒绝空字节注入
  if (value.includes("\0")) {
    throw new ConfigError(`${label}包含非法字符`);
  }
  return value;
}

export function validateScanRequest(raw: unknown): ScanRequest {
  const request = raw as Partial<ScanRequest> | null;
  if (!request || !Array.isArray(request.paths) || request.paths.length === 0) {
    throw new ConfigError("请先选择要处理的文件或文件夹");
  }
  if (request.paths.length > 10000) {
    throw new ConfigError("一次最多添加 10000 个路径");
  }
  if (request.recursive !== undefined && typeof request.recursive !== "boolean") {
    throw new ConfigError("recursive 参数必须是布尔值");
  }
  const paths = request.paths.map(p => assertAbsolutePath(p, "输入路径"));
  return { paths, recursive: request.recursive === true };
}

function validateProcessOptions(raw: unknown): ProcessOptions {
  const options = raw as Partial<ProcessOptions> | null;
  if (!options) throw new ConfigError("缺少压缩参数");
  return {
    quality: validateQuality(options.quality),
    size: validateSize(options.size),
    ext: validateExt(options.ext)
  };
}

function validateFileEntry(raw: unknown): FileEntry {
  const entry = raw as Partial<FileEntry> | null;
  if (!entry) throw new ConfigError("文件条目无效");
  const absolutePath = assertAbsolutePath(entry.absolutePath, "文件路径");
  const rootDir = assertAbsolutePath(entry.rootDir, "文件所属目录");
  const ext = String(entry.ext ?? "").toLowerCase();
  if (!SUPPORTED_EXTS.includes(ext as SupportedExt)) {
    throw new ConfigError(`不支持的图片格式：${ext || "未知"}`);
  }
  return {
    absolutePath,
    fileName: path.basename(absolutePath),
    baseName: path.basename(absolutePath, path.extname(absolutePath)),
    ext: ext as FileEntry["ext"],
    size: Number(entry.size) || 0,
    width: Number(entry.width) || 0,
    height: Number(entry.height) || 0,
    mtimeMs: Number(entry.mtimeMs) || 0,
    rootDir
  };
}

export function validateTaskStartRequest(raw: unknown): TaskStartRequest {
  const request = raw as Partial<TaskStartRequest> | null;
  if (!request || !Array.isArray(request.entries) || request.entries.length === 0) {
    throw new ConfigError("任务列表为空，请先添加图片");
  }
  const entries = request.entries.map(validateFileEntry);
  const options = validateProcessOptions(request.options);
  if (request.mode !== "flat" && request.mode !== "preserve") {
    throw new ConfigError("输出模式无效（仅支持 flat / preserve）");
  }
  const mode = request.mode;
  const concurrency = validateConcurrency(request.concurrency);
  let outputDir: string | null = null;
  if (request.outputDir !== null && request.outputDir !== undefined) {
    outputDir = assertAbsolutePath(request.outputDir, "输出目录");
  }
  return { entries, options, outputDir, mode, concurrency };
}

const THEME_VALUES = ["system", "light", "dark"] as const;

const SETTINGS_KEYS = new Set([
  "quality",
  "size",
  "ext",
  "recursive",
  "preserveStructure",
  "concurrency",
  "theme",
  "outputDir",
  "openAfterFinish"
]);

export function validateSettingsPatch(raw: unknown): Partial<Settings> {
  const patch = raw as Partial<Settings> | null;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new ConfigError("设置数据无效");
  }
  for (const key of Object.keys(patch)) {
    if (!SETTINGS_KEYS.has(key)) {
      throw new ConfigError(`未知设置项：${key}`);
    }
  }
  const result: Partial<Settings> = {};
  if ("quality" in patch) result.quality = validateQuality(patch.quality);
  if ("size" in patch) result.size = validateSize(patch.size);
  if ("ext" in patch) {
    const ext = validateExt(patch.ext);
    result.ext = ext === ".jpeg" ? ".jpg" : ext;
  }
  if ("recursive" in patch) result.recursive = patch.recursive === true;
  if ("preserveStructure" in patch) {
    result.preserveStructure = patch.preserveStructure === true;
  }
  if ("concurrency" in patch) {
    result.concurrency = validateConcurrency(patch.concurrency);
  }
  if ("theme" in patch) {
    if (!THEME_VALUES.includes(patch.theme as (typeof THEME_VALUES)[number])) {
      throw new ConfigError("主题设置无效");
    }
    result.theme = patch.theme as Settings["theme"];
  }
  if ("outputDir" in patch) {
    result.outputDir =
      patch.outputDir === null
        ? null
        : assertAbsolutePath(patch.outputDir, "输出目录");
  }
  if ("openAfterFinish" in patch) {
    result.openAfterFinish = patch.openAfterFinish === true;
  }
  return result;
}

export function validateWindowControl(raw: unknown): WindowControlRequest {
  const request = raw as Partial<WindowControlRequest> | null;
  if (!request || !["min", "max", "close"].includes(request.action ?? "")) {
    throw new ConfigError("窗口操作无效");
  }
  return { action: request.action as WindowControlRequest["action"] };
}

export function validateTaskId(raw: unknown): string {
  if (typeof raw !== "string" || !/^task-\d+$/.test(raw)) {
    throw new ConfigError("任务标识无效");
  }
  return raw;
}

/** 简单邮箱格式校验（不做 RFC 全量校验，够用且不误伤） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 30;
const EMAIL_MAX = 100;
const CONTENT_MAX = 500;

export function validateFeedbackRequest(raw: unknown): FeedbackRequest {
  const request = raw as Partial<FeedbackRequest> | null;
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new ConfigError("反馈数据无效");
  }
  const name = typeof request.name === "string" ? request.name.trim() : "";
  const email = typeof request.email === "string" ? request.email.trim() : "";
  const content = typeof request.content === "string" ? request.content.trim() : "";
  if (!name) throw new ConfigError("请填写称呼");
  if (name.length > NAME_MAX) throw new ConfigError(`称呼最多 ${NAME_MAX} 个字`);
  if (!email) throw new ConfigError("请填写邮箱");
  if (email.length > EMAIL_MAX) throw new ConfigError("邮箱地址过长");
  if (!EMAIL_RE.test(email)) throw new ConfigError("邮箱格式不正确");
  if (!content) throw new ConfigError("请填写反馈内容");
  if (content.length > CONTENT_MAX) {
    throw new ConfigError(`反馈内容最多 ${CONTENT_MAX} 字`);
  }
  return { name, email, content };
}
