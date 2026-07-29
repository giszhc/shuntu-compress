/**
 * 任务 store：开始/取消压缩任务、进度、汇总结果。
 */
import { create } from "zustand";
import type {
  TaskFinishedEvent,
  TaskProgressEvent,
  TaskSummary
} from "../../../shared/ipc-types";
import { useFileStore } from "./fileStore";
import { useSettingsStore } from "./settingsStore";
import { useUiStore } from "./uiStore";

interface TaskState {
  running: boolean;
  canceling: boolean;
  /** 收尾中：进度条已补满但仍保留显示，等待过渡后再弹窗 */
  finishing: boolean;
  taskId: string | null;
  progress: TaskProgressEvent | null;
  summary: TaskSummary | null;
  showResult: boolean;

  start(): Promise<void>;
  cancel(): Promise<void>;
  onProgress(e: TaskProgressEvent): void;
  onFinished(e: TaskFinishedEvent): void;
  closeResult(): void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  running: false,
  canceling: false,
  finishing: false,
  taskId: null,
  progress: null,
  summary: null,
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

    // 2. 组装任务请求
    const { params } = useSettingsStore.getState();
    const request = {
      entries: files.entries,
      options: {
        quality: params.quality,
        size: params.size,
        ext: params.ext
      },
      outputDir: params.outputDir,
      mode: (params.preserveStructure ? "preserve" : "flat") as "preserve" | "flat",
      concurrency: params.concurrency
    };

    files.markPendingAll();
    set({ running: true, canceling: false, progress: null, summary: null });
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
      summary: e.summary
    });
    window.setTimeout(() => {
      // 期间若已启动新任务（finishing 被重置）则不再弹窗
      if (!get().finishing) return;
      set({ finishing: false, showResult: true });
      const { settings } = useSettingsStore.getState();
      if (settings?.openAfterFinish && e.summary.success > 0) {
        void window.app.openInExplorer(e.summary.outputDir);
      }
    }, 900); // 与 CSS 里 600ms 的进度条过渡匹配：走满动画播完 + 短暂停顿再弹窗
  },

  closeResult() {
    set({ showResult: false });
  }
}));
