import { describe, expect, it } from "vitest";
import {
  SMART_PNG_QUALITY,
  SMART_QUALITY,
  suggestSmartOptions
} from "../optimize.js";

describe("suggestSmartOptions（智能优化模式决策）", () => {
  it("jpg/jpeg 转 WebP，质量 80，保持原尺寸", () => {
    expect(suggestSmartOptions(".jpg")).toEqual({
      quality: SMART_QUALITY,
      size: null,
      ext: ".webp"
    });
    expect(suggestSmartOptions(".jpeg")).toEqual({
      quality: SMART_QUALITY,
      size: null,
      ext: ".webp"
    });
  });

  it("png 转 WebP，质量略高（85）", () => {
    expect(suggestSmartOptions(".png")).toEqual({
      quality: SMART_PNG_QUALITY,
      size: null,
      ext: ".webp"
    });
  });

  it("gif 保持原格式（动图不可压缩）", () => {
    expect(suggestSmartOptions(".gif")).toEqual({
      quality: SMART_QUALITY,
      size: null,
      ext: null
    });
  });

  it("tiff/tif/bmp 位图类转 WebP", () => {
    for (const ext of [".tiff", ".tif", ".bmp"]) {
      expect(suggestSmartOptions(ext as never).ext).toBe(".webp");
    }
  });

  it("svg 栅格化为 png 无损输出", () => {
    expect(suggestSmartOptions(".svg")).toEqual({
      quality: 100,
      size: null,
      ext: ".png"
    });
  });

  it("webp 保持格式", () => {
    expect(suggestSmartOptions(".webp").ext).toBeNull();
    expect(suggestSmartOptions(".webp").size).toBeNull();
  });
});
