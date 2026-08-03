import { describe, expect, it } from "vitest";
import { VipsError } from "../errors.js";
import { buildVipsSteps } from "../process.js";

describe("buildVipsSteps", () => {
  it("原尺寸 + 同格式 + 最高质量：返回 null（直接复制原图）", () => {
    expect(
      buildVipsSteps("a.png", "out.png", "out.png.v", {
        quality: 100,
        size: null,
        ext: null
      })
    ).toBeNull();
    expect(
      buildVipsSteps("a.jpg", "out.jpg", "out.jpg.v", {
        quality: 100,
        size: null,
        ext: null
      })
    ).toBeNull();
  });

  it("PNG 不缩放 + 质量<100：resize 1 + pngsave --palette --Q", () => {
    const steps = buildVipsSteps("a.png", "out.png", "tmp", {
      quality: 85,
      size: null,
      ext: null
    });
    expect(steps).toEqual([
      { args: ["resize", "a.png", "tmp", "1"] },
      { args: ["pngsave", "tmp", "out.png", "--palette", "--Q=85"] }
    ]);
  });

  it("JPG 不缩放 + 质量<100：resize 1 + jpegsave（含 --optimize-coding）", () => {
    const steps = buildVipsSteps("a.jpg", "out.jpg", "tmp", {
      quality: 80,
      size: null,
      ext: null
    });
    expect(steps).toEqual([
      { args: ["resize", "a.jpg", "tmp", "1"] },
      {
        args: [
          "jpegsave",
          "tmp",
          "out.jpg",
          "--Q=80",
          "--strip",
          "--optimize-coding"
        ]
      }
    ]);
  });

  it("JPG 缩放：thumbnail + jpegsave", () => {
    const steps = buildVipsSteps("a.jpg", "out.jpg", "tmp", {
      quality: 75,
      size: 400,
      ext: null
    });
    expect(steps).toEqual([
      { args: ["thumbnail", "a.jpg", "tmp", "400"] },
      {
        args: [
          "jpegsave",
          "tmp",
          "out.jpg",
          "--Q=75",
          "--strip",
          "--optimize-coding"
        ]
      }
    ]);
  });

  it("PNG 缩放：thumbnail + pngsave（质量<100 启用调色板）", () => {
    const steps = buildVipsSteps("a.png", "out.png", "tmp", {
      quality: 85,
      size: 300,
      ext: null
    });
    expect(steps).toEqual([
      { args: ["thumbnail", "a.png", "tmp", "300"] },
      { args: ["pngsave", "tmp", "out.png", "--palette", "--Q=85"] }
    ]);
  });

  it(".jpeg 输出走 jpegsave", () => {
    const steps = buildVipsSteps("a.png", "out.jpeg", "tmp", {
      quality: 85,
      size: null,
      ext: ".jpeg"
    });
    expect(steps?.[1].args[0]).toBe("jpegsave");
  });

  it("WebP 输出走 webpsave（带质量与元数据剥离）", () => {
    const steps = buildVipsSteps("a.png", "out.webp", "tmp", {
      quality: 80,
      size: null,
      ext: ".webp"
    });
    expect(steps?.[1].args[0]).toBe("webpsave");
    expect(steps?.[1].args).toContain("--Q=80");
    expect(steps?.[1].args).toContain("--keep");
  });

  it("GIF 输出走 gifsave", () => {
    const steps = buildVipsSteps("a.png", "out.gif", "tmp", {
      quality: 85,
      size: null,
      ext: ".gif"
    });
    expect(steps?.[1].args[0]).toBe("gifsave");
  });

  it("TIFF 输出走 tiffsave（JPEG 压缩）", () => {
    const steps = buildVipsSteps("a.png", "out.tiff", "tmp", {
      quality: 85,
      size: null,
      ext: ".tiff"
    });
    expect(steps?.[1].args[0]).toBe("tiffsave");
    expect(steps?.[1].args).toContain("--compression");
  });

  it("BMP 输出走 magicksave", () => {
    const steps = buildVipsSteps("a.bmp", "out.bmp", "tmp", {
      quality: 85,
      size: null,
      ext: null
    });
    expect(steps?.[1].args[0]).toBe("magicksave");
  });

  it("ICO 输出走 magicksave --format ico（未指定尺寸默认 64）", () => {
    const steps = buildVipsSteps("a.png", "out.ico", "tmp", {
      quality: 85,
      size: null,
      ext: ".ico"
    });
    expect(steps?.[0].args).toEqual(["thumbnail", "a.png", "tmp", "64"]);
    expect(steps?.[1].args).toEqual([
      "magicksave",
      "tmp",
      "out.ico",
      "--format",
      "ico"
    ]);
  });

  it("ICO 输出尊重用户 ≤256 尺寸，超过则封顶 256", () => {
    const small = buildVipsSteps("a.png", "out.ico", "tmp", {
      quality: 85,
      size: 128,
      ext: ".ico"
    });
    expect(small?.[0].args).toEqual(["thumbnail", "a.png", "tmp", "128"]);
    const big = buildVipsSteps("a.png", "out.ico", "tmp", {
      quality: 85,
      size: 512,
      ext: ".ico"
    });
    expect(big?.[0].args).toEqual(["thumbnail", "a.png", "tmp", "256"]);
  });

  it("不支持的输出格式抛 VipsError", () => {
    expect(() =>
      buildVipsSteps("a.jpg", "out.avif", "tmp", {
        quality: 85,
        size: 100,
        ext: null
      })
    ).toThrow(VipsError);
  });

  it("参数全部为独立数组元素（无 shell 拼接）", () => {
    const steps = buildVipsSteps("含 空格/图 1.jpg", "输出 目录/图 1.jpg", "tmp p", {
      quality: 90,
      size: 200,
      ext: null
    });
    for (const step of steps ?? []) {
      for (const arg of step.args) {
        expect(typeof arg).toBe("string");
      }
    }
    expect(steps?.[0].args).toContain("含 空格/图 1.jpg");
  });
});
