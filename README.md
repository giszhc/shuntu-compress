# 瞬图压缩（桌面端）

跨平台图片压缩桌面应用。拖入图片或文件夹，一键批量压缩，输出永不覆盖原图。

> 简称「瞬图」。本仓库为桌面端（Electron）独立仓库，与 npm 命令行工具 `@giszhc/vips-thumbnail` 分离维护。

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
└── packages/core/    # 图片处理核心模块（扫描 / 压缩 / 引擎安装）
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

## 压缩引擎

- 首次执行压缩时，应用会自动下载并安装压缩引擎到 `%LOCALAPPDATA%\vips-thumbnail\`（Windows）。
- 在「设置 → 下载缓存」中可清除已下载的引擎安装包缓存。
- 输出文件永不覆盖原图。

## License

MIT © giszhc
