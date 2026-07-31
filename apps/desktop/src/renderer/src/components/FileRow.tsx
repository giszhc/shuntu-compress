/**
 * 列表行组件（轻量化，无缩略图）：
 * - FileRow：单个文件行（名称 + 大小 + 状态 + 移除）。
 * - DirRow：文件夹聚合行（一个文件夹只占一行，显示张数/总大小/聚合进度）。
 * 本工具定位是压缩而非看图，行内不做任何图片解码，保证大列表流畅。
 */
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  FileImage,
  FolderOpen,
  Loader2,
  Trash2,
  XCircle
} from "lucide-react";
import { memo } from "react";
import type { FileEntry } from "../../../shared/ipc-types";
import type { ItemState } from "../stores/fileStore";
import { formatBytes, formatSaving } from "../utils/format";

interface FileProps {
  entry: FileEntry;
  item: ItemState | undefined;
  running: boolean;
  top: number;
  onRemove(absolutePath: string): void;
}

function StatusCell({ entry, item }: { entry: FileEntry; item: ItemState | undefined }) {
  if (!item) {
    return <span className="status-pending status-text">待处理</span>;
  }
  switch (item.status) {
    case "pending":
      return (
        <span className="status-pending status-text">
          <CircleDashed size={13} style={{ verticalAlign: "-2px" }} /> 排队中
        </span>
      );
    case "processing":
      return (
        <span className="status-processing status-text">
          <Loader2 size={13} className="spin" style={{ verticalAlign: "-2px" }} /> 处理中
        </span>
      );
    case "done":
      return (
        <span className="status-done status-text" title={item.output}>
          <CheckCircle2 size={13} style={{ verticalAlign: "-2px" }} />{" "}
          {formatBytes(item.compressedSize ?? 0)}（
          {formatSaving(entry.size, item.compressedSize ?? entry.size)}）
        </span>
      );
    case "skipped":
      return <span className="status-canceled status-text">已跳过</span>;
    case "failed":
      return (
        <span className="status-failed status-text" title={item.error}>
          <XCircle size={13} style={{ verticalAlign: "-2px" }} /> 失败
        </span>
      );
    case "canceled":
      return (
        <span className="status-canceled status-text">
          <Ban size={13} style={{ verticalAlign: "-2px" }} /> 已取消
        </span>
      );
    default:
      return null;
  }
}

export const FileRow = memo(function FileRow({
  entry,
  item,
  running,
  top,
  onRemove
}: FileProps): React.JSX.Element {
  const ext = entry.fileName.toLowerCase().split(".").pop() ?? "";
  // 所有图片统一蓝色标识（jpg/png/webp 同色），文件夹黄色，其他灰色
  const iconTone =
    ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp"
      ? "image"
      : "other";
  return (
    <div className="file-row" style={{ top }}>
      <div className={`file-icon file-icon--${iconTone}`}>
        <FileImage size={20} />
      </div>
      <div className="col-name">
        <div className="name" title={entry.absolutePath}>
          {entry.fileName}
        </div>
        <div className="sub" title={entry.absolutePath}>
          {entry.absolutePath}
        </div>
      </div>
      <div className="col-size">{formatBytes(entry.size)}</div>
      <div className="col-status">
        <StatusCell entry={entry} item={item} />
      </div>
      <div className="col-actions">
        <button
          type="button"
          title="移除"
          disabled={running}
          onClick={() => onRemove(entry.absolutePath)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

/** 文件夹聚合状态（由 FileArea 汇总后传入） */
export interface DirAggregate {
  count: number;
  totalSize: number;
  done: number;
  failed: number;
  processing: number;
  queued: number;
  compressedTotal: number;
  doneOriginalTotal: number;
}

interface DirProps {
  rootDir: string;
  dirName: string;
  agg: DirAggregate;
  running: boolean;
  top: number;
  onRemoveDir(rootDir: string): void;
}

function DirStatusCell({ agg }: { agg: DirAggregate }) {
  const settled = agg.done + agg.failed;
  if (agg.processing > 0 || (agg.queued > 0 && settled > 0)) {
    return (
      <span className="status-processing status-text">
        <Loader2 size={13} className="spin" style={{ verticalAlign: "-2px" }} />{" "}
        {settled}/{agg.count}
      </span>
    );
  }
  if (agg.queued > 0) {
    return (
      <span className="status-pending status-text">
        <CircleDashed size={13} style={{ verticalAlign: "-2px" }} /> 排队中
      </span>
    );
  }
  if (agg.done > 0 && agg.failed === 0 && settled === agg.count) {
    return (
      <span className="status-done status-text">
        <CheckCircle2 size={13} style={{ verticalAlign: "-2px" }} />{" "}
        {formatBytes(agg.compressedTotal)}（
        {formatSaving(agg.doneOriginalTotal, agg.compressedTotal)}）
      </span>
    );
  }
  if (agg.failed > 0) {
    return (
      <span className="status-failed status-text">
        <XCircle size={13} style={{ verticalAlign: "-2px" }} /> {agg.failed} 个失败
      </span>
    );
  }
  return <span className="status-pending status-text">待处理</span>;
}

export const DirRow = memo(function DirRow({
  rootDir,
  dirName,
  agg,
  running,
  top,
  onRemoveDir
}: DirProps): React.JSX.Element {
  return (
    <div className="file-row dir-row" style={{ top }}>
      <div className="file-icon file-icon--dir">
        <FolderOpen size={20} />
      </div>
      <div className="col-name">
        <div className="name" title={rootDir}>
          {dirName}
        </div>
        <div className="sub" title={rootDir}>
          {agg.count} 张图片 · {rootDir}
        </div>
      </div>
      <div className="col-size">{formatBytes(agg.totalSize)}</div>
      <div className="col-status">
        <DirStatusCell agg={agg} />
      </div>
      <div className="col-actions">
        <button
          type="button"
          title="移除该文件夹全部图片"
          disabled={running}
          onClick={() => onRemoveDir(rootDir)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});
