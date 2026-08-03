/**
 * IPC 入参校验单测：非法输入必须被拒绝（中文 ConfigError）。
 */
import { describe, expect, it } from "vitest";
import {
  assertAbsolutePath,
  validateFeedbackRequest,
  validateScanRequest,
  validateSettingsPatch,
  validateTaskId,
  validateTaskStartRequest,
  validateWindowControl
} from "../validate";

const abs = process.platform === "win32" ? "C:\\tmp\\a.jpg" : "/tmp/a.jpg";

function entry(overrides: Record<string, unknown> = {}) {
  return {
    absolutePath: abs,
    fileName: "a.jpg",
    baseName: "a",
    ext: ".jpg",
    size: 100,
    width: 10,
    height: 10,
    mtimeMs: 1,
    rootDir: process.platform === "win32" ? "C:\\tmp" : "/tmp",
    ...overrides
  };
}

describe("assertAbsolutePath", () => {
  it("接受绝对路径", () => {
    expect(() => assertAbsolutePath(abs, "路径")).not.toThrow();
  });

  it.each(["", "relative/a.jpg", "a.jpg", "..\\b.png"])(
    "拒绝相对/空路径 %s",
    p => {
      expect(() => assertAbsolutePath(p, "路径")).toThrow();
    }
  );

  it("拒绝包含空字节的路径", () => {
    expect(() => assertAbsolutePath(`${abs}\0x`, "路径")).toThrow();
  });

  it("拒绝非字符串", () => {
    expect(() => assertAbsolutePath(123 as unknown as string, "路径")).toThrow();
  });
});

describe("validateScanRequest", () => {
  it("接受合法请求", () => {
    expect(() =>
      validateScanRequest({ paths: [abs], recursive: true })
    ).not.toThrow();
  });

  it("拒绝空路径数组", () => {
    expect(() => validateScanRequest({ paths: [], recursive: true })).toThrow();
  });

  it("拒绝非对象", () => {
    expect(() => validateScanRequest(null)).toThrow();
    expect(() => validateScanRequest("x")).toThrow();
  });

  it("拒绝 recursive 非布尔", () => {
    expect(() =>
      validateScanRequest({ paths: [abs], recursive: "yes" })
    ).toThrow();
  });
});

describe("validateTaskStartRequest", () => {
  const good = {
    entries: [entry()],
    options: { quality: 85, size: null, ext: null },
    outputDir: null,
    mode: "preserve",
    concurrency: 2
  };

  it("接受合法请求", () => {
    expect(() => validateTaskStartRequest(good)).not.toThrow();
  });

  it("拒绝空 entries", () => {
    expect(() => validateTaskStartRequest({ ...good, entries: [] })).toThrow();
  });

  it("拒绝越界 quality", () => {
    expect(() =>
      validateTaskStartRequest({
        ...good,
        options: { quality: 0, size: null, ext: null }
      })
    ).toThrow();
    expect(() =>
      validateTaskStartRequest({
        ...good,
        options: { quality: 101, size: null, ext: null }
      })
    ).toThrow();
  });

  it("拒绝非法 ext", () => {
    expect(() =>
      validateTaskStartRequest({
        ...good,
        options: { quality: 85, size: null, ext: ".avif" }
      })
    ).toThrow();
  });

  it("拒绝非法 mode", () => {
    expect(() => validateTaskStartRequest({ ...good, mode: "hybrid" })).toThrow();
  });

  it("拒绝越界并发", () => {
    expect(() => validateTaskStartRequest({ ...good, concurrency: 0 })).toThrow();
    expect(() => validateTaskStartRequest({ ...good, concurrency: 9 })).toThrow();
  });

  it("拒绝相对路径 entry", () => {
    expect(() =>
      validateTaskStartRequest({
        ...good,
        entries: [entry({ absolutePath: "a.jpg" })]
      })
    ).toThrow();
  });
});

describe("validateSettingsPatch", () => {
  it("接受合法 patch", () => {
    expect(() =>
      validateSettingsPatch({ quality: 70, theme: "dark", size: 1920 })
    ).not.toThrow();
  });

  it("拒绝未知键", () => {
    expect(() => validateSettingsPatch({ hacker: true })).toThrow();
  });

  it("拒绝非法主题", () => {
    expect(() => validateSettingsPatch({ theme: "blue" })).toThrow();
  });

  it("拒绝非法质量", () => {
    expect(() => validateSettingsPatch({ quality: 200 })).toThrow();
  });
});

describe("validateWindowControl", () => {
  it.each(["min", "max", "close"])("接受 %s", action => {
    expect(() => validateWindowControl({ action })).not.toThrow();
  });

  it("拒绝非法 action", () => {
    expect(() => validateWindowControl({ action: "destroy" })).toThrow();
  });
});

describe("validateTaskId", () => {
  it("接受 task-123", () => {
    expect(() => validateTaskId("task-123")).not.toThrow();
  });

  it.each(["", "task-", "abc", "task-1x", "../etc"])("拒绝 %s", id => {
    expect(() => validateTaskId(id)).toThrow();
  });
});

describe("validateFeedbackRequest", () => {
  const good = { name: "小李", email: "li@example.com", content: "很好用，希望能加一个深色图标。" };

  it("接受合法反馈", () => {
    expect(() => validateFeedbackRequest(good)).not.toThrow();
  });

  it("自动去除首尾空白", () => {
    const result = validateFeedbackRequest({
      name: " 小李 ",
      email: " li@example.com ",
      content: " 内容 "
    });
    expect(result).toEqual({ name: "小李", email: "li@example.com", content: "内容" });
  });

  it("拒绝缺少称呼 / 邮箱 / 内容", () => {
    expect(() => validateFeedbackRequest({ ...good, name: "" })).toThrow();
    expect(() => validateFeedbackRequest({ ...good, email: "" })).toThrow();
    expect(() => validateFeedbackRequest({ ...good, content: "" })).toThrow();
  });

  it("拒绝非法邮箱", () => {
    for (const email of ["abc", "a@b", "a b@c.com", "@x.com", "x@.com"]) {
      expect(() => validateFeedbackRequest({ ...good, email })).toThrow();
    }
  });

  it("拒绝超过 500 字的反馈内容", () => {
    expect(() =>
      validateFeedbackRequest({ ...good, content: "字".repeat(501) })
    ).toThrow();
  });

  it("接受恰好 500 字", () => {
    expect(() =>
      validateFeedbackRequest({ ...good, content: "字".repeat(500) })
    ).not.toThrow();
  });

  it("拒绝称呼过长 / 非对象", () => {
    expect(() => validateFeedbackRequest({ ...good, name: "名".repeat(31) })).toThrow();
    expect(() => validateFeedbackRequest(null)).toThrow();
    expect(() => validateFeedbackRequest("x")).toThrow();
  });
});
