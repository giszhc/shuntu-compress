import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConfigError } from "./errors.js";
import { buildVipsEnv, spawnAsync, spawnSyncChecked } from "./spawn.js";
import { VipsError } from "./errors.js";
import type { ProcessOptions } from "./types.js";

export interface ProcessImageOptions extends ProcessOptions {
  vipsCommand: string;
  signal?: AbortSignal;
}

interface VipsStep {
  args: string[];
}

/** 生成处理步骤（纯函数，便于测试）；返回 null 表示直接复制（无损且不缩放场景） */
export function buildVipsSteps(
  input: string,
  output: string,
  temporary: string,
  options: ProcessOptions,
  /**
   * vips 实际写入的最终产物路径。默认与 output 相同；
   * processImage 会传入一个不带图片扩展名的临时路径，写完后由本进程改名落盘。
   * 详见 makeFinalTemporaryPath 的说明。
   */
  finalTarget: string = output
): VipsStep[] | null {
  const outExt = path.extname(output).toLowerCase();
  const inputExt = path.extname(input).toLowerCase();
  const sameFormat = inputExt === outExt;

  // 原尺寸 + 保持原格式 + 最高质量：直接复制原图。
  // 不缩放且质量为 100 时重新编码既无法变小，又会引入代际损失，故跳过编码。
  if (!options.size && sameFormat && options.quality >= 100) {
    return null;
  }

  // ICO 容器单图最大 256×256（ICO 目录项用 1 字节存边长，0 表示 256）。
  // ImageMagick 超过该尺寸会拒绝（WidthOrHeightExceedsLimit / PNG32 编码失败），
  // 故 ICO 输出时把最长边缩放到 ≤256；用户指定更小尺寸则尊重该尺寸。
  const ICO_MAX = 256;
  const ICO_DEFAULT = 64;
  const effectiveSize =
    outExt === ".ico"
      ? options.size == null
        ? ICO_DEFAULT
        : options.size <= ICO_MAX
          ? options.size
          : ICO_MAX
      : options.size;

  const steps: VipsStep[] = [];
  if (effectiveSize != null) {
    steps.push({ args: ["thumbnail", input, temporary, String(effectiveSize)] });
  } else {
    steps.push({ args: ["resize", input, temporary, "1"] });
  }

  if (outExt === ".jpg" || outExt === ".jpeg") {
    // --optimize-coding 计算最优 Huffman 表，在不损失画质的前提下进一步减小体积
    steps.push({
      args: [
        "jpegsave",
        temporary,
        finalTarget,
        `--Q=${options.quality}`,
        "--strip",
        "--optimize-coding"
      ]
    });
  } else if (outExt === ".png") {
    // PNG 是无损格式：quality < 100 时启用调色板量化（palette），对色彩较少的
    // 图像（截图 / 图标 / 插画）有效；照片类图像量化后体积基本不变甚至变差，
    // 由 processImage 的“重新编码后未变小则保留原图”兜底，避免画质劣化却无收益。
    const pngArgs = ["pngsave", temporary, finalTarget];
    if (options.quality < 100) {
      pngArgs.push("--palette", `--Q=${options.quality}`);
    } else {
      pngArgs.push("--Q=100");
    }
    steps.push({ args: pngArgs });
  } else if (outExt === ".webp") {
    // WebP：有损压缩，--Q 语义与 JPG 一致；--keep none 剥离元数据减小体积
    steps.push({
      args: [
        "webpsave",
        temporary,
        finalTarget,
        `--Q=${options.quality}`,
        "--keep",
        "none"
      ]
    });
  } else if (outExt === ".gif") {
    // GIF 为 256 色调色板格式（8 位索引），无质量参数；--dither 默认开启抗色带
    steps.push({ args: ["gifsave", temporary, finalTarget] });
  } else if (outExt === ".tiff" || outExt === ".tif") {
    // TIFF：JPEG 压缩（有损，--Q 生效），兼顾体积与兼容性
    steps.push({
      args: [
        "tiffsave",
        temporary,
        finalTarget,
        "--compression",
        "jpeg",
        `--Q=${options.quality}`
      ]
    });
  } else if (outExt === ".ico") {
    // ICO：Windows 图标容器，单图最大 256×256（上方已缩放）。
    // 用 --format ico 显式指定格式，避免最终临时文件 .tmp 扩展名被 ImageMagick 误判。
    steps.push({ args: ["magicksave", temporary, finalTarget, "--format", "ico"] });
  } else if (outExt === ".bmp") {
    // BMP 无压缩概念，经 ImageMagick 写出（保持原格式时的直通路径）
    steps.push({ args: ["magicksave", temporary, finalTarget] });
  } else {
    throw new VipsError(`不支持的输出格式：${outExt}`);
  }
  return steps;
}

/**
 * 原尺寸且保持原格式时，若重新编码后体积未变小，则保留原图。
 * 这能避免两类问题：
 *  - JPG 原尺寸重编码后体积反而大于原图（不同编码器/Huffman 表导致）；
 *  - PNG 照片类图像启用调色板后画质劣化但体积未减。
 * 仅在“未缩放 + 同格式”时生效；缩放或格式转换属于主动操作，不做回退。
 */
function shouldKeepOriginal(
  input: string,
  output: string,
  options: ProcessOptions
): boolean {
  if (options.size !== null) return false;
  const inputExt = path.extname(input).toLowerCase();
  const outputExt = path.extname(output).toLowerCase();
  if (inputExt !== outputExt) return false;
  let inSize: number;
  let outSize: number;
  try {
    inSize = fs.statSync(input).size;
    outSize = fs.statSync(output).size;
  } catch {
    return false;
  }
  return outSize >= inSize;
}

function makeTemporaryPath(output: string): string {
  // 中间文件必须有合法图片扩展名，否则 vips 无法推断目标格式而直接退出码 1
  // （VipsForeignSave: "...tmp" is not a known file format）。
  // 统一用 .png（无损且 vips 必然支持），最终保存步骤再按目标格式编码。
  return `${output}.v-${process.pid}-${crypto.randomBytes(4).toString("hex")}.png`;
}

/**
 * vips 最终产物的落地临时路径（不带图片扩展名）。
 *
 * 背景：部分国产安全软件（如 360 主动防御）会拦截「未签名进程直接创建 .jpg 文件」，
 * 且拦截是静默的——vips.exe 退出码仍为 0，但文件根本没落盘，后续 stat 报 ENOENT。
 * 实测同一条 jpegsave 写 .jpeg / .bin 都正常，只有 .jpg 被拦。
 *
 * 规避方式：让 vips 写到一个中性扩展名（.tmp）的文件，再由本进程 rename 成目标
 * 文件名。jpegsave / pngsave 都是显式指定编码器的算子，不依赖输出扩展名推断格式。
 */
function makeFinalTemporaryPath(output: string): string {
  return `${output}.vout-${process.pid}-${crypto.randomBytes(4).toString("hex")}.tmp`;
}

/** 把 vips 产物移动到最终路径；跨设备等异常场景回退为复制 */
async function commitOutput(finalTemporary: string, output: string): Promise<void> {
  try {
    await fs.promises.rename(finalTemporary, output);
  } catch {
    await fs.promises.copyFile(finalTemporary, output);
    fs.rmSync(finalTemporary, { force: true });
  }
}

function commitOutputSync(finalTemporary: string, output: string): void {
  try {
    fs.renameSync(finalTemporary, output);
  } catch {
    fs.copyFileSync(finalTemporary, output);
    fs.rmSync(finalTemporary, { force: true });
  }
}

function assertNotOverwritingInput(input: string, output: string): void {
  if (path.resolve(input) === path.resolve(output)) {
    throw new ConfigError("输出路径与原图相同，已阻止覆盖原图");
  }
}

/** 异步处理单张图片（桌面端使用），支持 AbortSignal 取消，临时文件必清理 */
export async function processImage(
  input: string,
  output: string,
  options: ProcessImageOptions
): Promise<void> {
  assertNotOverwritingInput(input, output);
  const temporary = makeTemporaryPath(output);
  const finalTemporary = makeFinalTemporaryPath(output);
  const steps = buildVipsSteps(input, output, temporary, options, finalTemporary);

  if (steps === null) {
    await fs.promises.copyFile(input, output);
    return;
  }

  const env = buildVipsEnv(options.vipsCommand);
  try {
    for (const step of steps) {
      const result = await spawnAsync(options.vipsCommand, step.args, {
        env,
        signal: options.signal
      });
      if (result.status !== 0) {
        throw new VipsError(
          `压缩引擎执行失败，退出码：${result.status}\n${result.stderr.trim()}`,
          result.stderr.trim()
        );
      }
    }
    if (!fs.existsSync(finalTemporary)) {
      // 退出码为 0 却没有产物：多半是安全软件静默拦截了文件创建
      throw new VipsError(
        "压缩引擎已执行完成但未生成输出文件。这通常是安全软件（如 360 安全卫士）" +
          "拦截了本程序创建文件，请将本程序加入信任名单后重试。"
      );
    }
    await commitOutput(finalTemporary, output);
  } finally {
    fs.rmSync(temporary, { force: true });
    fs.rmSync(finalTemporary, { force: true });
  }

  // 原尺寸 + 同格式：重新编码后未变小则保留原图，避免体积膨胀或画质劣化
  if (shouldKeepOriginal(input, output, options)) {
    await fs.promises.copyFile(input, output);
  }
}

/** 同步处理单张图片（CLI 使用），行为与现有 CLI 完全一致 */
export function processImageSync(
  input: string,
  output: string,
  options: Omit<ProcessImageOptions, "signal">
): void {
  const temporary = makeTemporaryPath(output);
  const finalTemporary = makeFinalTemporaryPath(output);
  const steps = buildVipsSteps(input, output, temporary, options, finalTemporary);

  if (steps === null) {
    fs.copyFileSync(input, output);
    return;
  }

  const env = buildVipsEnv(options.vipsCommand);
  try {
    for (const step of steps) {
      spawnSyncChecked(options.vipsCommand, step.args, env);
    }
    if (!fs.existsSync(finalTemporary)) {
      throw new VipsError(
        "压缩引擎已执行完成但未生成输出文件。这通常是安全软件（如 360 安全卫士）" +
          "拦截了本程序创建文件，请将本程序加入信任名单后重试。"
      );
    }
    commitOutputSync(finalTemporary, output);
  } finally {
    fs.rmSync(temporary, { force: true });
    fs.rmSync(finalTemporary, { force: true });
  }

  // 原尺寸 + 同格式：重新编码后未变小则保留原图，避免体积膨胀或画质劣化
  if (shouldKeepOriginal(input, output, options)) {
    fs.copyFileSync(input, output);
  }
}
