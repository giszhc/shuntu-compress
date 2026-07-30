#!/usr/bin/env node
// 将桌面端打包产物（exe / dmg）拷贝进 docs/，并统一命名为下载页使用的文件名。
// 用法：先 pnpm dist:win 与/或 pnpm dist:mac:universal 打包，再 pnpm release:docs。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'apps', 'desktop', 'release');
const docsDir = path.join(root, 'docs');

function copyLatest(pattern, targetName) {
  if (!fs.existsSync(releaseDir)) {
    console.warn(`[release:docs] 未找到打包输出目录: ${releaseDir}`);
    console.warn('[release:docs] 请先运行 pnpm dist:win / pnpm dist:mac:universal 进行打包。');
    return false;
  }
  const candidates = fs
    .readdirSync(releaseDir)
    .filter((f) => pattern.test(f))
    .map((f) => ({ f, mtime: fs.statSync(path.join(releaseDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    console.warn(`[release:docs] 在 ${releaseDir} 中未找到匹配 ${pattern} 的安装包，跳过 ${targetName}。`);
    return false;
  }

  const src = path.join(releaseDir, candidates[0].f);
  const dest = path.join(docsDir, targetName);
  fs.mkdirSync(docsDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[release:docs] 已复制 ${candidates[0].f} -> docs/${targetName}`);
  return true;
}

const okWin = copyLatest(/^vips-thumbnail-desktop-setup-.*\.exe$/i, 'shuntu-desktop.exe');
const okMac = copyLatest(/^vips-thumbnail-desktop-.*-universal\.dmg$/i, 'shuntu-desktop.dmg');

if (!okWin || !okMac) {
  console.warn('[release:docs] 部分平台安装包缺失，请确认已打包后再提交 docs/。');
  process.exit(1);
}

console.log('[release:docs] 完成，可提交并推送 docs/ 以发布到 GitHub Pages。');
