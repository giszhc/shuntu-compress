#!/usr/bin/env node
// 安装包不再拷贝进 docs/。
//
// 自 2026-08-01 起，Windows / macOS 安装包改为托管在 Gitee：
//   Windows: https://gitee.com/giszhc/application-software/raw/main/瞬图压缩/shuntu-desktop.exe
//   macOS:   https://gitee.com/giszhc/application-software/raw/main/瞬图压缩/shuntu-desktop.dmg
//
// docs/index.html 中的下载按钮已改为上述 Gitee raw 直链，
// 因此本脚本不再执行拷贝，仅作提示，避免把大安装包重新写回 docs/。
console.log('[release:docs] 安装包已改为托管在 Gitee，不再拷贝进 docs/。');
console.log('[release:docs] 直接提交并推送 docs/（仅含静态官网），即可更新 GitHub Pages。');
