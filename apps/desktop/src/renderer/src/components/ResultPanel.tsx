/**
 * 任务完成结果面板（V1.1 升级版）：
 * - 顶部：🎉 优化完成 + 整体星级评分；
 * - Hero 区：节省空间大数字 + 压缩比例 + 评分等级；
 * - 数据网格：图片数量 / 耗时 / 原始总大小 / 压缩后总大小 / 失败统计 / 输出目录；
 * - 前后对比列表：每个成功文件 原大小 → 新大小 + 节省百分比，点击查看预览对比；
 * - 对比弹层：原图与优化后缩略图并排，展示尺寸、格式、大小。
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  ImageDown,
  Star,
  X
} from "lucide-react";
import type { TaskResult } from "../../../shared/ipc-types";
import { useFileStore } from "../stores/fileStore";
import { useTaskStore } from "../stores/taskStore";
import { formatBytes, formatDuration, formatPercent, formatSaving } from "../utils/format";
import { openFolder } from "../utils/openFolder";
import { computeScore, isOptimizedFormat } from "../utils/score";

function fileExt(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf("."), -1);
  return idx >= 0 ? filePath.slice(idx).toLowerCase() : "";
}

/** 星级展示：实心 × 空心 */
function Stars({ count }: { count: number }): React.JSX.Element {
  return (
    <span className="result-stars" aria-label={`${count} 星`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={16}
          className={n <= count ? "star-filled" : "star-empty"}
          fill={n <= count ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

const LEVEL_CLASS: Record<string, string> = {
  excellent: "score-excellent",
  good: "score-good",
  fair: "score-fair",
  poor: "score-poor"
};

interface CompareItem {
  input: string;
  output: string;
  originalSize: number;
  compressedSize: number;
}

/** 单图前后对比弹层：并排缩略图 + 尺寸 / 格式 / 大小 */
function CompareModal({
  item,
  onClose
}: {
  item: CompareItem;
  onClose(): void;
}): React.JSX.Element {
  const [inputImg, setInputImg] = useState<string>("");
  const [outputImg, setOutputImg] = useState<string>("");
  const [inputSize, setInputSize] = useState<{ width: number; height: number } | null>(null);
  const [outputSize, setOutputSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      window.app.thumbnail(item.input),
      window.app.thumbnail(item.output),
      window.app.imageInfo(item.input),
      window.app.imageInfo(item.output)
    ]).then(([inThumb, outThumb, inInfo, outInfo]) => {
      if (!alive) return;
      setInputImg(inThumb.dataUrl);
      setOutputImg(outThumb.dataUrl);
      setInputSize(inInfo);
      setOutputSize(outInfo);
    });
    return () => {
      alive = false;
    };
  }, [item]);

  const renderSide = (
    label: string,
    img: string,
    path: string,
    size: { width: number; height: number } | null,
    bytes: number,
    tone: "before" | "after"
  ): React.JSX.Element => (
    <div className={`compare-side compare-side--${tone}`}>
      <div className="compare-side-title">{label}</div>
      <div className="compare-thumb">
        {img ? (
          <img src={img} alt={label} />
        ) : (
          <div className="compare-thumb-placeholder">
            <ImageDown size={26} />
          </div>
        )}
      </div>
      <div className="compare-meta">
        <div>
          <span className="k">尺寸</span>
          <span className="v">
            {size ? `${size.width} × ${size.height}` : "—"}
          </span>
        </div>
        <div>
          <span className="k">格式</span>
          <span className="v">{fileExt(path).slice(1).toUpperCase() || "—"}</span>
        </div>
        <div>
          <span className="k">大小</span>
          <span className="v">{formatBytes(bytes)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="result-overlay result-overlay--compare" onClick={onClose}>
      <div className="compare-modal" onClick={e => e.stopPropagation()}>
        <div className="compare-modal-header">
          <h3>前后对比</h3>
          <button type="button" className="compare-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="compare-body">
          {renderSide(
            "压缩前",
            inputImg,
            item.input,
            inputSize,
            item.originalSize,
            "before"
          )}
          <div className="compare-arrow">
            <ArrowRight size={22} />
          </div>
          {renderSide(
            "压缩后",
            outputImg,
            item.output,
            outputSize,
            item.compressedSize,
            "after"
          )}
        </div>
        <div className="compare-summary">
          节省 {formatBytes(Math.max(0, item.originalSize - item.compressedSize))}（
          {formatPercent(item.originalSize, item.compressedSize)}）
        </div>
      </div>
    </div>
  );
}

export function ResultPanel(): React.JSX.Element | null {
  const showResult = useTaskStore(s => s.showResult);
  const summary = useTaskStore(s => s.summary);
  const results = useTaskStore(s => s.results);
  const closeResult = useTaskStore(s => s.closeResult);
  const items = useFileStore(s => s.items);
  const [compareItem, setCompareItem] = useState<CompareItem | null>(null);

  const doneResults = useMemo(
    () =>
      (results ?? []).filter(
        (r): r is TaskResult & { output: string } =>
          r.status === "done" && Boolean(r.input) && Boolean(r.output)
      ),
    [results]
  );

  // 整体评分：体积为主，格式/分辨率为辅（与逐图评分同源算法）
  const overall = useMemo(() => {
    const formatChanged = doneResults.some(r => fileExt(r.input) !== fileExt(r.output));
    const formatOptimized =
      doneResults.length > 0 &&
      doneResults.every(r => isOptimizedFormat(fileExt(r.output)));
    return computeScore({
      originalSize: summary?.originalTotal ?? 0,
      compressedSize: summary?.compressedTotal ?? 0,
      formatChanged,
      formatOptimized
    });
  }, [doneResults, summary]);

  if (!showResult || !summary) return null;

  const failures = Object.entries(items).filter(
    ([, item]) => item.status === "failed" && item.error
  );
  const savedBytes = Math.max(0, summary.originalTotal - summary.compressedTotal);
  const levelClass = LEVEL_CLASS[overall.level] ?? "score-fair";

  return (
    <div className="result-overlay" onClick={closeResult}>
      <div className="result-panel result-panel--v11" onClick={e => e.stopPropagation()}>
        <div className="result-header">
          <CheckCircle2 size={20} color="var(--success)" />
          <h2>图片优化完成</h2>
          {overall.stars > 0 && <Stars count={overall.stars} />}
          <span className={`result-level ${levelClass}`}>{overall.label}</span>
        </div>

        {/* Hero：节省空间 + 压缩比例 + 评分 */}
        <div className="result-hero">
          <div className="result-hero-saved">
            <div className="k">共节省空间</div>
            <div className="v">{formatBytes(savedBytes)}</div>
          </div>
          <div className="result-hero-divider" />
          <div className="result-hero-metric">
            <div className="k">压缩比例</div>
            <div className="v">{formatPercent(summary.originalTotal, summary.compressedTotal)}</div>
          </div>
          <div className="result-hero-metric">
            <div className="k">优化评分</div>
            <div className="v">{overall.score} 分</div>
          </div>
        </div>

        <div className="result-grid">
          <div className="result-item">
            <div className="k">处理图片</div>
            <div className="v">{summary.success} 张</div>
          </div>
          <div className="result-item">
            <div className="k">耗时</div>
            <div className="v">{formatDuration(summary.durationMs)}</div>
          </div>
          <div className="result-item">
            <div className="k">原始总大小</div>
            <div className="v">{formatBytes(summary.originalTotal)}</div>
          </div>
          <div className="result-item">
            <div className="k">压缩后总大小</div>
            <div className="v success">
              {formatBytes(summary.compressedTotal)}（{formatSaving(summary.originalTotal, summary.compressedTotal)}）
            </div>
          </div>
          <div className="result-item">
            <div className="k">失败 / 跳过 / 取消</div>
            <div className={`v${summary.failed > 0 ? " danger" : ""}`}>
              {summary.failed} / {summary.skipped} / {summary.canceled}
            </div>
          </div>
          <div className="result-item">
            <div className="k">输出目录</div>
            <div className="v" title={summary.outputDir} style={{ fontSize: 12 }}>
              {summary.outputDir}
            </div>
          </div>
        </div>

        {/* 前后对比列表 */}
        {doneResults.length > 0 && (
          <div className="result-compare">
            <div className="result-compare-title">
              前后对比
              <span className="sub">{doneResults.length} 张</span>
            </div>
            <div className="result-compare-list">
              {doneResults.map(r => (
                <button
                  key={r.output}
                  type="button"
                  className="result-compare-row"
                  onClick={() =>
                    setCompareItem({
                      input: r.input,
                      output: r.output,
                      originalSize: r.originalSize,
                      compressedSize: r.compressedSize
                    })
                  }
                >
                  <span className="name" title={r.input}>
                    {r.input.split(/[\\/]/).pop()}
                  </span>
                  <span className="sizes">
                    <span className="before">{formatBytes(r.originalSize)}</span>
                    <ArrowRight size={13} className="arrow" />
                    <span className="after">{formatBytes(r.compressedSize)}</span>
                    <span className="saving">
                      -{formatPercent(r.originalSize, r.compressedSize)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {failures.length > 0 && (
          <div className="result-errors">
            {failures.map(([path, item]) => (
              <div key={path} title={`${path}: ${item.error}`}>
                {path}：{item.error}
              </div>
            ))}
          </div>
        )}
        <div className="result-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void openFolder(summary.outputDir)}
          >
            <FolderOpen size={14} /> 打开输出目录
          </button>
          <button type="button" className="btn btn-primary" onClick={closeResult}>
            知道了
          </button>
        </div>
      </div>
      {compareItem && <CompareModal item={compareItem} onClose={() => setCompareItem(null)} />}
    </div>
  );
}
