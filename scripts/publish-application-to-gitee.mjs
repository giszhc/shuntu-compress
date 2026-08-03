#!/usr/bin/env node
/**
 * publish:application — 把打好的安装包提交并推送到 Gitee
 *
 * 流程：
 *   1. 在 apps/desktop/release/ 找出构建产物
 *        - Windows: vips-thumbnail-desktop-setup-*.exe  → 重命名为 shuntu-desktop.exe
 *        - macOS:   vips-thumbnail-desktop-*-*.dmg      → 重命名为 shuntu-desktop.dmg
 *   2. 确保本地有 giszhc/application-software 的 git 克隆（没有就 clone）
 *   3. 把安装包拷进仓库的 <GITEE_SUBDIR>（默认「瞬图压缩」）目录
 *   4. git add / commit / push 到 <GITEE_BRANCH>（默认 main）
 *
 * 设计原则：克隆是「发布专用」的工作副本，每次先 reset --hard 到远端再拷包，
 * 因此工作树始终干净，不会出现本地脏改导致 push 失败。
 *
 * 环境变量（均可选，已带默认值）：
 *   GITEE_REPO      仓库地址，默认 git@gitee.com:giszhc/application-software.git
 *   GITEE_LOCAL_DIR 本地克隆路径，默认 <项目根>/../application-software
 *   GITEE_BRANCH    推送分支，默认 main
 *   GITEE_SUBDIR    安装包所在子目录，默认 瞬图压缩
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ---- 可配置项 ----
const GITEE_REPO = process.env.GITEE_REPO || 'git@gitee.com:giszhc/application-software.git';
const GITEE_LOCAL_DIR = process.env.GITEE_LOCAL_DIR
  ? path.resolve(process.env.GITEE_LOCAL_DIR)
  : path.resolve(repoRoot, '..', 'application-software');
const GITEE_BRANCH = process.env.GITEE_BRANCH || 'main';
const GITEE_SUBDIR = process.env.GITEE_SUBDIR || '瞬图压缩';

const releaseDir = path.join(repoRoot, 'apps', 'desktop', 'release');

// ---- 工具函数 ----
function log(msg) {
  console.log(`[publish:application] ${msg}`);
}
function run(cmd, cwd = repoRoot) {
  return execSync(cmd, { cwd, stdio: 'inherit' });
}
function findArtifact(regex) {
  if (!fs.existsSync(releaseDir)) return null;
  const matches = fs
    .readdirSync(releaseDir)
    .filter((f) => regex.test(f))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(releaseDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length ? matches[0].name : null;
}

// ---- 1. 找构建产物 ----
if (!fs.existsSync(releaseDir)) {
  console.error(`[publish:application] 找不到构建目录：${releaseDir}`);
  console.error('[publish:application] 请先运行 pnpm dist:win / pnpm dist:mac:* 打包。');
  process.exit(1);
}

const winArtifact = findArtifact(/^vips-thumbnail-desktop-setup-.*\.exe$/);
const macArtifact = findArtifact(/^vips-thumbnail-desktop-.*\.dmg$/);

const toPublish = [];
if (winArtifact) toPublish.push({ src: winArtifact, dst: 'shuntu-desktop.exe', label: 'Windows' });
if (macArtifact) toPublish.push({ src: macArtifact, dst: 'shuntu-desktop.dmg', label: 'macOS' });

if (toPublish.length === 0) {
  console.error(`[publish:application] release/ 下没有任何安装包（期望 vips-thumbnail-desktop-setup-*.exe 或 *.dmg）。`);
  console.error('[publish:application] 请先运行 pnpm dist:win / pnpm dist:mac:* 打包。');
  process.exit(1);
}

log(`检出构建产物：${toPublish.map((p) => `${p.label}=${p.src}`).join(', ')}`);

// ---- 2. 确保本地克隆 ----
if (!fs.existsSync(path.join(GITEE_LOCAL_DIR, '.git'))) {
  log(`本地克隆不存在，开始 clone ${GITEE_REPO} → ${GITEE_LOCAL_DIR}`);
  fs.mkdirSync(path.dirname(GITEE_LOCAL_DIR), { recursive: true });
  run(`git clone --branch ${GITEE_BRANCH} --single-branch ${GITEE_REPO} "${GITEE_LOCAL_DIR}"`);
} else {
  log(`使用已有本地克隆：${GITEE_LOCAL_DIR}`);
}

// 同步到远端最新（发布专用副本，直接 reset --hard 保证工作树干净）
log(`同步到 origin/${GITEE_BRANCH} 最新`);
run(`git -C "${GITEE_LOCAL_DIR}" fetch origin ${GITEE_BRANCH}`);
run(`git -C "${GITEE_LOCAL_DIR}" checkout ${GITEE_BRANCH}`);
run(`git -C "${GITEE_LOCAL_DIR}" reset --hard origin/${GITEE_BRANCH}`);

// ---- 3. 拷贝安装包 ----
const destDir = path.join(GITEE_LOCAL_DIR, GITEE_SUBDIR);
fs.mkdirSync(destDir, { recursive: true });

for (const p of toPublish) {
  const src = path.join(releaseDir, p.src);
  const dst = path.join(destDir, p.dst);
  fs.copyFileSync(src, dst);
  log(`已拷贝 ${p.src} → ${GITEE_SUBDIR}/${p.dst}`);
}

// ---- 4. 提交并推送 ----
// 仅暂存安装包子目录，不影响仓库其他内容
run(`git -C "${GITEE_LOCAL_DIR}" add "${GITEE_SUBDIR}"`);

const diffStat = execSync(
  `git -C "${GITEE_LOCAL_DIR}" diff --cached --name-only`,
  { encoding: 'utf8' }
).trim();

if (!diffStat) {
  log('安装包与远端一致，无需提交。');
  process.exit(0);
}

const platforms = toPublish.map((p) => p.label).join('+');
const commitMsg = `publish: 更新瞬图压缩安装包 (${platforms})`;
run(`git -C "${GITEE_LOCAL_DIR}" commit -m "${commitMsg}"`);
log('已提交，开始推送…');
run(`git -C "${GITEE_LOCAL_DIR}" push origin ${GITEE_BRANCH}`);

log(`完成 ✅ 安装包已推送到 Gitee（${GITEE_SUBDIR}）`);
log(`Windows 下载：https://gitee.com/giszhc/application-software/raw/main/${encodeURIComponent(GITEE_SUBDIR)}/shuntu-desktop.exe`);
log(`macOS   下载：https://gitee.com/giszhc/application-software/raw/main/${encodeURIComponent(GITEE_SUBDIR)}/shuntu-desktop.dmg`);
