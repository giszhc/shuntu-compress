/**
 * 以 build/icon.svg 为唯一源文件，生成打包使用的 PNG、多尺寸 ICO 与 macOS ICNS。
 * 用法：node scripts/make-icon.mjs
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(currentDir, "..", "build");
const svgPath = join(outDir, "icon.svg");
const pngPath = join(outDir, "icon.png");
const icoPath = join(outDir, "icon.ico");
const icnsPath = join(outDir, "icon.icns");

mkdirSync(outDir, { recursive: true });

if (!existsSync(svgPath)) {
  throw new Error(`未找到 SVG 图标源文件：${svgPath}`);
}

function canRun(command) {
  if (command.includes(":\\") || command.startsWith("/")) {
    return existsSync(command);
  }
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    windowsHide: true
  });
  return !result.error;
}

function findBrowser() {
  const candidates = [
    process.env.ICON_RENDERER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "microsoft-edge",
    "google-chrome",
    "chromium",
    "chromium-browser"
  ].filter(Boolean);

  return candidates.find(canRun) || null;
}

const browser = findBrowser();
if (!browser) {
  throw new Error(
    "未找到 Edge、Chrome 或 Chromium。可以通过 ICON_RENDERER 环境变量指定浏览器路径。"
  );
}

/** 用无头浏览器把 SVG 渲染成指定尺寸 PNG */
function renderPng(size, targetPath) {
  const profileDir = mkdtempSync(join(tmpdir(), "vips-thumbnail-icon-"));
  try {
    rmSync(targetPath, { force: true });
    const result = spawnSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--default-background-color=00000000",
        "--force-device-scale-factor=1",
        `--window-size=${size},${size}`,
        `--user-data-dir=${profileDir}`,
        `--screenshot=${targetPath}`,
        pathToFileURL(svgPath).href
      ],
      {
        stdio: "inherit",
        windowsHide: true,
        timeout: 20000,
        killSignal: "SIGKILL"
      }
    );

    // 某些 Edge 版本在截图成功后仍返回非零退出码，因此以产物为最终依据。
    if (!existsSync(targetPath)) {
      throw result.error || new Error(`SVG 渲染失败（${size}px），退出码：${result.status ?? "未知"}`);
    }
  } finally {
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Chromium 子进程可能短暂占用缓存目录，不影响图标产物。
    }
  }
}

/**
 * 生成渲染进程标题栏 logo（64px）：macOS 用系统 sips 从 1024px 主图缩放（可靠、零依赖）；
 * 其他平台无 sips，跳过（保留仓库中已有的有效 app-icon.png）。
 */
function makeRendererAppIcon() {
  const dstPath = join(currentDir, "..", "src", "renderer", "src", "assets", "app-icon.png");
  if (process.platform === "darwin") {
    const result = spawnSync("sips", ["-z", "64", "64", pngPath, "--out", dstPath], {
      stdio: "ignore"
    });
    if (result.status !== 0) {
      throw new Error(`sips 生成 app-icon.png 失败，退出码：${result.status ?? "未知"}`);
    }
  } else {
    console.log(`非 macOS 平台：跳过 app-icon.png 生成（${dstPath} 保持现有文件不变）`);
  }
}

/**
 * 生成 ICNS：容器格式为 "icns" + 总长度 + 若干 (OSType + 长度 + PNG 数据) 条目。
 * 现代 macOS 支持 PNG 载荷的条目类型。
 * 注意：此手工拼接方案在 Launchpad/Dock 上渲染不完整（只显示局部），
 * 仅作历史参考，当前代码已不再调用（非 macOS 平台直接跳过 ICNS 生成）。
 */
function buildIcns(entries) {
  const chunks = entries.map(({ type, data }) => {
    const header = Buffer.alloc(8);
    header.write(type, 0, "ascii");
    header.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([header, data]);
  });
  const body = Buffer.concat(chunks);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, "ascii");
  fileHeader.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([fileHeader, body]);
}

/**
 * macOS 专用：用系统 sips + iconutil 从 1024px 主图生成标准 ICNS。
 * 这是 Apple 官方工具链，保证 Launchpad / Dock / Finder 全部正确显示。
 */
function buildIcnsWithIconutil(sourcePng, targetIcns) {
  const iconsetDir = join(outDir, "icon.iconset");
  rmSync(iconsetDir, { recursive: true, force: true });
  mkdirSync(iconsetDir, { recursive: true });

  const variants = [
    { name: "icon_16x16.png", size: 16 },
    { name: "icon_16x16@2x.png", size: 32 },
    { name: "icon_32x32.png", size: 32 },
    { name: "icon_32x32@2x.png", size: 64 },
    { name: "icon_128x128.png", size: 128 },
    { name: "icon_128x128@2x.png", size: 256 },
    { name: "icon_256x256.png", size: 256 },
    { name: "icon_256x256@2x.png", size: 512 },
    { name: "icon_512x512.png", size: 512 },
    { name: "icon_512x512@2x.png", size: 1024 }
  ];

  for (const { name, size } of variants) {
    const result = spawnSync(
      "sips",
      ["-z", String(size), String(size), sourcePng, "--out", join(iconsetDir, name)],
      { stdio: "ignore" }
    );
    if (result.status !== 0) {
      throw new Error(`sips 缩放失败（${size}px），退出码：${result.status ?? "未知"}`);
    }
  }

  const result = spawnSync("iconutil", ["-c", "icns", iconsetDir, "-o", targetIcns], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`iconutil 生成 ICNS 失败，退出码：${result.status ?? "未知"}`);
  }
  rmSync(iconsetDir, { recursive: true, force: true });
}

// 1) 渲染各尺寸 PNG（1024 为主图标，其余用于 ICNS）
const icnsSizes = [
  { size: 128, type: "ic07" },
  { size: 256, type: "ic08" },
  { size: 512, type: "ic09" },
  { size: 1024, type: "ic10" }
];

renderPng(1024, pngPath);

const icnsEntries = [];
for (const { size, type } of icnsSizes) {
  if (size === 1024) {
    icnsEntries.push({ type, data: readFileSync(pngPath) });
    continue;
  }
  const tmpPng = join(outDir, `icon-${size}.png`);
  renderPng(size, tmpPng);
  icnsEntries.push({ type, data: readFileSync(tmpPng) });
  rmSync(tmpPng, { force: true });
}

// 2) ICO（Windows）
const { default: pngToIco } = await import("png-to-ico");
const ico = await pngToIco(pngPath);
writeFileSync(icoPath, ico);

// 2.5) 渲染进程标题栏 logo（64px，随系统图标同步）
// 注意：无头浏览器在极小窗口（如 64x64）下截图不可靠，会生成全透明 PNG，
// 因此 macOS 上用 sips 从已渲染的 1024px 主图缩放，保证内容正确。
makeRendererAppIcon();

// 3) ICNS（macOS）：仅在 macOS 上生成，使用 Apple 官方 iconutil（sips + iconutil）。
// 其他平台（Windows/Linux）没有 iconutil，且手工拼接的 ICNS 在 Launchpad/Dock 上
// 渲染不完整（启动台只显示一角、程序坞显示 Electron 默认图标），会污染仓库图标。
// 因此非 macOS 平台跳过 ICNS 生成，保留仓库中已有的有效 icon.icns。
if (process.platform === "darwin") {
  buildIcnsWithIconutil(pngPath, icnsPath);
} else {
  console.log(`非 macOS 平台：跳过 ICNS 生成（${icnsPath} 保持现有文件不变）`);
}

console.log(`图标源文件：${svgPath}`);
console.log(`已生成 PNG：${pngPath}`);
console.log(`已生成 ICO：${icoPath}`);
console.log(`已生成 ICNS：${icnsPath}`);
