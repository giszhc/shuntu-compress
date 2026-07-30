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
  options: ProcessOptions
): VipsStep[] | null {
  const outExt = path.extname(output).toLowerCase();
  const inputExt = path.extname(input).toLowerCase();
  const sameFormat = inputExt === outExt;

  // 原尺寸 + 保持原格式 + 最高质量：直接复制原图。
  // 不缩放且质量为 100 时重新编码既无法变小，又会引入代际损失，故跳过编码。
  if (!options.size && sameFormat && options.quality >= 100) {
    return null;
  }

  const steps: VipsStep[] = [];
  if (options.size) {
    steps.push({ args: ["thumbnail", input, temporary, String(options.size)] });
  } else {
    steps.push({ args: ["resize", input, temporary, "1"] });
  }

  if (outExt === ".jpg" || outExt === ".jpeg") {
    // --optimize-coding 计算最优 Huffman 表，在不损失画质的前提下进一步减小体积
    steps.push({
      args: [
        "jpegsave",
        temporary,
        output,
        `--Q=${options.quality}`,
        "--strip",
        "--optimize-coding"
      ]
    });
  } else if (outExt === ".png") {
    // PNG 是无损格式：quality < 100 时启用调色板量化（palette），对色彩较少的
    // 图像（截图 / 图标 / 插画）有效；照片类图像量化后体积基本不变甚至变差，
    // 由 processImage 的“重新编码后未变小则保留原图”兜底，避免画质劣化却无收益。
    const pngArgs = ["pngsave", temporary, output];
    if (options.quality < 100) {
      pngArgs.push("--palette", `--Q=${options.quality}`);
    } else {
      pngArgs.push("--Q=100");
    }
    steps.push({ args: pngArgs });
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
  const steps = buildVipsSteps(input, output, temporary, options);

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
  } finally {
    fs.rmSync(temporary, { force: true });
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
  const steps = buildVipsSteps(input, output, temporary, options);

  if (steps === null) {
    fs.copyFileSync(input, output);
    return;
  }

  const env = buildVipsEnv(options.vipsCommand);
  try {
    for (const step of steps) {
      spawnSyncChecked(options.vipsCommand, step.args, env);
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }

  // 原尺寸 + 同格式：重新编码后未变小则保留原图，避免体积膨胀或画质劣化
  if (shouldKeepOriginal(input, output, options)) {
    fs.copyFileSync(input, output);
  }
}
