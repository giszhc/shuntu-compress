/**
 * 反馈邮件模板单测：HTML 转义、字段包含、纯文本版本、主题。
 */
import { describe, expect, it } from "vitest";
import {
  buildFeedbackEmailHtml,
  buildFeedbackEmailText,
  buildFeedbackSubject,
  escapeHtml,
  formatFeedbackTime,
  platformLabel
} from "../services/feedbackEmail";

const data = {
  name: "小李",
  email: "li@example.com",
  content: "第一行\n第二行 <script>alert('x')</script>"
};

const meta = {
  version: "1.1.1",
  platform: "Windows",
  time: "2026年8月3日星期一 15:47:23"
};

describe("escapeHtml", () => {
  it("转义 HTML 特殊字符", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });
});

describe("buildFeedbackSubject", () => {
  it("生成主题", () => {
    expect(buildFeedbackSubject("小李")).toBe("【瞬图压缩】用户反馈：小李");
  });
});

describe("buildFeedbackEmailHtml", () => {
  it("包含所有反馈字段", () => {
    const html = buildFeedbackEmailHtml(data, meta);
    expect(html).toContain("小李");
    expect(html).toContain("li@example.com");
    expect(html).toContain("第一行");
    expect(html).toContain("v1.1.1");
    expect(html).toContain("Windows");
    expect(html).toContain("2026年8月3日星期一 15:47:23");
  });

  it("转义用户输入，防止 HTML 注入", () => {
    const html = buildFeedbackEmailHtml(data, meta);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // 邮箱与称呼同样被转义
    const evil = buildFeedbackEmailHtml(
      { name: "<b>黑客</b>", email: "a@b.c", content: "正常内容" },
      meta
    );
    expect(evil).not.toContain("<b>黑客</b>");
    expect(evil).toContain("&lt;b&gt;黑客&lt;/b&gt;");
  });

  it("包含官网链接与品牌渐变", () => {
    const html = buildFeedbackEmailHtml(data, meta);
    expect(html).toContain("https://giszhc.github.io/shuntu-compress");
    expect(html).toContain("linear-gradient(135deg,#6366f1");
  });

  it("传入 logo data URI 时内联图标，否则回退品牌字", () => {
    const withLogo = buildFeedbackEmailHtml(data, meta, "data:image/png;base64,AAAA");
    expect(withLogo).toContain('<img src="data:image/png;base64,AAAA"');
    expect(withLogo).not.toContain(">瞬</span>");
    const fallback = buildFeedbackEmailHtml(data, meta);
    expect(fallback).not.toContain("<img");
    expect(fallback).toContain(">瞬</span>");
  });

  it("邮件宽度为 760px", () => {
    const html = buildFeedbackEmailHtml(data, meta);
    expect(html).toContain('width="760"');
  });
});

describe("buildFeedbackEmailText", () => {
  it("纯文本包含字段且不转义", () => {
    const text = buildFeedbackEmailText(data, meta);
    expect(text).toContain("称呼：小李");
    expect(text).toContain("邮箱：li@example.com");
    expect(text).toContain("<script>"); // 纯文本无需 HTML 转义
    expect(text).toContain("第二行");
  });
});

describe("formatFeedbackTime", () => {
  it("格式化为中文时间", () => {
    expect(formatFeedbackTime(new Date("2026-08-03T15:47:23+08:00"))).toContain("2026年8月3日");
    expect(formatFeedbackTime(new Date("2026-08-03T15:47:23+08:00"))).toContain("15:47:23");
  });
});

describe("platformLabel", () => {
  it.each([
    ["win32", "Windows"],
    ["darwin", "macOS"],
    ["linux", "linux"]
  ])("%s → %s", (input, expected) => {
    expect(platformLabel(input as NodeJS.Platform)).toBe(expected);
  });
});
