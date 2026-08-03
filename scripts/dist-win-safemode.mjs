#!/usr/bin/env node
/**
 * dist:win 的 360 主动防御绕过版打包。
 *
 * 背景：360 安全卫士（ZhuDongFangYu.exe）会锁定 electron-builder 解压出的
 * `win-unpacked.tmp/resources/default_app.asar`，导致 `pnpm dist:win` 在
 * `unlink/rename` 时 EBUSY 失败（用户终端和 agent 环境都复现）。
 *
 * 绕过原理：
 *   1. 用系统 tar（bsdtar，Win10+ 自带，360 不拦截）手动把 electron zip 解压到
 *      .electron-dist/（zip 在 %LOCALAPPDATA%\electron\Cache\ 已缓存）。
 *   2. electron-builder 传 -c.electronDist=<该目录>，跳过 zip 解压流程
 *      （electron-builder 自己的解压才被 360 锁定）。
 *   3. 输出到全新目录（默认 release，可通过 DIST_DIR 覆盖），避开被锁的旧残留。
 *
 * 用法：node scripts/dist-win-safemode.mjs [--clean]
 *   --clean  先尝试删除旧的 release/ 构建残留
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "apps", "desktop");
const DIST_DIR = process.env.DIST_DIR || path.join(appDir, "release");
const ELECTRON_DIST = path.join(repoRoot, ".electron-dist");

function run(cmd, cwd = appDir) {
  console.log(`[dist:safe] $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// 1. 找 electron 缓存 zip（优先 v43.2.0，与 electron-builder.yml 的 electronVersion 匹配）
const cacheDir = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "electron",
  "Cache"
);
let zipPath = null;
if (fs.existsSync(cacheDir)) {
  for (const d of fs.readdirSync(cacheDir)) {
    const p = path.join(cacheDir, d, "electron-v43.2.0-win32-x64.zip");
    if (fs.existsSync(p)) {
      zipPath = p;
      break;
    }
  }
}
if (!zipPath) {
  console.error("[dist:safe] 未找到 electron v43.2.0 缓存 zip，请先正常跑一次 pnpm dist:win 让它下载缓存。");
  process.exit(1);
}

// 2. 清理旧产物（可选）
if (process.argv.includes("--clean")) {
  for (const t of [DIST_DIR, ELECTRON_DIST]) {
    try {
      fs.rmSync(t, { recursive: true, force: true });
      console.log(`[dist:safe] 已清理 ${t}`);
    } catch {
      console.log(`[dist:safe] 清理失败（可能被 360 锁定，跳过）：${t}`);
    }
  }
}

// 3. 手动解压 electron（系统 tar，360 不拦截）
if (!fs.existsSync(path.join(ELECTRON_DIST, "electron.exe"))) {
  fs.mkdirSync(ELECTRON_DIST, { recursive: true });
  console.log(`[dist:safe] 手动解压 electron → ${ELECTRON_DIST}`);
  execSync(`tar -xf "${zipPath}" -C "${ELECTRON_DIST}"`, { stdio: "inherit" });
} else {
  console.log(`[dist:safe] 复用已解压的 electron：${ELECTRON_DIST}`);
}

// 4. 执行 electron-builder（跳过 zip 解压 + 全新输出目录）
run(`npx electron-builder --win --x64 --config electron-builder.yml -c.electronDist="${ELECTRON_DIST}" -c.directories.output="${DIST_DIR}"`);

console.log(`[dist:safe] 完成 ✅ 安装包输出目录：${DIST_DIR}`);
