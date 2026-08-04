/**
 * 压缩任务编排：扫描 → 输出规划 → 并发队列 → 进度/结果事件。
 * 全部在主进程执行，渲染进程只收事件。
 */
import fs from "node:fs";
import path from "node:path";
import {
  ConfigError,
  DEFAULT_OUTPUT_DIR_NAME,
  TaskQueue,
  isAbortError,
  planOutputs,
  processImage,
  readImageInfoFromFile,
  scanPathsAsync,
  suggestSmartOptions
} from "@giszhc/vips-thumbnail-core";
import type {
  FileEntry,
  OutputPlanRequest,
  TaskResult
} from "@giszhc/vips-thumbnail-core";
import type {
  ScanProgressEvent,
  ScanRequest,
  TaskFinishedEvent,
  TaskItemDoneEvent,
  TaskProgressEvent,
  TaskStartRequest,
  TaskSummary
} from "../../shared/ipc-types";
import type { VipsService } from "./vipsService";
import { logCrash, logInfo } from "../crash-logger";

export interface ProcessServiceEvents {
  onScanProgress: (event: ScanProgressEvent) => void;
  onTaskProgress: (event: TaskProgressEvent) => void;
  onTaskItemDone: (event: TaskItemDoneEvent) => void;
  onTaskFinished: (event: TaskFinishedEvent) => void;
}

interface RunningTask {
  taskId: string;
  queue: TaskQueue;
}

export class ProcessService {
  private taskCounter = 0;
  private running: RunningTask | null = null;

  constructor(
    private readonly vips: VipsService,
    private readonly events: ProcessServiceEvents
  ) {}

  get hasRunningTask(): boolean {
    return this.running !== null;
  }

  /** 读取单张图片的宽高（结果弹窗「前后对比」使用；解析失败返回 null） */
  async imageInfo(
    filePath: string
  ): Promise<{ width: number; height: number } | null> {
    const info = await readImageInfoFromFile(filePath);
    if (!info || info.width <= 0 || info.height <= 0) return null;
    return { width: info.width, height: info.height };
  }

  async scan(request: ScanRequest): Promise<FileEntry[]> {
    // 列表不展示尺寸/缩略图，跳过逐文件解析图片头；进度事件节流，避免海量文件时 IPC 风暴
    let lastEmit = 0;
    const emit = (scanned: number, currentPath: string, force = false): void => {
      const now = Date.now();
      if (!force && now - lastEmit < 100) return;
      lastEmit = now;
      this.events.onScanProgress({ scanned, currentPath });
    };
    const entries = await scanPathsAsync(
      request.paths,
      { recursive: request.recursive, skipImageInfo: true },
      {
        onProgress: progress => emit(progress.scanned, progress.currentPath)
      }
    );
    emit(entries.length, "", true);
    return entries;
  }

  /**
   * 启动压缩任务。outputDir 为 null 时按「各文件源目录旁 compressed」规则。
   * 返回 taskId；任务异步执行，完成后推 task:finished。
   */
  async start(request: TaskStartRequest): Promise<{ taskId: string }> {
    logInfo(
      "task",
      `start 请求：files=${request.entries.length} mode=${request.mode} concurrency=${request.concurrency} outputDir=${request.outputDir ?? "(源目录/compressed)"} smart=${request.smart === true} name=${request.name ?? "图片优化"} options=${JSON.stringify(request.options)}`
    );
    if (this.running) {
      throw new ConfigError("已有任务进行中，请先取消或等待完成");
    }
    const vipsCommand = await this.vips.ensureReady();
    logInfo("task", `vips 命令：${vipsCommand}`);

    const taskId = `task-${++this.taskCounter}`;
    const startedAt = Date.now();
    // 智能模式：每个文件按其格式独立决策（照片→WebP、动图保持、SVG→PNG 等）
    const smart = request.smart === true;
    const resolveOptions = (entry: FileEntry) =>
      smart ? suggestSmartOptions(entry.ext) : request.options;
    const taskName = request.name?.trim() || "图片优化";

    // 输出规划：全局去重、永不覆盖原图
    const planRequests: OutputPlanRequest[] = request.entries.map(entry => ({
      input: entry.absolutePath,
      outDir:
        request.outputDir ??
        path.join(entry.rootDir, DEFAULT_OUTPUT_DIR_NAME),
      mode: request.mode,
      ext: resolveOptions(entry).ext,
      baseDir: entry.rootDir,
      dedup: true
    }));
    const outputPlan = planOutputs(planRequests);
    for (const [input, output] of outputPlan) {
      logInfo("task", `输出规划：${input} -> ${output}`);
    }

    const queue = new TaskQueue({ concurrency: request.concurrency });
    this.running = { taskId, queue };

    const total = request.entries.length;

    // 异步执行，不阻塞 IPC 返回
    void (async () => {
      let results: TaskResult[] = [];
      try {
        results = await queue.run(
          request.entries,
          async (entry, signal): Promise<TaskResult> => {
            const output = outputPlan.get(entry.absolutePath);
            if (!output) {
              return {
                input: entry.absolutePath,
                output: "",
                status: "failed",
                originalSize: entry.size,
                compressedSize: 0,
                error: "无法规划输出路径"
              };
            }
            try {
              logInfo("item", `开始处理：${entry.absolutePath}`);
              await fs.promises.mkdir(path.dirname(output), { recursive: true });
              logInfo("item", `输出目录已就绪：${path.dirname(output)}`);
              await processImage(entry.absolutePath, output, {
                ...resolveOptions(entry),
                vipsCommand,
                signal
              });
              logInfo("item", `vips 处理完成：${output}`);
              const stat = await fs.promises.stat(output);
              logInfo("item", `产物大小：${stat.size} 字节`);
              return {
                input: entry.absolutePath,
                output,
                status: "done",
                originalSize: entry.size,
                compressedSize: stat.size
              };
            } catch (error) {
              if (isAbortError(error)) {
                return {
                  input: entry.absolutePath,
                  output,
                  status: "canceled",
                  originalSize: entry.size,
                  compressedSize: 0
                };
              }
              logCrash("item", error);
              return {
                input: entry.absolutePath,
                output,
                status: "failed",
                originalSize: entry.size,
                compressedSize: 0,
                error: error instanceof Error ? error.message : String(error)
              };
            }
          },
          {
            onItemStart: index => {
              this.events.onTaskProgress({
                taskId,
                done: Math.min(index, total),
                total,
                percent: Math.round((index / total) * 100),
                currentFile: request.entries[index]?.absolutePath ?? ""
              });
            },
            onItemEnd: (result, index) => {
              logInfo(
                "item",
                `完成 #${index}: status=${result.status} ${result.originalSize}B -> ${result.compressedSize}B ${result.error ? `error=${result.error}` : ""}`
              );
              try {
                this.events.onTaskItemDone({ taskId, index, result });
              } catch (err) {
                logCrash("onItemEnd", err);
              }
            },
            onProgress: done => {
              this.events.onTaskProgress({
                taskId,
                done,
                total,
                percent: Math.round((done / total) * 100),
                currentFile: ""
              });
            }
          }
        );
      } finally {
        this.running = null;
      }

      // 修复：队列对“未启动”的任务标为 canceled，但其 input 为空（队列不感知
      // absolutePath），渲染层无法据此定位条目，会导致取消后这些条目卡在 pending，
      // 进而文件夹聚合行的“处理中”图标一直转圈。这里用 entries[i].absolutePath
      // 统一回填 key。
      results = results.map((r, i) =>
        r.input ? r : { ...r, input: request.entries[i]?.absolutePath ?? r.input }
      );

      const summary = summarize(results, startedAt, request);
      logInfo("task", `任务结束：${JSON.stringify(summary)}`);
      this.events.onTaskFinished({ taskId, summary, results, name: taskName });
      logInfo("task", "finished 事件已推送");
    })().catch(err => {
      // 队列结构性异常（非单项失败）兜底记录，避免未捕获 rejection 杀掉主进程
      logCrash("processTask", err);
    });

    return { taskId };
  }

  cancel(taskId: string): void {
    if (this.running && this.running.taskId === taskId) {
      this.running.queue.cancel();
    }
  }

  cancelAll(): void {
    this.running?.queue.cancel();
  }
}

function summarize(
  results: TaskResult[],
  startedAt: number,
  request: TaskStartRequest
): TaskSummary {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let canceled = 0;
  let originalTotal = 0;
  let compressedTotal = 0;
  for (const result of results) {
    if (result.status === "done") {
      success += 1;
      originalTotal += result.originalSize;
      compressedTotal += result.compressedSize;
    } else if (result.status === "failed") failed += 1;
    else if (result.status === "skipped") skipped += 1;
    else if (result.status === "canceled") canceled += 1;
  }
  const outputDir =
    request.outputDir ??
    (request.entries[0]
      ? path.join(request.entries[0].rootDir, DEFAULT_OUTPUT_DIR_NAME)
      : "");
  return {
    success,
    failed,
    skipped,
    canceled,
    originalTotal,
    compressedTotal,
    durationMs: Date.now() - startedAt,
    outputDir
  };
}
