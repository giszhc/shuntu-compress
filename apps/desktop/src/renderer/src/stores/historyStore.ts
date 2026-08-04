/**
 * 历史优化记录 store：从主进程读取累计数据与记录列表。
 * - 应用启动时 load()；
 * - 每次任务完成（onFinished）后 refresh() 保持最新；
 * - 首页空状态与历史页共用本 store 数据。
 */
import { create } from "zustand";
import type { HistorySummary } from "../../../shared/ipc-types";

interface HistoryState {
  loaded: boolean;
  summary: HistorySummary | null;

  load(): Promise<void>;
  refresh(): Promise<void>;
  clear(): Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  loaded: false,
  summary: null,

  async load() {
    try {
      const summary = await window.app.getHistory();
      set({ loaded: true, summary });
    } catch {
      // 历史读取失败不阻塞主流程（记录只是附加价值）
      set({ loaded: true, summary: null });
    }
  },

  async refresh() {
    try {
      const summary = await window.app.getHistory();
      set({ summary });
    } catch {
      // 忽略：下次任务完成会再次刷新
    }
  },

  async clear() {
    await window.app.clearHistory();
    await get().refresh();
  }
}));
