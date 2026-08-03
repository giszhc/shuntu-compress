# 瞬图压缩（桌面端）

跨平台图片压缩桌面应用。拖入图片或文件夹，一键批量压缩，输出永不覆盖原图。

> 简称「瞬图」。本仓库为桌面端（Electron）独立仓库，与 npm 命令行工具 `@giszhc/vips-thumbnail` 分离维护。
>
> 官网与下载：https://giszhc.github.io/shuntu-compress/（GitHub Pages，源仓库 `shuntu-compress`）

## 特性

- **批量压缩**：支持单张图片、多张图片或整个文件夹（可递归子目录）。
- **参数可调**：压缩质量（1–100）、最长边尺寸、输出格式（JPG / PNG）。
- **目录结构保留**：输出时可选保留原图的相对目录层级。
- **并发处理**：可配置同时处理的图片数量（1–4）。
- **安全输出**：输出文件自动命名，永不覆盖原图。
- **自动打开**：任务结束后可自动打开输出目录。
- **引擎自管理**：首次压缩时自动下载并安装压缩引擎（约 40 MB）到当前用户目录，无需管理员权限。

## 项目结构

```
shuntu-desktop/
├── apps/desktop/     # 桌面端（Electron + React 19 + TypeScript）
├── packages/core/    # 图片处理核心模块（扫描 / 压缩 / 引擎安装）
├── docs/             # 静态落地页（GitHub Pages 官网 / 安装包下载）
└── scripts/          # 构建与发布辅助脚本
```

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发模式（热更新）
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动桌面端开发模式 |
| `pnpm build` | 构建桌面端 |
| `pnpm typecheck` | 类型检查（core + desktop） |
| `pnpm test` | 单元测试（core + desktop） |
| `pnpm dist:win` | 打包 Windows 安装包（NSIS，输出至 `apps/desktop/release/`） |
| `pnpm dist:mac:universal` | 打包 macOS 通用安装包（DMG，Intel + Apple 芯片，输出至 `apps/desktop/release/`） |
| `pnpm --filter vips-thumbnail-desktop dist:mac:arm64` | 打包 macOS Apple 芯片（M 系列）安装包（DMG） |
| `pnpm --filter vips-thumbnail-desktop dist:mac:x64` | 打包 macOS Intel 安装包（DMG） |
| `pnpm release:docs` | 部署官网提示（安装包托管在 Gitee，不再拷贝进 `docs/`） |

## 压缩引擎

- 首次执行压缩时，应用会自动下载并安装压缩引擎到 `%LOCALAPPDATA%\vips-thumbnail\`（Windows）。
- 在「设置 → 下载缓存」中可清除已下载的引擎安装包缓存。
- 输出文件永不覆盖原图。

## 官网与安装包发布

- 仓库 `docs/` 目录是一个静态落地页，介绍产品功能，下载按钮直链 Gitee 上的安装包，通过 GitHub Pages 自动发布。
- 在线地址：https://giszhc.github.io/shuntu-compress/
- 安装包托管在 Gitee（不再入库 `docs/`）：
  - Windows：https://gitee.com/giszhc/application-software/raw/main/%E7%9E%AC%E5%9B%BE%E5%8E%8B%E7%BC%A9/shuntu-desktop.exe
  - macOS（Apple 芯片 M 系列）：https://gitee.com/giszhc/application-software/raw/main/%E7%9E%AC%E5%9B%BE%E5%8E%8B%E7%BC%A9/shuntu-desktop-arm64.dmg
  - macOS（Intel）：https://gitee.com/giszhc/application-software/raw/main/%E7%9E%AC%E5%9B%BE%E5%8E%8B%E7%BC%A9/shuntu-desktop-x64.dmg
- 发布流程：
  1. `pnpm dist:win`（Windows）/ `pnpm dist:mac:universal` 或 `dist:mac:arm64` + `dist:mac:x64`（macOS）完成打包；
  2. `pnpm publish:application` 自动上传安装包到 Gitee 的 `application-software` 仓库 `瞬图压缩/` 目录并推送；
  3. 提交并推送 `main`，GitHub Actions 自动部署 `docs/` 静态官网到 Pages。

## License

MIT © giszhc
