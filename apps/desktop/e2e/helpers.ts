/**
 * e2e 公共工具：启动 Electron 应用、准备测试图片。
 */
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const APP_ROOT = resolve(__dirname, "..");

export interface LaunchOptions {
  theme?: "light" | "dark";
  extraArgs?: string[];
}

export async function launchApp(
  options: LaunchOptions = {}
): Promise<{ app: ElectronApplication; page: Page; userDataDir: string }> {
  const userDataDir = mkdtempSync(join(tmpdir(), "vips-desktop-e2e-"));
  const args = [
    join(APP_ROOT, "out", "main", "index.js"),
    `--user-data-dir=${userDataDir}`,
    // 测试环境禁用托盘拦截，保证窗口关闭即退出
    "--no-tray"
  ];
  if (options.theme) args.push(`--force-theme=${options.theme}`);
  if (options.extraArgs) args.push(...options.extraArgs);

  const app = await electron.launch({ args, cwd: APP_ROOT });
  const page = await app.firstWindow();
  await page.waitForSelector(".app-shell .titlebar", { timeout: 30_000 });
  return { app, page, userDataDir };
}

/**
 * 生成测试图片目录（含中文/空格路径、子目录）。
 * 依赖 vips CLI（M1 已缓存于 %LOCALAPPDATA%），失败则退回复制项目内测试资产。
 */
export function makeTestImages(): string {
  const root = mkdtempSync(join(tmpdir(), "vips-e2e-图片 集-"));
  const sub = join(root, "子目录 A");
  mkdirSync(sub, { recursive: true });

  const fixtures = join(APP_ROOT, "e2e", "fixtures");
  if (existsSync(fixtures)) {
    let i = 0;
    for (const f of readdirSync(fixtures)) {
      const target = i % 2 === 0 ? root : sub;
      copyFileSync(join(fixtures, f), join(target, f));
      i += 1;
    }
    return root;
  }

  // 兜底：用 PowerShell + .NET 画两张 PNG（无需外部依赖）
  const script = `
Add-Type -AssemblyName System.Drawing
function New-Img([string]$Path, [int]$W, [int]$H) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::CornflowerBlue)
  $g.FillEllipse([System.Drawing.Brushes]::Orange, 10, 10, $W - 20, $H - 20)
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
New-Img "${root.replaceAll("\\", "\\\\")}\\\\测试 大图.png" 1600 1200
New-Img "${sub.replaceAll("\\", "\\\\")}\\\\小图.png" 320 240
`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8"
  });
  if (r.status !== 0) {
    throw new Error(`生成测试图片失败: ${r.stderr}`);
  }
  return root;
}
