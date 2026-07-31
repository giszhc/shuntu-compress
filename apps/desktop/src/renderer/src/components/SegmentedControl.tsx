/**
 * 分段控件（SegmentedControl）：统一选中态为蓝色实心 + 白字。
 * 压缩模块（输出格式 / 并发数）与设置模块（默认并发数 / 主题）共用。
 */
import type { ReactNode } from "react";
import "../styles/compress.css";

export interface SegmentedOption<T> {
  label: ReactNode;
  value: T;
}

interface SegmentedControlProps<T> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
  /** 可选最小宽度（设置页"主题"等长选项需要） */
  minWidth?: number;
}

export function SegmentedControl<T extends string | number | null>({
  options,
  value,
  onChange,
  disabled,
  minWidth
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div className="compress-segmented" style={minWidth ? { minWidth } : undefined}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          className={value === opt.value ? "active" : ""}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
