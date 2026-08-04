/**
 * 设置 + 会话参数（参数面板）store。
 * - settings：持久化默认值（主进程 settings.json）
 * - params：本次会话的压缩参数，初始值取自 settings，修改不落盘
 */
import { create } from "zustand";
import type {
  OutputExt,
  ResolvedTheme,
  Settings,
  ThemePref
} from "../../../shared/ipc-types";

/** 压缩模式：智能优化（自动决策）/ 高级设置（手动参数） */
export type OptimizeMode = "smart" | "manual";

export interface SessionParams {
  mode: OptimizeMode;
  quality: number;
  size: number | null;
  ext: OutputExt | null;
  recursive: boolean;
  preserveStructure: boolean;
  concurrency: number;
  outputDir: string | null;
}

interface SettingsState {
  loaded: boolean;
  settings: Settings | null;
  params: SessionParams;
  systemTheme: ResolvedTheme;
  resolvedTheme: ResolvedTheme;

  load(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  resetSettings(): Promise<void>;
  setParam<K extends keyof SessionParams>(key: K, value: SessionParams[K]): void;
  setSystemTheme(theme: ResolvedTheme): void;
}

const FALLBACK_PARAMS: SessionParams = {
  mode: "smart",
  quality: 85,
  size: null,
  ext: null,
  recursive: true,
  preserveStructure: true,
  concurrency: 2,
  outputDir: null
};

function resolveTheme(pref: ThemePref | undefined, system: ResolvedTheme): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return system;
}

function applyThemeToDom(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

function paramsFromSettings(s: Settings): SessionParams {
  return {
    mode: "smart",
    quality: s.quality,
    size: s.size,
    ext: s.ext,
    recursive: s.recursive,
    preserveStructure: s.preserveStructure,
    concurrency: s.concurrency,
    outputDir: s.outputDir
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: null,
  params: FALLBACK_PARAMS,
  systemTheme: "light",
  resolvedTheme: "light",

  async load() {
    const [settings, systemTheme] = await Promise.all([
      window.app.getSettings(),
      window.app.getSystemTheme()
    ]);
    const resolvedTheme = resolveTheme(settings.theme, systemTheme);
    applyThemeToDom(resolvedTheme);
    set({
      loaded: true,
      settings,
      params: paramsFromSettings(settings),
      systemTheme,
      resolvedTheme
    });
  },

  async updateSettings(patch) {
    const settings = await window.app.setSettings(patch);
    const { systemTheme } = get();
    const resolvedTheme = resolveTheme(settings.theme, systemTheme);
    applyThemeToDom(resolvedTheme);
    set({ settings, resolvedTheme });
  },

  async resetSettings() {
    const settings = await window.app.resetSettings();
    const { systemTheme } = get();
    const resolvedTheme = resolveTheme(settings.theme, systemTheme);
    applyThemeToDom(resolvedTheme);
    set({ settings, params: paramsFromSettings(settings), resolvedTheme });
  },

  setParam(key, value) {
    set(state => ({ params: { ...state.params, [key]: value } }));
  },

  setSystemTheme(systemTheme) {
    const { settings } = get();
    const resolvedTheme = resolveTheme(settings?.theme, systemTheme);
    applyThemeToDom(resolvedTheme);
    set({ systemTheme, resolvedTheme });
  }
}));
