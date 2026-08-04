/**
 * 优化评分系统（渲染层纯函数）：
 * 根据 压缩比例 / 格式优化 / 分辨率（占位维度） 综合打分，映射到
 * 优秀（90-100）/ 良好（70-90）/ 一般（50-70）/ 建议重新优化（<50）。
 *
 * 分数构成：
 * - 体积（0-60）：节省比例越高分越高，90% 节省封顶；
 * - 格式（0-25）：转换到更优格式（WebP 等）加分，保持原格式中等分，退化格式低分；
 * - 分辨率（0-15）：智能模式不缩放（保真）视为满分，保留扩展位。
 * 未变小甚至膨胀时强制压到 30 分以下，确保"没优化到"不被误判为成功。
 */

export type ScoreLevel = "excellent" | "good" | "fair" | "poor";

export interface OptimizationScore {
  /** 0-100 */
  score: number;
  level: ScoreLevel;
  /** 中文等级文案 */
  label: string;
  /** 1-5 星 */
  stars: number;
}

export interface ScoreInput {
  originalSize: number;
  compressedSize: number;
  /** 输出格式是否不同于输入格式 */
  formatChanged: boolean;
  /** 输出是否为体积更优的格式（.webp 最优；输入非 jpg 时 .jpg 也算优化） */
  formatOptimized: boolean;
}

/** 体积分满档所需节省比例（%） */
const VOLUME_FULL_SAVED = 70;
/** 未变小（或膨胀）时的强制上限，保证这类结果落在"建议重新优化"区间 */
const NO_GAIN_CAP = 30;

export function isOptimizedFormat(ext: string): boolean {
  const normalized = ext.toLowerCase();
  // WebP 是体积最优格式；JPG（相对 PNG/TIFF/BMP 等）也是明显优化方向
  return normalized === ".webp" || normalized === ".jpg" || normalized === ".jpeg";
}

export function computeScore(input: ScoreInput): OptimizationScore {
  const { originalSize, compressedSize, formatChanged, formatOptimized } = input;

  let score: number;
  if (!Number.isFinite(originalSize) || originalSize <= 0) {
    score = 0;
  } else {
    const savedPercent = ((originalSize - compressedSize) / originalSize) * 100;
    // 体积分：0%→0，70%→60（满档）
    const volume = 60 * Math.min(1, Math.max(0, savedPercent) / VOLUME_FULL_SAVED);
    // 格式分：转换到更优格式 +25；保持原格式 +15；退化（如转 TIFF/BMP）仅 +5
    const format = formatChanged ? (formatOptimized ? 25 : 5) : 15;
    // 分辨率分：当前版本不采集输出分辨率，智能模式默认不缩放（保真），给满分
    const resolution = 15;
    score = Math.round(volume + format + resolution);
    // 未变小甚至膨胀：体积分未产生收益，强制压入"建议重新优化"
    if (savedPercent <= 0) {
      score = Math.min(score, NO_GAIN_CAP);
    }
  }
  score = Math.max(0, Math.min(100, score));

  if (score >= 90) {
    return { score, level: "excellent", label: "优秀", stars: 5 };
  }
  if (score >= 70) {
    return { score, level: "good", label: "良好", stars: 4 };
  }
  if (score >= 50) {
    return { score, level: "fair", label: "一般", stars: 3 };
  }
  return { score, level: "poor", label: "建议重新优化", stars: 2 };
}
