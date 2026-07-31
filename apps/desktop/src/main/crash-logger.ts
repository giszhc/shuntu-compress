/**
 * 统一日志 / 进程级崩溃兜底。
 *
 * 目标：
 *  1. 把未捕获异常、未处理拒绝、渲染进程崩溃、子进程消失、进程退出，
 *     全部写入 userData/debug.log，避免“静默闪退、毫无线索”。
 *  2. 同时输出到终端（dev 下 electron-vite 会把主进程 stdout 转发到控制台），
 *     方便实时调试。
 *  3. 对 unhandledRejection 仅记录不退出，防止单次事件发送失败误杀主进程。
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

let logPath: string | null = null;

function resolveLogPath(): string {
  if (logPath) return logPath;
  try {
    logPath = path.join(app.getPath("userData"), "debug.log");
  } catch {
    // app 尚未就绪时兜底到当前目录
    logPath = path.join(process.cwd(), "debug.log");
  }
  return logPath;
}

/** 当前日志文件绝对路径（供渲染层/启动横幅展示） */
export function getLogPath(): string {
  return resolveLogPath();
}

function write(level: string, tag: string, message: string): void {
  const line = `${new Date().toISOString()} [${level}] [${tag}] ${message}`;
  // 终端输出（dev 实时可见）
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    fs.appendFileSync(resolveLogPath(), `${line}\n`);
  } catch {
    // best effort：日志本身失败也不应影响主流程
  }
}

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** 普通轨迹日志 */
export function logInfo(tag: string, message: unknown): void {
  write("INFO", tag, stringify(message));
}

/** 崩溃 / 异常日志 */
export function logCrash(tag: string, err: unknown): void {
  write("ERROR", tag, stringify(err));
}

/** 清空日志（每次启动调用，保证日志只含本次会话，便于排查） */
export function resetLog(): void {
  try {
    fs.writeFileSync(resolveLogPath(), "");
  } catch {
    /* ignore */
  }
}

/**
 * 注册全部进程级监听。必须在 app ready 之后调用（需要 userData 路径）。
 */
export function installCrashHandlers(): void {
  resetLog();
  logInfo("boot", `日志文件：${resolveLogPath()}`);
  logInfo(
    "boot",
    `electron=${process.versions.electron} node=${process.versions.node} chrome=${process.versions.chrome} platform=${process.platform} arch=${process.arch} packaged=${app.isPackaged}`
  );

  process.on("uncaughtException", err => {
    logCrash("uncaughtException", err);
  });
  process.on("unhandledRejection", reason => {
    logCrash("unhandledRejection", reason);
  });
  process.on("exit", code => {
    // 进程真正退出时的最后一条日志：能区分“正常退出”与“异常终止”
    logInfo("process-exit", `code=${code}`);
  });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sig, () => logInfo("signal", sig));
  }

  app.on("render-process-gone", (_event, _webContents, details) => {
    logCrash(
      "render-process-gone",
      `reason=${details.reason} exitCode=${details.exitCode}`
    );
  });
  app.on("child-process-gone", (_event, details) => {
    logCrash(
      "child-process-gone",
      `type=${details.type} reason=${details.reason} exitCode=${details.exitCode} name=${details.name ?? "-"}`
    );
  });
  app.on("before-quit", () => logInfo("app", "before-quit"));
  app.on("will-quit", () => logInfo("app", "will-quit"));
  app.on("quit", (_e, code) => logInfo("app", `quit code=${code}`));
  app.on("window-all-closed", () => logInfo("app", "window-all-closed"));
}
