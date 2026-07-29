#!/usr/bin/env bash
# 瞬图压缩 · 桌面端启动器（Windows 沙箱稳定版）
#
# 已验证的关键约束（缺一不可）：
#   1. 启动 CWD 必须为「项目根目录」(/f/AI/CodeX/图片压缩/shuntu-desktop)。
#      在 apps/desktop 下启动会让 electron 主进程 V8 断言崩溃
#      (Assertion failed: isolate_data->snapshot_data() != nullptr)。
#   2. 入口必须用 run.js 包装 require('./out/main/index.js')。
#      直传 out/main/index.js 作为 entry 在本环境非确定性触发上述 V8 断言。
#   3. 必须经 schtasks 投到交互桌面会话。
#      agent 的 Bash 直接启动 electron 会触发 V8 断言崩溃。
#   4. 必须【仅 unset】ELECTRON_RUN_AS_NODE，绝不能 export 成空字符串——
#      空字符串仍会被 electron 的 getenv() 视为「以 node 模式运行」，导致崩溃。
#      当前 Bash 环境默认 ELECTRON_RUN_AS_NODE=1，必须清掉。
#   5. 必须 unset NODE_OPTIONS（当前环境预设了 --require 安全删除 shim，会污染 electron）。
#
# 用法（在交互桌面会话中）：
#   schtasks /create /tn ShuntuRun /tr "\"C:\Program Files\Git\bin\bash.exe\" \"<本文件绝对路径>\"" /sc once /st 00:00 /f
#   schtasks /run /tn ShuntuRun
#
# 说明：本启动器只负责「加载已有的 out/ 构建产物」。
#       修改源码后请先手动构建：pnpm --filter vips-thumbnail-desktop build
unset ELECTRON_RUN_AS_NODE
unset NODE_OPTIONS
cd "/f/AI/CodeX/图片压缩/shuntu-desktop"
echo "[launch] $(date) cwd=$(pwd)" > apps/desktop/launch.log
node_modules/electron/dist/electron.exe apps/desktop/run.js --no-sandbox >> apps/desktop/launch.log 2>&1
echo "[launch] exit=$?" >> apps/desktop/launch.log
