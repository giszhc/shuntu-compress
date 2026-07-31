import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("找不到 #root 挂载点");
}

// 把渲染进程的全局错误 / 未处理拒绝转发到主进程日志，便于打包后排查闪退
window.addEventListener("error", event => {
  void window.app.log(
    `[renderer error] ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`
  );
});
window.addEventListener("unhandledrejection", event => {
  const reason = event.reason;
  void window.app.log(
    `[renderer unhandledrejection] ${
      reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack}` : String(reason)
    }`
  );
});

createRoot(rootEl).render(<App />);
