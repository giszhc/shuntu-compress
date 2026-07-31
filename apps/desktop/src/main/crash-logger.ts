/**
 * 进程级崩溃兜底：把未捕获异常 / 未处理的 Promise 拒绝 / 渲染进程崩溃
 * 写入 userData/crash.log，避免“静默闪退、毫无线索”。
 * 同时：对 unhandledRejection 仅记录不退出，防止单次事件发送失败
 * （如窗口正在销毁、payload 不可序列化）误杀主进程。
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

let logPath: string | null = null;

function resolveLogPath(): string {
  if (logPath) return logPath;
  try {
    logPath = path.join(app.getPath("userData"), "crash.log");
  } catch {
    // app 尚未就绪时兜底到临时目录
    logPath = path.join(process.cwd(), "crash.log");
  }
  return logPath;
}

export function logCrash(tag: string, err: unknown): void {
  try {
    const msg =
      err instanceof Error
        ? err.stack ?? `${err.name}: ${err.message}`
        : String(err);
    const line = `${new Date().toISOString()} [${tag}] ${msg}\n`;
    fs.appendFileSync(resolveLogPath(), line);
  } catch {
    // best effort：日志本身失败也不应影响主流程
  }
}
