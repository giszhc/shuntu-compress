/**
 * 历史优化记录持久化：userData/history.json（UTF-8）。
 * - 新记录插到最前，最多保留 HISTORY_LIMIT 条（防无限增长）；
 * - 读取失败/损坏时回退空列表并重写文件；
 * - 写入失败不阻断任务流程（历史是附加价值，不是主链路）。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { HistoryRecord, HistorySummary } from "../../shared/ipc-types";

/** 本地最多保留的记录条数 */
const HISTORY_LIMIT = 200;

export interface NewHistoryRecord {
  taskName: string;
  fileCount: number;
  beforeSize: number;
  afterSize: number;
  durationMs: number;
  outputDir: string;
}

export class HistoryService {
  private cache: HistoryRecord[] | null = null;

  constructor(
    private readonly filePath = path.join(app.getPath("userData"), "history.json")
  ) {}

  /** 返回累计统计 + 全部记录（新在前） */
  get(): HistorySummary {
    const records = this.read();
    let totalCount = 0;
    let totalSaved = 0;
    for (const record of records) {
      totalCount += record.fileCount;
      totalSaved += record.savedSize;
    }
    return { totalCount, totalSaved, records };
  }

  /** 追加一条记录（插入最前，超限截断） */
  add(input: NewHistoryRecord): void {
    const beforeSize = Math.max(0, Math.floor(input.beforeSize));
    const afterSize = Math.max(0, Math.floor(input.afterSize));
    const savedSize = beforeSize - afterSize;
    const savedPercent =
      beforeSize > 0 ? Math.round((savedSize / beforeSize) * 1000) / 10 : 0;
    const record: HistoryRecord = {
      id: crypto.randomUUID(),
      createTime: Date.now(),
      taskName: input.taskName || "图片优化",
      fileCount: Math.max(0, Math.floor(input.fileCount)),
      beforeSize,
      afterSize,
      savedSize,
      savedPercent,
      durationMs: Math.max(0, Math.floor(input.durationMs)),
      outputDir: input.outputDir || ""
    };
    const records = this.read();
    records.unshift(record);
    if (records.length > HISTORY_LIMIT) {
      records.length = HISTORY_LIMIT;
    }
    this.cache = records;
    this.persist(records);
  }

  clear(): void {
    this.cache = [];
    this.persist([]);
  }

  private read(): HistoryRecord[] {
    if (this.cache) return this.cache;
    let records: HistoryRecord[] = [];
    try {
      const text = fs.readFileSync(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        records = parsed
          .filter((r): r is HistoryRecord => isValidRecord(r))
          .slice(0, HISTORY_LIMIT);
      }
    } catch {
      records = [];
    }
    this.cache = records;
    return records;
  }

  private persist(records: HistoryRecord[]): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), "utf8");
    } catch {
      // 写失败不阻断使用（下次启动回退空列表）
    }
  }
}

function isValidRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<HistoryRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.createTime === "number" &&
    typeof record.taskName === "string" &&
    typeof record.fileCount === "number" &&
    typeof record.beforeSize === "number" &&
    typeof record.afterSize === "number" &&
    typeof record.savedSize === "number" &&
    typeof record.savedPercent === "number" &&
    typeof record.durationMs === "number" &&
    typeof record.outputDir === "string"
  );
}
