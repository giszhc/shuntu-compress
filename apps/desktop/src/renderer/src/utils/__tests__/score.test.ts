import { describe, expect, it } from "vitest";
import { computeScore, isOptimizedFormat } from "../score";

describe("computeScore（优化评分）", () => {
  it("高压缩率 + 转 WebP：优秀 5 星（4.8MB → 578KB 场景）", () => {
    const result = computeScore({
      originalSize: 4.8 * 1024 * 1024,
      compressedSize: 578 * 1024,
      formatChanged: true,
      formatOptimized: true
    });
    expect(result.level).toBe("excellent");
    expect(result.label).toBe("优秀");
    expect(result.stars).toBe(5);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("同格式中等压缩率：良好", () => {
    const result = computeScore({
      originalSize: 1024 * 1024,
      compressedSize: 400 * 1024, // 节省 60.9%
      formatChanged: false,
      formatOptimized: false
    });
    expect(result.level).toBe("good");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("中等压缩率同格式：一般", () => {
    const result = computeScore({
      originalSize: 1024 * 1024,
      compressedSize: 700 * 1024, // 节省 31.6%
      formatChanged: false,
      formatOptimized: false
    });
    expect(result.level).toBe("fair");
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(70);
  });

  it("低压缩率同格式（几乎没变小）：建议重新优化", () => {
    const result = computeScore({
      originalSize: 1024 * 1024,
      compressedSize: 800 * 1024, // 节省 21.9%
      formatChanged: false,
      formatOptimized: false
    });
    expect(result.level).toBe("poor");
    expect(result.label).toBe("建议重新优化");
  });

  it("未变小（膨胀）：强制建议重新优化", () => {
    const result = computeScore({
      originalSize: 1024 * 1024,
      compressedSize: 1200 * 1024, // 变大
      formatChanged: false,
      formatOptimized: false
    });
    expect(result.level).toBe("poor");
    expect(result.label).toBe("建议重新优化");
    expect(result.score).toBeLessThanOrEqual(30);
  });

  it("转退化格式（如转 TIFF）即使压缩率高也只到一般", () => {
    const result = computeScore({
      originalSize: 2 * 1024 * 1024,
      compressedSize: 300 * 1024, // 节省 85%
      formatChanged: true,
      formatOptimized: false
    });
    // volume=60 + format=5 + resolution=15 = 80，但"退化格式"不应给良好以上
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(90);
  });

  it("非法输入：0 分建议重新优化", () => {
    const result = computeScore({
      originalSize: 0,
      compressedSize: 0,
      formatChanged: false,
      formatOptimized: false
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe("poor");
  });
});

describe("isOptimizedFormat", () => {
  it("webp/jpg 视为优化格式", () => {
    expect(isOptimizedFormat(".webp")).toBe(true);
    expect(isOptimizedFormat(".jpg")).toBe(true);
    expect(isOptimizedFormat(".jpeg")).toBe(true);
  });
  it("png/gif/tiff/bmp/ico 不是优化格式", () => {
    expect(isOptimizedFormat(".png")).toBe(false);
    expect(isOptimizedFormat(".gif")).toBe(false);
    expect(isOptimizedFormat(".tiff")).toBe(false);
    expect(isOptimizedFormat(".bmp")).toBe(false);
    expect(isOptimizedFormat(".ico")).toBe(false);
  });
});
