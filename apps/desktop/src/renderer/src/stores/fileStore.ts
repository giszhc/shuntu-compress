/**
 * 文件列表 store：扫描、去重、逐项状态。
 * key 一律使用 absolutePath。
 */
import { create } from "zustand";
import type { FileEntry, TaskStatus } from "../../../shared/ipc-types";
import { useSettingsStore } from "./settingsStore";
import { useUiStore } from "./uiStore";

export interface ItemState {
  status: TaskStatus;
  output?: string;
  compressedSize?: number;
  error?: string;
}

interface FileState {
  entries: FileEntry[];
  /** absolutePath → 处理状态；不存在表示尚未参与任务 */
  items: Record<string, ItemState>;
  scanning: boolean;
  scannedCount: number;

  addPaths(paths: string[]): Promise<void>;
  remove(absolutePath: string): void;
  /** 移除某个扫描文件夹下的全部图片（列表中文件夹聚合为一行） */
  removeDir(rootDir: string): void;
  clear(): void;
  markPendingAll(): void;
  markProcessing(inputPath: string): void;
  applyResult(inputPath: string, item: ItemState): void;
  setScanProgress(count: number): void;
}

export const useFileStore = create<FileState>((set, get) => ({
  entries: [],
  items: {},
  scanning: false,
  scannedCount: 0,

  async addPaths(paths) {
    if (paths.length === 0) return;
    const { recursive } = useSettingsStore.getState().params;
    set({ scanning: true, scannedCount: 0 });
    try {
      const found = await window.app.scan({ paths, recursive });
      const existing = new Set(get().entries.map(e => e.absolutePath));
      const fresh = found.filter(e => !existing.has(e.absolutePath));
      set(state => ({ entries: [...state.entries, ...fresh] }));
      const skipped = found.length - fresh.length;
      if (fresh.length === 0 && found.length === 0) {
        useUiStore.getState().toast("未发现可处理的 JPG/PNG 图片", "error");
      } else if (skipped > 0) {
        useUiStore
          .getState()
          .toast(`已添加 ${fresh.length} 个文件（${skipped} 个重复已跳过）`, "success");
      } else {
        useUiStore.getState().toast(`已添加 ${fresh.length} 个文件`, "success");
      }
    } catch (err) {
      useUiStore
        .getState()
        .toast(err instanceof Error ? err.message : "扫描失败", "error");
    } finally {
      set({ scanning: false });
    }
  },

  remove(absolutePath) {
    set(state => {
      const items = { ...state.items };
      delete items[absolutePath];
      return {
        entries: state.entries.filter(e => e.absolutePath !== absolutePath),
        items
      };
    });
  },

  removeDir(rootDir) {
    set(state => {
      const removed = new Set<string>();
      const entries = state.entries.filter(e => {
        if (e.fromDir && e.rootDir === rootDir) {
          removed.add(e.absolutePath);
          return false;
        }
        return true;
      });
      if (removed.size === 0) return state;
      const items = { ...state.items };
      for (const key of removed) delete items[key];
      return { entries, items };
    });
  },

  clear() {
    set({ entries: [], items: {} });
  },

  markPendingAll() {
    set(state => {
      const items: Record<string, ItemState> = {};
      for (const entry of state.entries) {
        items[entry.absolutePath] = { status: "pending" };
      }
      return { items };
    });
  },

  markProcessing(inputPath) {
    set(state => ({
      items: { ...state.items, [inputPath]: { status: "processing" } }
    }));
  },

  applyResult(inputPath, item) {
    set(state => ({ items: { ...state.items, [inputPath]: item } }));
  },

  setScanProgress(count) {
    set({ scannedCount: count });
  }
}));
