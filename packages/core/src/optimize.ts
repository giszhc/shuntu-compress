/**
 * 智能优化：按输入格式自动决定「压缩质量 / 输出格式 / 图片尺寸」。
 * 纯函数、无副作用，供主进程在智能模式下按每个文件分别决策（per-file options）。
 *
 * 设计原则：
 * - 体积优先：照片类（jpg/jpeg/tiff/bmp）与 png 统一转 WebP（有损压缩体积最小、
 *   支持透明通道，现代系统/浏览器均可直接预览）；
 * - 动图保真：gif 一律保持原格式（动画帧无法无损压缩）；
 * - 无损兜底：svg 栅格化为 png（vips 无 svgsave 算子，保持原格式也必须栅格化，
 *   故直接指定 png 无损输出，避免重复决策）；
 * - 分辨率安全：默认保持原尺寸（智能优化不擅自缩小图片，保证"压缩不糊图"）。
 */
import type { ProcessOptions, SupportedExt } from "./types.js";

/** 智能模式照片类输出质量（WebP 有损，80 平衡体积与画质） */
export const SMART_QUALITY = 80;
/** PNG 输入转 WebP 时略高一级，减少纯色/渐变区域的色带 */
export const SMART_PNG_QUALITY = 85;

/**
 * 智能模式决策。输入为文件扩展名（小写、含点），返回该文件的完整处理参数。
 * 与手动模式共用 ProcessOptions 形状，主进程可无差别交给 processImage。
 */
export function suggestSmartOptions(ext: SupportedExt): ProcessOptions {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
    case ".tiff":
    case ".tif":
    case ".bmp":
      // 照片/位图类：转 WebP 收益最大（比同质量 JPG 再小 20%-35%）
      return { quality: SMART_QUALITY, size: null, ext: ".webp" };
    case ".png":
      // PNG 可能是照片也可能是有透明通道的截图：WebP 均能覆盖（有损 + alpha）
      return { quality: SMART_PNG_QUALITY, size: null, ext: ".webp" };
    case ".gif":
      // 动图：保持格式，避免动画被压成静态帧
      return { quality: SMART_QUALITY, size: null, ext: null };
    case ".svg":
      // 矢量图：vips 只能栅格化，直接指定 png 无损输出
      return { quality: 100, size: null, ext: ".png" };
    case ".webp":
    default:
      // 已是 WebP：保持格式，仅做无损元数据剥离级别的重编码（质量 80 有损压缩）
      return { quality: SMART_QUALITY, size: null, ext: null };
  }
}
