/**
 * UI store：页面切换、Toast、vips 安装弹窗状态。
 */
import { create } from "zustand";
import type { InstallProgress, UpdateStatusEvent } from "../../../shared/ipc-types";

export type Page = "main" | "settings" | "about";
export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

export type VipsModalPhase = "hidden" | "confirm" | "installing" | "error";

/** 更新弹窗状态：hidden=关闭；update=有更新待确认；installing=下载安装中 */
export type UpdateModalPhase = "hidden" | "update" | "installing" | "error";

interface UiState {
  page: Page;
  toasts: ToastItem[];
  vipsModal: VipsModalPhase;
  installProgress: InstallProgress | null;
  installError: string | null;
  /** 安装成功后需要自动重试的动作（例如重新开始压缩） */
  afterInstall: (() => void) | null;

  /** 更新相关 */
  updateModal: UpdateModalPhase;
  updateEvent: UpdateStatusEvent | null;
  updateError: string | null;

  setPage(page: Page): void;
  toast(text: string, kind?: ToastKind): void;
  dismissToast(id: number): void;
  openVipsModal(afterInstall: (() => void) | null): void;
  setVipsModal(phase: VipsModalPhase): void;
  setInstallProgress(progress: InstallProgress): void;
  setInstallError(message: string): void;
  closeVipsModal(): void;
  /** 处理主进程推送的更新状态 */
  onUpdateStatus(event: UpdateStatusEvent): void;
  /** 关闭更新弹窗（跳过 / 关闭） */
  closeUpdateModal(): void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  page: "main",
  toasts: [],
  vipsModal: "hidden",
  installProgress: null,
  installError: null,
  afterInstall: null,

  updateModal: "hidden",
  updateEvent: null,
  updateError: null,

  setPage(page) {
    set({ page });
  },

  toast(text, kind = "info") {
    const id = ++toastSeq;
    set(state => ({ toasts: [...state.toasts, { id, kind, text }] }));
    window.setTimeout(() => get().dismissToast(id), 3600);
  },

  dismissToast(id) {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  openVipsModal(afterInstall) {
    set({
      vipsModal: "confirm",
      installProgress: null,
      installError: null,
      afterInstall
    });
  },

  setVipsModal(phase) {
    set({ vipsModal: phase });
  },

  setInstallProgress(installProgress) {
    set({ installProgress, vipsModal: "installing" });
  },

  setInstallError(message) {
    set({ installError: message, vipsModal: "error" });
  },

  closeVipsModal() {
    set({
      vipsModal: "hidden",
      installProgress: null,
      installError: null,
      afterInstall: null
    });
  },

  onUpdateStatus(event) {
    if (event.phase === "available") {
      set({ updateModal: "update", updateEvent: event, updateError: null });
    } else if (event.phase === "downloading") {
      set({ updateModal: "installing", updateEvent: event, updateError: null });
    } else if (event.phase === "error") {
      // 检查失败或下载失败：若正在弹窗则显示错误，否则 toast
      if (get().updateModal !== "hidden") {
        set({ updateError: event.message, updateEvent: event });
      } else {
        get().toast(event.message, "error");
      }
    }
    // "checking" / "none" 由调用方（按钮点击处）处理提示文案
  },

  closeUpdateModal() {
    set({ updateModal: "hidden", updateEvent: null, updateError: null });
  }
}));
