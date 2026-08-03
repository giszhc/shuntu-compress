/**
 * 支持的输入格式白名单（稳定可靠优先：全部经加载+保存闭环实测）。
 * - heic/heif 已过滤：heif 解码未验证且无法输出，"保持原格式"语义会破裂。
 * - svg：vips 可读（librsvg）但无保存算子，故 svg 输入默认栅格化为 .png 输出
 *   （见 output.ts resolveTargetExt 的回退逻辑），"保持原格式"对 svg 不成立。
 */
export type SupportedExt =
  | ".jpg"
  | ".jpeg"
  | ".png"
  | ".webp"
  | ".gif"
  | ".tiff"
  | ".tif"
  | ".bmp"
  | ".svg";

/** 输出扩展名：--ext 允许 .jpg/.jpeg/.png/.webp/.gif/.tiff/.ico，与 CLI 协议保持一致 */
export type OutputExt =
  | ".jpg"
  | ".jpeg"
  | ".png"
  | ".webp"
  | ".gif"
  | ".tiff"
  | ".ico";

/** 输出目录模式：CLI 为拍平（flat），桌面端默认保留相对结构（preserve） */
export type OutputMode = "flat" | "preserve";

export interface ProcessOptions {
  /**
   * 1-100，对 JPG / PNG 输出均有效：
   * - JPG 为有损压缩，值越低体积越小；
   * - PNG 为无损格式，仅当值 < 100 时启用调色板量化（对截图/图标/插画最有效）。
   */
  quality: number;
  /** 最长边尺寸；null 表示保持原尺寸 */
  size: number | null;
  /** 输出格式；null 表示保持原格式 */
  ext: OutputExt | null;
}

export interface FileEntry {
  absolutePath: string;
  /** 文件名（含扩展名） */
  fileName: string;
  /** 不含扩展名的基础名 */
  baseName: string;
  ext: SupportedExt;
  /** 字节 */
  size: number;
  width: number;
  height: number;
  mtimeMs: number;
  /** 所属扫描根目录（目录拖入时用于计算相对路径），文件直接添加时为其所在目录 */
  rootDir: string;
  /** true 表示来自文件夹扫描（用于 UI 按文件夹聚合展示） */
  fromDir?: boolean;
}

export type TaskStatus =
  | "pending"
  | "processing"
  | "done"
  | "skipped"
  | "failed"
  | "canceled";

export interface TaskResult {
  input: string;
  output: string;
  status: TaskStatus;
  originalSize: number;
  compressedSize: number;
  error?: string;
}

export interface ScanOptions {
  recursive: boolean;
  /**
   * true 时跳过解析图片宽高（width/height 置 0）。
   * 大批量文件时逐个读取图片头开销显著，桌面端列表不展示尺寸时应开启。
   */
  skipImageInfo?: boolean;
}

export interface QueueOptions {
  concurrency: number;
  signal?: AbortSignal;
}

export type InstallPhase = "download" | "verify" | "extract" | "finalize";

export interface InstallProgress {
  phase: InstallPhase;
  received: number;
  total: number;
  /** 0-100，仅下载阶段有精确值，其余阶段为阶段性数值 */
  percent: number;
}
