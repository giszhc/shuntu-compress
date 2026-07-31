/**
 * 设置页（按设计图美化）：分组卡片 + 行（左图标 / 标题描述 / 控件）。
 * 每次修改立即持久化到主进程 settings.json。
 */
import {
  Cpu,
  Download,
  FolderTree,
  FolderOpen,
  Gift,
  Image as ImageIcon,
  Layers,
  Palette,
  Rocket,
  RotateCcw
} from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";
import "../styles/settings.css";

export function SettingsPage(): React.JSX.Element {
  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const resetSettings = useSettingsStore(s => s.resetSettings);
  const toast = useUiStore(s => s.toast);

  if (!settings) return <div className="page" />;

  const patch = (p: Parameters<typeof updateSettings>[0]) => {
    void updateSettings(p).catch((err: unknown) => {
      toast(err instanceof Error ? err.message : "保存设置失败", "error");
    });
  };

  return (
    <div className="page">
      <header className="settings-header">
        <h1>设置</h1>
        <p className="subtitle">自定义瞬图压缩的行为与外观</p>
      </header>

      {/* 默认压缩参数 */}
      <section className="settings-group">
        <h2 className="settings-group-title">
          <span className="group-icon"><Gift size={16} /></span>
          默认压缩参数
        </h2>
        <div className="settings-card">
          {/* 默认质量：Slider + 数值 */}
          <div className="settings-row">
            <span className="row-icon"><ImageIcon size={18} /></span>
            <div className="info">
              <div className="title">默认质量</div>
              <div className="desc">新会话弹窗面板的初始质量（1~100）</div>
            </div>
            <div className="control">
              <input
                type="range"
                min={1}
                max={100}
                className="slider"
                style={{
                  ["--fill" as string]: `${((settings.quality - 1) / 99) * 100}%`
                }}
                value={settings.quality}
                onChange={e => patch({ quality: Number(e.target.value) })}
              />
              <span className="slider-value">{settings.quality}</span>
            </div>
          </div>

          {/* 默认递归子目录：Toggle */}
          <div className="settings-row">
            <span className="row-icon"><FolderTree size={18} /></span>
            <div className="info">
              <div className="title">默认递归子目录</div>
              <div className="desc">添加文件夹时是否扫描子目录</div>
            </div>
            <div className="control">
              <button
                type="button"
                role="switch"
                aria-checked={settings.recursive}
                className={`switch${settings.recursive ? " on" : ""}`}
                onClick={() => patch({ recursive: !settings.recursive })}
              >
                <span className="knob" />
              </button>
            </div>
          </div>

          {/* 默认保留目录结构：Toggle */}
          <div className="settings-row">
            <span className="row-icon"><Layers size={18} /></span>
            <div className="info">
              <div className="title">默认保留目录结构</div>
              <div className="desc">输出时保留相对目录层级</div>
            </div>
            <div className="control">
              <button
                type="button"
                role="switch"
                aria-checked={settings.preserveStructure}
                className={`switch${settings.preserveStructure ? " on" : ""}`}
                onClick={() => patch({ preserveStructure: !settings.preserveStructure })}
              >
                <span className="knob" />
              </button>
            </div>
          </div>

          {/* 默认并发数：Segmented */}
          <div className="settings-row">
            <span className="row-icon"><Cpu size={18} /></span>
            <div className="info">
              <div className="title">默认并发数</div>
              <div className="desc">同时处理的图片数量（1~4）</div>
            </div>
            <div className="control">
              <div className="segmented" style={{ minWidth: 160 }}>
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={settings.concurrency === n ? "active" : ""}
                    onClick={() => patch({ concurrency: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 完成后打开输出目录：Toggle */}
          <div className="settings-row">
            <span className="row-icon"><Rocket size={18} /></span>
            <div className="info">
              <div className="title">完成后打开输出目录</div>
              <div className="desc">任务成功结束后自动打开资源管理器</div>
            </div>
            <div className="control">
              <button
                type="button"
                role="switch"
                aria-checked={settings.openAfterFinish}
                className={`switch${settings.openAfterFinish ? " on" : ""}`}
                onClick={() => patch({ openAfterFinish: !settings.openAfterFinish })}
              >
                <span className="knob" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 外观 */}
      <section className="settings-group">
        <h2 className="settings-group-title">
          <span className="group-icon"><Palette size={16} /></span>
          外观
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">主题</div>
              <div className="desc">跟随系统或固定亮 / 暗色</div>
            </div>
            <div className="control">
              <div className="segmented" style={{ minWidth: 260 }}>
                {(
                  [
                    { label: "跟随系统", value: "system" },
                    { label: "浅色", value: "light" },
                    { label: "深色", value: "dark" }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={settings.theme === opt.value ? "active" : ""}
                    onClick={() => patch({ theme: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 下载缓存 */}
      <section className="settings-group">
        <h2 className="settings-group-title">
          <span className="group-icon"><Download size={16} /></span>
          下载缓存
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">清除下载缓存</div>
              <div className="desc">清理压缩引擎安装包的本地缓存</div>
            </div>
            <div className="control">
              <button
                type="button"
                className="btn-soft"
                onClick={() => {
                  void window.app
                    .vipsClearCache()
                    .then(() => toast("已清除下载缓存", "success"))
                    .catch((err: unknown) => {
                      toast(err instanceof Error ? err.message : "清除失败", "error");
                    });
                }}
              >
                清除下载缓存
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 恢复默认 */}
      <section className="settings-group settings-group--danger">
        <h2 className="settings-group-title">
          <span className="group-icon"><RotateCcw size={16} /></span>
          恢复默认设置
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">恢复默认设置</div>
              <div className="desc">将所有设置恢复为默认值</div>
            </div>
            <div className="control">
              <button
                type="button"
                className="btn-danger-soft"
                onClick={() => {
                  void resetSettings().then(() => toast("已恢复默认设置", "success"));
                }}
              >
                <RotateCcw size={14} />
                恢复默认设置
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}