/**
 * 缩略图服务：主进程 nativeImage 生成 96×96 dataURL，LRU 缓存。
 * 渲染进程不直接访问文件系统。
 */
import fs from "node:fs";
import { nativeImage } from "electron";

const THUMB_SIZE = { width: 96, height: 96 };
const LRU_LIMIT = 300;

export class ThumbnailService {
  private readonly cache = new Map<string, string>();

  async get(filePath: string): Promise<string> {
    let key: string;
    try {
      const stat = await fs.promises.stat(filePath);
      key = `${filePath}|${stat.mtimeMs}|${stat.size}`;
    } catch {
      return "";
    }

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      // LRU：命中后移到末尾
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const dataUrl = await this.generate(filePath);
    this.cache.set(key, dataUrl);
    if (this.cache.size > LRU_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return dataUrl;
  }

  private async generate(filePath: string): Promise<string> {
    // 优先系统原生缩略图（异步、快、不占渲染线程）
    try {
      const image = await nativeImage.createThumbnailFromPath(filePath, THUMB_SIZE);
      if (!image.isEmpty()) return image.toDataURL();
    } catch {
      // 回退方案
    }
    try {
      const image = nativeImage.createFromPath(filePath);
      if (image.isEmpty()) return "";
      return image.resize({ ...THUMB_SIZE, quality: "good" }).toDataURL();
    } catch {
      return "";
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
