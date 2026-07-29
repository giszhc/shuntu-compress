import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: "src/main/index.ts",
        // electron 必须外置：打进 bundle 会把 npm 包装脚本（getElectronPath）
        // 当成模块执行，运行时报 "Electron failed to install correctly"
        external: ["electron"]
      }
    },
    resolve: {
      // core 为 workspace TS 源码，打进 main bundle（不外置）
      conditions: ["node"]
    }
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: "src/preload/index.ts",
        external: ["electron"]
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    // 用相对 base，使构建产物可经 file:// (loadFile) 直接加载，不依赖 dev server
    base: "./",
    server: {
      // 避开用户其它项目占用的 5173-5177 端口
      port: 5199,
      strictPort: false
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: "src/renderer/index.html"
      }
    }
  }
});
