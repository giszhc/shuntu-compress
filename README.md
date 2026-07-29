# 瞬图压缩（桌面端）

跨平台图片压缩桌面应用。拖入图片或文件夹，一键批量压缩，输出永不覆盖原图。

## 项目结构

```
shuntu-desktop/
├── apps/desktop/     # 桌面端（Electron + React 19 + TypeScript）
└── packages/core/    # 图片处理核心模块（扫描 / 压缩 / 引擎安装）
```

## 开发

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发模式
pnpm build            # 构建
pnpm typecheck        # 类型检查
pnpm test             # 单元测试
```

## 打包

```bash
pnpm dist:win         # Windows 安装包（NSIS，输出至 apps/desktop/release/）
```

## 说明

- 首次执行压缩时会自动下载并安装压缩引擎（约 19 MB）到 `%LOCALAPPDATA%\vips-thumbnail\`。
- 输出文件永不覆盖原图。

## License

MIT © giszhc
