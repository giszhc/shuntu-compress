/**
 * 打开文件夹（统一错误提示）。
 * 所有「打开所在目录 / 打开输出文件夹」入口共用：
 * 目标路径不存在（用户删除/移动）时主进程抛 ConfigError，
 * 这里统一转成 toast，避免静默失败、用户点了几次都没反应。
 */
import { useUiStore } from "../stores/uiStore";

/**
 * 从 Electron IPC 包装的错误消息里剥离前缀，只保留原始文案。
 * 包装格式：`Error invoking remote method 'X': <ErrorClass>: <userMessage>`，
 * 直接 toast 整串会泄露内部方法名，不友好。
 */
function extractIpcMessage(message: string): string {
  // 匹配最后一个 "<Class>:<message>"（userMessage 内通常不再含英文 Error 类名）
  const m = message.match(/(?:Error|ConfigError|ErrorClass):\s*(.+)$/);
  return m ? m[1].trim() : message;
}

export async function openFolder(targetPath: string): Promise<void> {
  try {
    await window.app.openInExplorer(targetPath);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "无法打开文件夹，请检查路径是否存在";
    useUiStore.getState().toast(extractIpcMessage(raw), "error");
  }
}

/** 暴露给外部复用（如 taskStore 自动打开） */
export { extractIpcMessage };
