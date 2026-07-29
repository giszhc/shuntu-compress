/// <reference types="vite/client" />
import type { AppApi } from "../../shared/ipc-types";

declare global {
  interface Window {
    /** preload 暴露的主进程能力（contextBridge） */
    app: AppApi;
    /** preload 暴露的拖拽路径提取工具 */
    dropUtils: {
      getPathsForFiles(files: File[]): string[];
    };
    /** e2e 测试钩子（Playwright 通过它进行确定性驱动） */
    __e2e?: {
      addPaths(paths: string[]): Promise<void>;
      start(): Promise<void>;
      getSnapshot(): unknown;
    };
  }
}

export {};
