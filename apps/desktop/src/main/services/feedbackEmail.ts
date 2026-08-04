/**
 * 用户反馈邮件模板：与官网（docs/index.html）同风格的 HTML 邮件。
 * 邮件客户端 CSS 支持有限，因此全部用 table 布局 + 内联样式，不用 flex/grid/backdrop-filter。
 * 纯函数，便于单测。
 */

export interface FeedbackEmailData {
  name: string;
  email: string;
  content: string;
}

export interface FeedbackEmailMeta {
  version: string;
  platform: string;
  time: string;
}

export const FEEDBACK_SITE_URL = "https://giszhc.github.io/shuntu-compress";

/** HTML 转义，防止用户输入注入邮件 HTML */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function platformLabel(platform: NodeJS.Platform): string {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  return platform;
}

export function formatFeedbackTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

/** 邮件主题 */
export function buildFeedbackSubject(name: string): string {
  return `【瞬图优化】用户反馈：${name}`;
}

/** HTML 版正文（官网风格：渐变头部 + 卡片 + 内联样式） */
export function buildFeedbackEmailHtml(
  data: FeedbackEmailData,
  meta: FeedbackEmailMeta,
  /** 应用图标 data URI（base64 PNG）；不传时回退为品牌色"瞬"字方块 */
  logoDataUri?: string
): string {
  const name = escapeHtml(data.name);
  const email = escapeHtml(data.email);
  const content = escapeHtml(data.content);

  // 邮件客户端对 SVG 支持差，用 PNG data URI 内联最通用；拿不到图标时用品牌色"瞬"字兜底
  const logoMark = logoDataUri
    ? `<img src="${logoDataUri}" alt="瞬图优化" width="56" height="56" style="display:block;width:56px;height:56px;border:0;" />`
    : `<span style="display:inline-block;font-size:28px;line-height:56px;font-weight:800;color:#ffffff;">瞬</span>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>瞬图优化 · 用户反馈</title>
</head>
<body style="margin:0;padding:0;background:#eef1fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1fb;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:760px;max-width:100%;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(31,38,135,0.12);border:1px solid rgba(255,255,255,0.7);">
        <!-- 渐变头部 -->
        <tr>
          <td style="background:#6366f1;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 48px;border-radius:24px 24px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:56px;height:56px;vertical-align:middle;">
                  ${logoMark}
                </td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <div style="color:#ffffff;font-size:23px;font-weight:700;line-height:1.3;">瞬图优化 · 用户反馈</div>
                  <div style="color:rgba(255,255,255,0.85);font-size:13px;line-height:1.5;letter-spacing:0.5px;">SHUNTU DESKTOP FEEDBACK</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 正文 -->
        <tr>
          <td style="padding:36px 48px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:88px;padding:10px 0;color:#94a3b8;font-size:13px;vertical-align:top;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">称呼</td>
                <td style="padding:10px 0;color:#0f172a;font-size:16px;font-weight:600;vertical-align:top;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">${name}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#94a3b8;font-size:13px;vertical-align:top;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">邮箱</td>
                <td style="padding:10px 0;color:#4f46e5;font-size:16px;vertical-align:top;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">${email}</td>
              </tr>
              <tr>
                <td colspan="2" style="height:1px;background:#eef1fb;font-size:0;line-height:0;padding:16px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:22px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#f5f6fd;border:1px solid rgba(99,102,241,0.18);border-left:4px solid #6366f1;border-radius:14px;padding:22px 24px;color:#334155;font-size:16px;line-height:1.85;white-space:pre-wrap;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">${content}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 元信息 -->
        <tr>
          <td style="padding:28px 48px 0;border-top:1px solid #eef1fb;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#94a3b8;font-size:13px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">发送时间：${escapeHtml(meta.time)}</td>
                <td style="color:#94a3b8;font-size:13px;text-align:right;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">应用版本 v${escapeHtml(meta.version)} · ${escapeHtml(meta.platform)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 页脚 -->
        <tr>
          <td style="padding:26px 48px 40px;">
            <div style="color:#94a3b8;font-size:13px;text-align:center;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
              瞬图优化 © 2026 giszhc ·
              <a href="${FEEDBACK_SITE_URL}" style="color:#4f46e5;text-decoration:underline;">官方网站</a>
              · 让图片压缩更简单、更安全、更高效
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** 纯文本版正文（multipart/alternative 兜底，部分邮件客户端只显示纯文本） */
export function buildFeedbackEmailText(
  data: FeedbackEmailData,
  meta: FeedbackEmailMeta
): string {
  return [
    `【瞬图优化】用户反馈`,
    "",
    `称呼：${data.name}`,
    `邮箱：${data.email}`,
    "",
    `反馈内容：`,
    data.content,
    "",
    `发送时间：${meta.time}`,
    `应用版本：v${meta.version} · ${meta.platform}`,
    `官方网站：${FEEDBACK_SITE_URL}`
  ].join("\n");
}
