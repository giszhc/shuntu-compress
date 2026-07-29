/**
 * 设置页：默认参数、主题、下载缓存管理、恢复默认。
 * 每次修改立即持久化到主进程 settings.json。
 */
import { useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";

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
      <h1>设置</h1>

      <div className="settings-group">
        <h2>默认压缩参数</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">默认质量</div>
              <div className="desc">新会话参数面板的初始质量（1-100）</div>
            </div>
            <div className="control">
              <input
                type="range"
                min={1}
                max={100}
                style={{ width: 120 }}
                value={settings.quality}
                onChange={e => patch({ quality: Number(e.target.value) })}
              />
              <span style={{ width: 28, textAlign: "right" }}>{settings.quality}</span>
            </div>
          </div>
          <div className="settings-row">
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
          <div className="settings-row">
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
          <div className="settings-row">
            <div className="info">
              <div className="title">默认并发数</div>
              <div className="desc">同时处理的图片数量（1-4）</div>
            </div>
            <div className="control">
              <div className="segmented" style={{ minWidth: 140 }}>
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
          <div className="settings-row">
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
      </div>

      <div className="settings-group">
        <h2>外观</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">主题</div>
              <div className="desc">跟随系统或固定亮/暗色</div>
            </div>
            <div className="control">
              <div className="segmented">
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
      </div>

      <div className="settings-group">
        <h2>下载缓存</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="info">
              <div className="title">清除下载缓存</div>
              <div className="desc">清理压缩引擎安装包的本地缓存</div>
            </div>
            <div className="control">
              <button
                type="button"
                className="btn btn-secondary"
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
      </div>

      <div className="settings-group">
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={() => {
            void resetSettings().then(() => toast("已恢复默认设置", "success"));
          }}
        >
          恢复默认设置
        </button>
      </div>
    </div>
  );
}
