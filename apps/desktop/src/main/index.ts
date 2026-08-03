/**
 * 主进程入口：单实例、窗口创建、安全配置、服务装配。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { BrowserWindow, Menu, Tray, app, nativeImage, nativeTheme, shell } from "electron";
import { IPC_EVENTS, type Settings } from "../shared/ipc-types";
import { registerIpc, sendToAll } from "./ipc";
import { DialogService } from "./services/dialogService";
import { ProcessService } from "./services/processService";
import { SettingsService } from "./services/settingsService";
import { ThumbnailService } from "./services/thumbnailService";
import { UpdateService } from "./services/updateService";
import { VipsService } from "./services/vipsService";
import { installCrashHandlers, logInfo } from "./crash-logger";

// 进程级崩溃兜底 + 全量调试日志（未捕获异常 / 未处理拒绝 / 渲染进程崩溃 /
// 子进程消失 / 进程退出）。只记录不退出，防止非关键错误误杀主进程导致“闪退”。
installCrashHandlers();

// 用软件渲染（SwiftShader）初始化 GPU 进程，并去掉 GPU 进程沙箱，
// 避免在无 GPU / 沙箱 / 虚拟化环境下 GPU 进程崩溃导致页面白屏或应用启动即退出。
// 同时禁用 GPU 合成（disable-gpu-compositing），强制走 CPU 合成，
// 避免 Chrome 默认 GPU 合成器在无 GPU 环境下绘制出纯白窗口。
// UI 较简单，软件渲染对性能影响可忽略；如用户机器 GPU 正常可自行加 --use-angle=default 还原。
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("use-gl", "angle");
app.commandLine.appendSwitch("use-angle", "swiftshader");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

// e2e/测试注入：--force-theme=light|dark 覆盖系统主题；--vips-cache-root=<dir> 注入缓存目录；
// --user-data-dir=<dir> 隔离用户数据（必须在单实例锁之前设置）
const forcedTheme = app.commandLine.getSwitchValue("force-theme");
const injectedCacheRoot = app.commandLine.getSwitchValue("vips-cache-root") || undefined;
const userDataDir = app.commandLine.getSwitchValue("user-data-dir");
if (userDataDir) {
  app.setPath("userData", userDataDir);
}

if (forcedTheme === "light" || forcedTheme === "dark") {
  nativeTheme.themeSource = forcedTheme;
}

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

// 与渲染层 --titlebar-height 保持一致（styles/variables.css）
const TITLEBAR_HEIGHT = 44;
// macOS 交通灯按钮组的外框高度为 16px（12px 按钮 + 上下留白）
const TRAFFIC_LIGHT_BOX = 16;
// 垂直居中：(标题栏高度 - 按钮组高度) / 2；x 保持系统默认 7px
const TRAFFIC_LIGHT_POSITION = {
  x: 7,
  y: Math.round((TITLEBAR_HEIGHT - TRAFFIC_LIGHT_BOX) / 2)
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// Windows 下点击关闭按钮仅隐藏到托盘；只有托盘"退出"或系统退出时才真正关闭
let isQuitting = false;

const settingsService = new SettingsService();
const thumbnailService = new ThumbnailService();
const dialogService = new DialogService(() => mainWindow);
const vipsService = new VipsService(
  {
    onInstallProgress: progress => sendToAll(IPC_EVENTS.installProgress, progress),
    onInstallError: error => sendToAll(IPC_EVENTS.installError, error)
  },
  injectedCacheRoot
);
const processService = new ProcessService(vipsService, {
  onScanProgress: event => sendToAll(IPC_EVENTS.scanProgress, event),
  onTaskProgress: event => sendToAll(IPC_EVENTS.taskProgress, event),
  onTaskItemDone: event => sendToAll(IPC_EVENTS.taskItemDone, event),
  onTaskFinished: event => sendToAll(IPC_EVENTS.taskFinished, event)
});
const updateService = UpdateService.create({
  onStatus: event => sendToAll(IPC_EVENTS.updateStatus, event)
});

function resolveThemeBackground(settings: Settings): string {
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" && nativeTheme.shouldUseDarkColors);
  return dark ? "#111418" : "#EEF1F5";
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function resolveWindowIconPath(): string | undefined {
  // Windows 标题栏左上角图标：必须在 BrowserWindow 构造时显式设置，
  // 否则 frameless/hidden titlebar 窗口会显示默认空白图标。
  if (process.platform !== "win32") return undefined;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.ico");
  }
  return path.join(app.getAppPath(), "build", "icon.ico");
}

function resolveTrayIconPath(): string {
  // macOS 菜单栏（Status Item / Tray）需要小尺寸 PNG，不能用 ICNS
  // Electron nativeImage.createFromPath 对 ICNS 支持有限，且菜单栏图标应 ≤ 22px
  if (process.platform === "darwin") {
    const base = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), "build");
    // 优先 @2x (Retina)，回退到 1x
    const ret = path.join(base, "tray-icon@2x.png");
    if (existsSync(ret)) return ret;
    return path.join(base, "tray-icon.png");
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.ico");
  }
  return path.join(app.getAppPath(), "build", "icon.ico");
}

function createTray(): void {
  if (tray) return;
  // Windows 与 macOS 均显示托盘：macOS 下 Tray 自动出现在顶部菜单栏（status bar）
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  const image = nativeImage.createFromPath(resolveTrayIconPath());
  tray = new Tray(image);
  tray.setToolTip("瞬图压缩");
  const rebuildMenu = () => {
    if (!tray) return;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: `当前版本 v${app.getVersion()}`,
          enabled: false
        },
        { type: "separator" },
        { label: "显示窗口", click: showMainWindow },
        {
          label: "检查更新…",
          click: () => {
            showMainWindow();
            void updateService.check();
          }
        },
        { type: "separator" },
        {
          label: "退出",
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ])
    );
  };
  rebuildMenu();
  // Windows：左键单击直接显示主窗口；macOS：左键弹出上方菜单（行为同 Windows 托盘）
  if (process.platform === "win32") {
    tray.on("click", showMainWindow);
  }
}

function createWindow(): void {
  const settings = settingsService.get();

  const windowIconPath = resolveWindowIconPath();

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    // Windows：显式设置左上角标题栏图标（frameless 窗口不会自动使用可执行文件图标）
    ...(windowIconPath ? { icon: nativeImage.createFromPath(windowIconPath) } : {}),
    // macOS：让系统交通灯按钮与 44px 标题栏垂直居中对齐
    ...(process.platform === "darwin"
      ? { trafficLightPosition: TRAFFIC_LIGHT_POSITION }
      : {}),
    backgroundColor: resolveThemeBackground(settings),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // 本地调试：F12 开关开发者工具（仅 dev，避免无 GPU 环境自动打开 DevTools 导致渲染进程崩溃）
  if (!app.isPackaged) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "F12") {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  // 窗口/渲染层异常轨迹：便于区分“主进程退出”与“渲染进程崩溃”
  mainWindow.webContents.on("did-fail-load", (_e, code, desc) =>
    logInfo("did-fail-load", `code=${code} desc=${desc}`)
  );
  mainWindow.webContents.on("unresponsive", () =>
    logInfo("webContents", "unresponsive")
  );
  mainWindow.webContents.on("destroyed", () =>
    logInfo("webContents", "destroyed")
  );
  mainWindow.on("close", () => logInfo("window", "close"));

  // macOS：退出全屏后系统会把交通灯位置重置为默认值，需要重新应用居中位置
  if (process.platform === "darwin") {
    mainWindow.on("leave-full-screen", () => {
      mainWindow?.setWindowButtonPosition(TRAFFIC_LIGHT_POSITION);
    });
  }

  mainWindow.on("maximize", () => sendToAll(IPC_EVENTS.maximizeChange, true));
  mainWindow.on("unmaximize", () => sendToAll(IPC_EVENTS.maximizeChange, false));
  // Windows：点击关闭 = 隐藏到托盘，不退出程序（e2e 注入 --no-tray 时保持原生关闭行为）
  mainWindow.on("close", event => {
    if (
      process.platform === "win32" &&
      !isQuitting &&
      !app.commandLine.hasSwitch("no-tray")
    ) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 拦截新窗口/外链：一律交给系统浏览器，渲染层无法打开任意页面
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    // 仅放行 mailto（关于页联系邮箱），交给系统默认邮件客户端
    if (url.startsWith("mailto:")) void shell.openExternal(url);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.on("second-instance", () => {
  // 再次启动时若窗口隐藏在托盘中，也要重新显示
  showMainWindow();
});

app.whenReady().then(() => {
  const trayEnabled = !app.commandLine.hasSwitch("no-tray");
  // macOS：以菜单栏（status bar）应用方式运行，隐藏 Dock 图标，行为与 Windows 托盘一致
  if (process.platform === "darwin" && trayEnabled) app.dock?.hide();
  registerIpc({
    vips: vipsService,
    process: processService,
    thumbnail: thumbnailService,
    dialog: dialogService,
    settings: settingsService,
    update: updateService
  });
  createWindow();
  if (trayEnabled) createTray();

  // 启动后静默检查更新：有可用更新时经 update:status 推送 available 事件，
  // 渲染层弹窗提示；无更新 / 检查失败不打扰用户。
  setTimeout(() => {
    void updateService.check();
  }, 5000);

  app.on("activate", () => {
    // macOS：点击 Dock 图标时恢复窗口（未隐藏 Dock 时生效）
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on("window-all-closed", () => {
  processService.cancelAll();
  // macOS 惯例：关闭窗口后应用常驻 Dock，不退出
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  processService.cancelAll();
});
