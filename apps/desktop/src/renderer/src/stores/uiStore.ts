/**
 * UI store：页面切换、Toast、vips 安装弹窗状态。
 */
import { create } from "zustand";
import type { InstallProgress } from "../../../shared/ipc-types";

export type Page = "main" | "settings" | "about";
export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

export type VipsModalPhase = "hidden" | "confirm" | "installing" | "error";

interface UiState {
  page: Page;
  toasts: ToastItem[];
  vipsModal: VipsModalPhase;
  installProgress: InstallProgress | null;
  installError: string | null;
  /** 安装成功后需要自动重试的动作（例如重新开始压缩） */
  afterInstall: (() => void) | null;

  setPage(page: Page): void;
  toast(text: string, kind?: ToastKind): void;
  dismissToast(id: number): void;
  openVipsModal(afterInstall: (() => void) | null): void;
  setVipsModal(phase: VipsModalPhase): void;
  setInstallProgress(progress: InstallProgress): void;
  setInstallError(message: string): void;
  closeVipsModal(): void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  page: "main",
  toasts: [],
  vipsModal: "hidden",
  installProgress: null,
  installError: null,
  afterInstall: null,

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
  }
}));
