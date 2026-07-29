/**
 * 自定义标题栏：无边框窗口的拖拽区 + 页面导航 + 最小化/最大化/关闭。
 */
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore, type Page } from "../stores/uiStore";
import appIcon from "../assets/app-icon.png";

const NAV: Array<{ page: Page; label: string }> = [
  { page: "main", label: "压缩" },
  { page: "settings", label: "设置" },
  { page: "about", label: "关于" }
];

export function Titlebar(): React.JSX.Element {
  const page = useUiStore(s => s.page);
  const setPage = useUiStore(s => s.setPage);
  const [maximized, setMaximized] = useState(false);
  // macOS 自带交通灯按钮在左上，无需自绘右侧控件；且需给标题栏预留空间避开交通灯
  const isMac = window.app.platform === "darwin";

  useEffect(() => {
    let alive = true;
    void window.app.isMaximized().then(v => {
      if (alive) setMaximized(v);
    });
    const off = window.app.onMaximizeChange(v => setMaximized(v));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return (
    <header className={isMac ? "titlebar titlebar--mac" : "titlebar"}>
      <div className="titlebar-title">
        <img className="titlebar-logo" src={appIcon} alt="" aria-hidden />
        瞬图
      </div>
      <nav className="titlebar-nav">
        {NAV.map(item => (
          <button
            key={item.page}
            type="button"
            className={page === item.page ? "active" : ""}
            onClick={() => setPage(item.page)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {!isMac && (
        <div className="titlebar-controls">
          <button
            type="button"
            title="最小化"
            onClick={() => void window.app.windowControl({ action: "min" })}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            title={maximized ? "还原" : "最大化"}
            onClick={() => void window.app.windowControl({ action: "max" })}
          >
            {maximized ? <Copy size={13} /> : <Square size={13} />}
          </button>
          <button
            type="button"
            className="close-btn"
            title="关闭"
            onClick={() => void window.app.windowControl({ action: "close" })}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
