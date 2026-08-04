/** 字节数 → 人类可读（B/KB/MB/GB） */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

/** 压缩节省百分比文案，例如 “-63.2%”；异常输入返回 “—” */
export function formatSaving(original: number, compressed: number): string {
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(compressed)) {
    return "—";
  }
  const ratio = ((original - compressed) / original) * 100;
  const sign = ratio >= 0 ? "-" : "+";
  return `${sign}${Math.abs(ratio).toFixed(1)}%`;
}

/** 节省比例正数文案，例如 “88.2%”；无收益返回 “0.0%” */
export function formatPercent(original: number, compressed: number): string {
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(compressed)) {
    return "—";
  }
  const ratio = Math.max(0, ((original - compressed) / original) * 100);
  return `${ratio.toFixed(1)}%`;
}

/** 毫秒 → “x.x 秒 / x 分 x 秒” */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} 分 ${rest} 秒`;
}
