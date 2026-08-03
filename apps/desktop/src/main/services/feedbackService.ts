/**
 * 用户反馈服务：经 163 SMTP（smtp.163.com:465 SSL）把反馈直接发到 shuntool@163.com。
 *
 * SMTP 凭据不写死在源码里，而是从应用目录下的 feedback.secret.json 读取
 * （该文件已被 .gitignore 忽略，避免授权码泄露到公开仓库；打包时随 asar 一并分发）。
 *
 * 注意：授权码随安装包分发，理论上可被解包提取，属"直接发送"方案的固有代价。
 * 建议定期在 163 邮箱设置中重置客户端授权码以降低风险。
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import nodemailer from "nodemailer";
import type {
  FeedbackRequest,
  FeedbackResult
} from "../../shared/ipc-types";
import {
  buildFeedbackEmailHtml,
  buildFeedbackEmailText,
  buildFeedbackSubject,
  formatFeedbackTime,
  platformLabel
} from "./feedbackEmail";

/** SMTP 配置文件（apps/desktop/feedback.secret.json，gitignored） */
export interface FeedbackSmtpConfig {
  /** 163 邮箱账号（完整邮箱地址） */
  user: string;
  /** 163 客户端授权码（非登录密码，需在邮箱设置中开启 SMTP 后获取） */
  pass: string;
  /** 收件人邮箱 */
  to: string;
}

const CONFIG_FILE_NAME = "feedback.secret.json";
const SMTP_HOST = "smtp.163.com";
const SMTP_PORT = 465;
/** 两次提交的最小间隔，防止用户误连点 / 恶意刷屏 */
const MIN_SEND_INTERVAL_MS = 15_000;
/** 网络超时，避免无网环境下发送挂起卡死 UI */
const SMTP_TIMEOUT_MS = 15_000;

/** 应用图标路径：dev 在 renderer assets；打包后经 extraResources 放进 resources 根目录 */
const APP_ICON_FILE_NAME = "app-icon.png";

export class FeedbackService {
  private lastSendAt = 0;

  /** 读取应用图标并转成 base64 data URI（读不到返回 undefined，邮件模板回退"瞬"字方块） */
  private loadLogoDataUri(): string | undefined {
    try {
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, APP_ICON_FILE_NAME)
        : path.join(
            app.getAppPath(),
            "src",
            "renderer",
            "src",
            "assets",
            APP_ICON_FILE_NAME
          );
      const buffer = fs.readFileSync(iconPath);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      return undefined;
    }
  }

  /** 读取 SMTP 配置；失败抛 ConfigError 风格的中文错误 */
  private loadConfig(): FeedbackSmtpConfig {
    const filePath = path.join(app.getAppPath(), CONFIG_FILE_NAME);
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      throw new Error("反馈邮件服务未配置（缺少 feedback.secret.json）");
    }
    let config: Partial<FeedbackSmtpConfig> | null = null;
    try {
      config = JSON.parse(raw) as Partial<FeedbackSmtpConfig> | null;
    } catch {
      throw new Error("反馈邮件配置格式错误（feedback.secret.json 不是合法 JSON）");
    }
    if (
      !config ||
      typeof config.user !== "string" ||
      !config.user.includes("@") ||
      typeof config.pass !== "string" ||
      !config.pass ||
      typeof config.to !== "string" ||
      !config.to.includes("@")
    ) {
      throw new Error("反馈邮件配置不完整（需要 user / pass / to 三个字段）");
    }
    return config as FeedbackSmtpConfig;
  }

  /** 把 nodemailer 错误映射成用户可读的中文提示 */
  private mapError(err: unknown): string {
    const code = (err as { code?: string; response?: string })?.code ?? "";
    if (code === "EAUTH") {
      return "邮箱授权码校验失败，请检查 SMTP 配置中的授权码是否正确";
    }
    if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") {
      return "无法连接邮件服务器，请检查网络后重试";
    }
    const message = err instanceof Error ? err.message : String(err);
    return `发送失败：${message}`;
  }

  async send(request: FeedbackRequest): Promise<FeedbackResult> {
    const now = Date.now();
    if (now - this.lastSendAt < MIN_SEND_INTERVAL_MS) {
      return {
        ok: false,
        message: "提交太频繁了，请稍等片刻再试"
      };
    }

    const config = this.loadConfig();
    const meta = {
      version: app.getVersion(),
      platform: platformLabel(process.platform),
      time: formatFeedbackTime()
    };
    const logoDataUri = this.loadLogoDataUri();

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true, // 465 走 SSL
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS
    });

    try {
      await transporter.sendMail({
        from: `"瞬图压缩反馈" <${config.user}>`,
        to: config.to,
        subject: buildFeedbackSubject(request.name),
        text: buildFeedbackEmailText(request, meta),
        html: buildFeedbackEmailHtml(request, meta, logoDataUri)
      });
      this.lastSendAt = Date.now();
      return {
        ok: true,
        message: "反馈已发送，感谢你的建议！"
      };
    } catch (err) {
      return { ok: false, message: this.mapError(err) };
    } finally {
      transporter.close();
    }
  }
}
