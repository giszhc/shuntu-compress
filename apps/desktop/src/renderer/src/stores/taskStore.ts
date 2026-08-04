/**
 * 任务 store：开始/取消压缩任务、进度、汇总结果。
 * - 智能优化模式：把 mode 与任务名传给主进程，由主进程按文件格式自动决策参数；
 * - 完成时缓存 results（供结果弹窗做逐图前后对比）并刷新历史记录。
 */
import { create } from "zustand";
import type {
  FileEntry,
  TaskFinishedEvent,
  TaskProgressEvent,
  TaskResult,
  TaskSummary
} from "../../../shared/ipc-types";
import { useFileStore } from "./fileStore";
import { useHistoryStore } from "./historyStore";
import { useSettingsStore } from "./settingsStore";
import { useUiStore } from "./uiStore";
import { openFolder } from "../utils/openFolder";

interface TaskState {
  running: boolean;
  canceling: boolean;
  /** 收尾中：进度条已补满但仍保留显示，等待过渡后再弹窗 */
  finishing: boolean;
  taskId: string | null;
  progress: TaskProgressEvent | null;
  summary: TaskSummary | null;
  /** 最近一次任务的逐项结果（结果弹窗「前后对比」列表数据源） */
  results: TaskResult[] | null;
  showResult: boolean;

  start(): Promise<void>;
  cancel(): Promise<void>;
  onProgress(e: TaskProgressEvent): void;
  onFinished(e: TaskFinishedEvent): void;
  closeResult(): void;
}

/** 为历史记录生成人类可读的任务名 */
function buildTaskName(entries: FileEntry[]): string {
  if (entries.length === 0) return "图片优化";
  if (entries.length === 1) {
    const entry = entries[0];
    if (entry.fromDir) {
      return entry.rootDir.split(/[\\/]/).filter(Boolean).pop() ?? entry.fileName;
    }
    return entry.fileName;
  }
  // 多文件：全部来自同一文件夹时用文件夹名，否则用总数
  const dirs = new Set(entries.filter(e => e.fromDir).map(e => e.rootDir));
  if (dirs.size === 1) {
    const root = dirs.values().next().value as string;
    const dirName = root.split(/[\\/]/).filter(Boolean).pop() ?? root;
    return `${dirName}（${entries.length} 张）`;
  }
  return `图片优化（${entries.length} 张）`;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  running: false,
  canceling: false,
  finishing: false,
  taskId: null,
  progress: null,
  summary: null,
  results: null,
  showResult: false,

  async start() {
    const ui = useUiStore.getState();
    const files = useFileStore.getState();
    if (get().running || get().finishing) return;
    if (files.entries.length === 0) {
      ui.toast("请先添加图片文件", "error");
      return;
    }

    // 1. 检测 libvips
    let status;
    try {
      status = await window.app.vipsDetect();
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : "压缩引擎检测失败", "error");
      return;
    }
    if (!status.available) {
      if (status.canAutoInstall) {
        // 弹出安装确认，安装成功后自动重试开始
        ui.openVipsModal(() => {
          void get().start();
        });
      } else {
        ui.toast(status.guide ?? "未检测到压缩引擎，请先安装", "error");
      }
      return;
    }

    // 2. 组装任务请求（智能模式由主进程逐文件决策，手动模式用面板参数）
    const { params } = useSettingsStore.getState();
    const request = {
      entries: files.entries,
      name: buildTaskName(files.entries),
      options: {
        quality: params.quality,
        size: params.size,
        ext: params.ext
      },
      smart: params.mode === "smart",
      outputDir: params.outputDir,
      mode: (params.preserveStructure ? "preserve" : "flat") as "preserve" | "flat",
      concurrency: params.concurrency
    };

    files.markPendingAll();
    set({ running: true, canceling: false, progress: null, summary: null, results: null });
    try {
      const { taskId } = await window.app.startTask(request);
      set({ taskId });
    } catch (err) {
      set({ running: false, taskId: null });
      ui.toast(err instanceof Error ? err.message : "任务启动失败", "error");
    }
  },

  async cancel() {
    const { taskId, running, canceling } = get();
    if (!running || canceling || !taskId) return;
    set({ canceling: true });
    try {
      await window.app.cancelTask(taskId);
    } catch (err) {
      useUiStore
        .getState()
        .toast(err instanceof Error ? err.message : "取消失败", "error");
      set({ canceling: false });
    }
  },

  onProgress(e) {
    if (e.taskId !== get().taskId) return;
    // 边界保护：同一任务内进度只增不减，并钳制在 0~100，
    // 避免 IPC 事件乱序/迟到导致进度条回退或溢出。
    const prev = get().progress;
    const prevPercent = prev?.taskId === e.taskId ? prev.percent : 0;
    const prevDone = prev?.taskId === e.taskId ? prev.done : 0;
    set({
      progress: {
        ...e,
        percent: Math.min(100, Math.max(0, e.percent, prevPercent)),
        done: Math.max(e.done, prevDone)
      }
    });
    if (e.currentFile) {
      useFileStore.getState().markProcessing(e.currentFile);
    }
  },

  onFinished(e) {
    if (e.taskId !== get().taskId) return;
    const prev = get().progress;
    const total = prev?.total ?? e.results?.length ?? 1;
    // 先把进度条补满并保留显示，制造“走满”的过渡感；延迟后再弹窗
    set({
      running: false,
      canceling: false,
      taskId: null,
      finishing: true,
      progress: prev
        ? { ...prev, percent: 100, done: total }
        : { taskId: e.taskId, done: total, total, percent: 100, currentFile: "" },
      summary: e.summary,
      results: e.results
    });
    // 刷新历史记录（累计优化数量 / 累计节省空间）
    void useHistoryStore.getState().refresh();
    window.setTimeout(() => {
      // 期间若已启动新任务（finishing 被重置）则不再弹窗
      if (!get().finishing) return;
      set({ finishing: false, showResult: true });
      const { settings } = useSettingsStore.getState();
      if (settings?.openAfterFinish && e.summary.success > 0) {
        // 自动打开输出目录：失败时由 openFolder 统一 toast 提示
        void openFolder(e.summary.outputDir);
      }
    }, 900); // 与 CSS 里 600ms 的进度条过渡匹配：走满动画播完 + 短暂停顿再弹窗
  },

  closeResult() {
    set({ showResult: false });
  }
}));
