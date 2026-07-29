/**
 * 参数面板：质量 / 尺寸 / 格式 / 递归 / 目录结构 / 输出目录。
 * 会话级参数，默认值来自设置页；任务运行中禁用。
 */
import { useEffect, useState } from "react";
import { FolderOutput, RotateCcw } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { useTaskStore } from "../stores/taskStore";

const SIZE_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "原尺寸", value: null },
  { label: "3840", value: 3840 },
  { label: "2560", value: 2560 },
  { label: "1920", value: 1920 },
  { label: "1280", value: 1280 },
  { label: "800", value: 800 }
];

const PRESET_VALUES = new Set(
  SIZE_PRESETS.map(p => p.value).filter((v): v is number => v !== null)
);

/** 自定义最长边允许范围 */
const SIZE_MIN = 1;
const SIZE_MAX = 20000;

export function ParamsPanel(): React.JSX.Element {
  const params = useSettingsStore(s => s.params);
  const setParam = useSettingsStore(s => s.setParam);
  const running = useTaskStore(s => s.running);

  /** 当前 size 是否属于自定义值（非 null 且不在预设中） */
  const isCustomSize = params.size !== null && !PRESET_VALUES.has(params.size);
  // 自定义输入框草稿：仅在输入合法时提交到 store
  const [customDraft, setCustomDraft] = useState<string>(
    isCustomSize ? String(params.size) : ""
  );
  useEffect(() => {
    if (isCustomSize) setCustomDraft(String(params.size));
  }, [isCustomSize, params.size]);

  const commitCustomSize = (raw: string): void => {
    const v = Number(raw);
    if (Number.isInteger(v) && v >= SIZE_MIN && v <= SIZE_MAX) {
      setParam("size", v);
    } else if (isCustomSize) {
      // 非法输入还原为当前生效值
      setCustomDraft(String(params.size));
    }
  };

  const jpgOnlyHint =
    params.ext === ".png" ? "（PNG 输出不使用质量参数）" : "";

  return (
    <aside className="params-panel">
      <div className="params-section">
        <div className="params-label">
          压缩质量
          <span className="value">
            {params.quality}
            {jpgOnlyHint}
          </span>
        </div>
        <div className="slider-row">
          <input
            type="range"
            min={1}
            max={100}
            value={params.quality}
            disabled={running}
            onChange={e => setParam("quality", Number(e.target.value))}
          />
          <input
            className="number-input"
            type="number"
            min={1}
            max={100}
            value={params.quality}
            disabled={running}
            onChange={e => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 1 && v <= 100) {
                setParam("quality", v);
              }
            }}
          />
        </div>
        <div className="params-hint">仅对 JPG 输出生效，值越低体积越小。</div>
      </div>

      <div className="params-section">
        <div className="params-label">
          最长边尺寸
          <span className="value">
            {params.size === null ? "保持原尺寸" : `${params.size} px`}
          </span>
        </div>
        <div className="size-grid">
          {SIZE_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              className={params.size === preset.value ? "active" : ""}
              disabled={running}
              onClick={() => setParam("size", preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="size-custom-row">
          <span className={`size-custom-label${isCustomSize ? " active" : ""}`}>
            自定义
          </span>
          <input
            className="number-input size-custom-input"
            type="number"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={1}
            placeholder="如 1600"
            value={customDraft}
            disabled={running}
            onChange={e => {
              const raw = e.target.value;
              setCustomDraft(raw);
              const v = Number(raw);
              if (Number.isInteger(v) && v >= SIZE_MIN && v <= SIZE_MAX) {
                setParam("size", v);
              }
            }}
            onBlur={e => commitCustomSize(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                commitCustomSize((e.target as HTMLInputElement).value);
              }
            }}
          />
          <span className="size-custom-unit">px</span>
        </div>
        <div className="params-hint">
          按最长边等比缩小，不会放大小图；自定义范围 {SIZE_MIN}-{SIZE_MAX}。
        </div>
      </div>

      <div className="params-section">
        <div className="params-label">输出格式</div>
        <div className="segmented">
          {(
            [
              { label: "保持原格式", value: null },
              { label: "JPG", value: ".jpg" },
              { label: "PNG", value: ".png" }
            ] as const
          ).map(opt => (
            <button
              key={opt.label}
              type="button"
              className={params.ext === opt.value ? "active" : ""}
              disabled={running}
              onClick={() => setParam("ext", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="params-section">
        <div className="switch-row" style={{ marginBottom: 12 }}>
          <span className="label">递归扫描子目录</span>
          <button
            type="button"
            role="switch"
            aria-checked={params.recursive}
            className={`switch${params.recursive ? " on" : ""}`}
            disabled={running}
            onClick={() => setParam("recursive", !params.recursive)}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="switch-row">
          <span className="label">保留目录结构</span>
          <button
            type="button"
            role="switch"
            aria-checked={params.preserveStructure}
            className={`switch${params.preserveStructure ? " on" : ""}`}
            disabled={running}
            onClick={() => setParam("preserveStructure", !params.preserveStructure)}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="params-hint">
          递归开关对之后添加的文件夹生效；关闭目录结构则全部平铺输出。
        </div>
      </div>

      <div className="params-section">
        <div className="params-label">
          并发数
          <span className="value">{params.concurrency}</span>
        </div>
        <div className="segmented">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              type="button"
              className={params.concurrency === n ? "active" : ""}
              disabled={running}
              onClick={() => setParam("concurrency", n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="params-section">
        <div className="params-label">输出目录</div>
        <div className="outdir-row">
          <div
            className="outdir-path"
            title={params.outputDir ?? "源目录旁的 compressed 文件夹"}
          >
            {params.outputDir ?? "源目录旁 compressed"}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={running}
            title="选择输出目录"
            onClick={() => {
              void window.app.pickOutputDirectory().then(dir => {
                if (dir) setParam("outputDir", dir);
              });
            }}
          >
            <FolderOutput size={14} />
          </button>
          {params.outputDir !== null && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={running}
              title="恢复默认输出目录"
              onClick={() => setParam("outputDir", null)}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
        <div className="params-hint">输出永不覆盖原图，重名文件自动追加序号。</div>
      </div>
    </aside>
  );
}
