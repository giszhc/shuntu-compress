# 瞬图压缩桌面端（vips-thumbnail-desktop）

瞬图（瞬图压缩）—— 基于 libvips 的高性能本地图片压缩工具，Windows 10/11 x64 桌面应用。

- 技术栈：Electron + React + TypeScript + Vite（electron-vite）+ Zustand + Lucide Icons
- 共享核心：`@giszhc/vips-thumbnail-core`（与 CLI 共用扫描/输出规划/队列/vips 调用/安装器）
- 安全基线：`contextIsolation: true`、渲染进程零 Node 访问、所有 IPC 入参主进程侧校验、vips 以参数数组方式 spawn（无 shell 拼接）
- 输出策略：永不覆盖原图；默认输出到源目录旁 `compressed/`，重名自动追加 `-1/-2` 序号

## 功能

- 拖入文件/文件夹（支持中文与空格路径），递归扫描 JPG/PNG
- 压缩质量（1-100）、最长边缩放、格式转换（保持原格式 / JPG / PNG）
- 并发 1-4、保留目录结构或平铺输出、自定义输出目录
- 实时进度、逐文件状态、取消任务（清理半成品临时文件）
- 任务汇总：成功/失败/跳过/取消、压缩前后总大小、节省比例、耗时
- Windows 下未检测到 libvips 时一键下载安装（官方源 + SHA-256 校验，装到用户目录，无需管理员）
- 亮/暗主题（跟随系统或手动），毛玻璃质感 UI，全中文界面

## 开发

```bash
pnpm install               # 仓库根目录
pnpm --filter vips-thumbnail-desktop dev        # 开发模式（HMR）
pnpm --filter vips-thumbnail-desktop typecheck  # 类型检查
pnpm --filter vips-thumbnail-desktop test       # 主进程单测（vitest）
pnpm --filter vips-thumbnail-desktop build      # 编译 main/preload/renderer
pnpm --filter vips-thumbnail-desktop test:e2e   # Playwright e2e（需先 build）
pnpm --filter vips-thumbnail-desktop build:icon # 重新生成应用图标
pnpm --filter vips-thumbnail-desktop package    # 打包 NSIS 安装包（release/）
pnpm --filter vips-thumbnail-desktop dist:win   # 图标 + 构建 + Windows NSIS 一条龙
pnpm --filter vips-thumbnail-desktop dist:mac:universal # macOS Universal DMG（需在 macOS 上执行）
```

## 托盘行为（Windows）

- 点击标题栏"关闭"按钮：窗口隐藏到系统托盘，程序不退出
- 托盘图标左键单击：显示主窗口
- 托盘图标右键菜单：`显示窗口` / `退出`（只有这里的退出才真正结束进程）
- 再次双击启动图标（单实例）：唤起已隐藏的窗口

## macOS 打包说明

- `dist:mac:universal` 产出 Universal（x64 + arm64）DMG，必须在 macOS 机器上执行
- 图标 `build/icon.icns` 由 `build:icon` 脚本从 `build/icon.svg` 自动生成
- macOS 上关闭窗口后应用常驻 Dock（系统惯例），点击 Dock 图标恢复窗口

## 测试注入参数（仅用于 e2e/调试）

| 参数 | 作用 |
| --- | --- |
| `--force-theme=light\|dark` | 强制主题（覆盖系统） |
| `--vips-cache-root=<dir>` | 注入 libvips 安装缓存目录 |
| `--user-data-dir=<dir>` | 隔离用户数据目录（设置、单实例锁） |
| `--no-tray` | 禁用托盘与关闭拦截（关闭即退出，e2e 使用） |

渲染层暴露 `window.__e2e`（addPaths / start / getSnapshot）供 Playwright 确定性驱动。

## 目录结构

```
apps/desktop/
├─ src/main/          # 主进程：入口、IPC 注册、入参校验、5 个服务
│  ├─ services/       # settings / vips / process / thumbnail / dialog
│  └─ __tests__/      # vitest 单测
├─ src/preload/       # contextBridge，暴露 window.app / window.dropUtils
├─ src/renderer/      # React UI（Zustand stores + 组件 + 页面 + CSS 变量主题）
├─ src/shared/        # IPC 类型与 channel 常量（主/渲染共享）
├─ e2e/               # Playwright（真实 Electron + 真实 vips + 截图矩阵）
├─ scripts/           # 图标生成
├─ electron-builder.yml
└─ electron.vite.config.ts
```
