/**
 * 文件区：空状态 / 虚拟列表 / 拖拽接收。
 * - 文件夹扫描结果按 rootDir 聚合为一行（本工具重在压缩而非看图），
 *   单独添加的文件仍逐行展示；行内无缩略图、无图片解码，大列表不卡。
 * - 拖拽路径通过 preload 的 dropUtils.getPathsForFiles 提取（渲染进程无 Node 能力）。
 */
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FolderOpen,
  ImageDown,
  ImageIcon,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../../../shared/ipc-types";
import { useFileStore } from "../stores/fileStore";
import { useTaskStore } from "../stores/taskStore";
import { formatBytes } from "../utils/format";
import { DirRow, FileRow } from "./FileRow";
import type { DirAggregate } from "./FileRow";
import "../styles/compress.css";

const ROW_HEIGHT = 64; // 与 .file-row height 保持一致（缩略图加大后行高增加）

type Row =
  | { kind: "file"; entry: FileEntry }
  | { kind: "dir"; rootDir: string; dirName: string; members: FileEntry[] };

export function FileArea(): React.JSX.Element {
  const entries = useFileStore(s => s.entries);
  const items = useFileStore(s => s.items);
  const scanning = useFileStore(s => s.scanning);
  const scannedCount = useFileStore(s => s.scannedCount);
  const addPaths = useFileStore(s => s.addPaths);
  const remove = useFileStore(s => s.remove);
  const removeDir = useFileStore(s => s.removeDir);
  const clear = useFileStore(s => s.clear);
  const running = useTaskStore(s => s.running);

  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 文件夹聚合：同一 rootDir 的扫描结果折叠为一行；行结构只依赖 entries
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const dirMap = new Map<string, Extract<Row, { kind: "dir" }>>();
    for (const entry of entries) {
      if (entry.fromDir) {
        let group = dirMap.get(entry.rootDir);
        if (!group) {
          group = {
            kind: "dir",
            rootDir: entry.rootDir,
            dirName: entry.rootDir.split(/[\\/]/).filter(Boolean).pop() ?? entry.rootDir,
            members: []
          };
          dirMap.set(entry.rootDir, group);
          out.push(group);
        }
        group.members.push(entry);
      } else {
        out.push({ kind: "file", entry });
      }
    }
    return out;
  }, [entries]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  });

  const pickFiles = useCallback(async () => {
    const paths = await window.app.openFiles();
    if (paths.length > 0) await addPaths(paths);
  }, [addPaths]);

  const pickDirectory = useCallback(async () => {
    const dir = await window.app.openDirectory();
    if (dir) await addPaths([dir]);
  }, [addPaths]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (running) return;
      const files = Array.from(e.dataTransfer.files);
      const paths = window.dropUtils.getPathsForFiles(files);
      if (paths.length > 0) void addPaths(paths);
    },
    [addPaths, running]
  );

  const totalSize = useMemo(
    () => entries.reduce((sum, e) => sum + e.size, 0),
    [entries]
  );

  /** 只对可见的文件夹行做聚合统计，开销与可见行数相关而非总量 */
  const aggregateDir = (members: FileEntry[]): DirAggregate => {
    const agg: DirAggregate = {
      count: members.length,
      totalSize: 0,
      done: 0,
      failed: 0,
      processing: 0,
      queued: 0,
      compressedTotal: 0,
      doneOriginalTotal: 0
    };
    for (const m of members) {
      agg.totalSize += m.size;
      const item = items[m.absolutePath];
      if (!item) continue;
      if (item.status === "done") {
        agg.done += 1;
        agg.compressedTotal += item.compressedSize ?? 0;
        agg.doneOriginalTotal += m.size;
      } else if (item.status === "failed") agg.failed += 1;
      else if (item.status === "processing") agg.processing += 1;
      else if (item.status === "pending") agg.queued += 1;
    }
    return agg;
  };

  return (
    <section
      className={`compress-drop${dragOver ? " drag-over" : ""}`}
      onDragEnter={e => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragOver(false);
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      {entries.length > 0 && (
        <div className="compress-drop-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={running || scanning}
            onClick={() => void pickFiles()}
          >
            <ImagePlus size={14} /> 添加文件
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={running || scanning}
            onClick={() => void pickDirectory()}
          >
            <FolderOpen size={14} /> 添加文件夹
          </button>
          <div className="spacer" />
          <span className="compress-drop-toolbar-info">
            {scanning
              ? `正在扫描…已发现 ${scannedCount} 张`
              : `共 ${entries.length} 张图片 · ${formatBytes(totalSize)}`}
          </span>
          <button
            type="button"
            className="btn btn-danger-soft"
            disabled={running || scanning}
            onClick={clear}
            title="清空列表"
          >
            <Trash2 size={14} /> 清空
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="compress-drop-empty">
          <div className="compress-drop-icon">
            {scanning ? (
              <Loader2 size={44} className="spin" strokeWidth={1.6} />
            ) : (
              <ImageDown size={44} strokeWidth={1.5} />
            )}
            <div className="compress-drop-icon-sparkle" aria-hidden>
              <Sparkles size={14} />
            </div>
          </div>
          <h3 className="compress-drop-title">
            {scanning
              ? `正在扫描图片…${scannedCount > 0 ? `已发现 ${scannedCount} 张` : ""}`
              : "拖入图片或文件夹开始压缩"}
          </h3>
          <p className="compress-drop-desc">
            支持 JPG / PNG / WebP / GIF / TIFF / BMP 等格式，可拖入多个文件或整个文件夹
            <br />
            <span className="sub">输出保存到独立目录，绝不覆盖原图</span>
          </p>
          {!scanning && (
            <div className="compress-drop-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void pickFiles()}
              >
                <ImageIcon size={15} /> 选择文件
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => void pickDirectory()}
              >
                <FolderOpen size={15} /> 选择文件夹
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 列标题 */}
          <div className="compress-file-list-header">
            <span className="col-name-head">文件名</span>
            <span className="col-size-head">大小</span>
            <span className="col-status-head">状态</span>
            <span className="col-actions-head">操作</span>
          </div>
          {/* 虚拟列表 */}
          <div className="compress-file-list" ref={scrollRef}>
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map(v => {
                const row = rows[v.index];
                if (row.kind === "dir") {
                  return (
                    <DirRow
                      key={`dir:${row.rootDir}`}
                      rootDir={row.rootDir}
                      dirName={row.dirName}
                      agg={aggregateDir(row.members)}
                      running={running}
                      top={v.start}
                      onRemoveDir={removeDir}
                    />
                  );
                }
                return (
                  <FileRow
                    key={row.entry.absolutePath}
                    entry={row.entry}
                    item={items[row.entry.absolutePath]}
                    running={running}
                    top={v.start}
                    onRemove={remove}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {dragOver && (
        <div className="compress-drop-hint">
          <span>松开以添加图片</span>
        </div>
      )}
    </section>
  );
}
