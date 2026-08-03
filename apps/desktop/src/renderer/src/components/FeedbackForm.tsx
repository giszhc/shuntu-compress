/**
 * 用户反馈表单：称呼 / 邮箱 / 反馈内容（≤500 字），经主进程 SMTP 直接发送到 shuntool@163.com。
 */
import { useState } from "react";
import { Send } from "lucide-react";
import { useUiStore } from "../stores/uiStore";

const NAME_MAX = 30;
const EMAIL_MAX = 100;
const CONTENT_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  content?: string;
}

export function FeedbackForm(): React.JSX.Element {
  const toast = useUiStore(s => s.toast);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const n = name.trim();
    const e = email.trim();
    const c = content.trim();
    const next: FieldErrors = {};
    if (!n) next.name = "请填写称呼";
    else if (n.length > NAME_MAX) next.name = `称呼最多 ${NAME_MAX} 个字`;
    if (!e) next.email = "请填写邮箱";
    else if (e.length > EMAIL_MAX) next.email = "邮箱地址过长";
    else if (!EMAIL_RE.test(e)) next.email = "邮箱格式不正确";
    if (!c) next.content = "请填写反馈内容";
    else if (c.length > CONTENT_MAX) next.content = `反馈内容最多 ${CONTENT_MAX} 个字`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (): Promise<void> => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await window.app.sendFeedback({
        name: name.trim(),
        email: email.trim(),
        content: content.trim()
      });
      if (result.ok) {
        toast(result.message, "success");
        setName("");
        setEmail("");
        setContent("");
        setErrors({});
      } else {
        toast(result.message, "error");
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "发送失败，请检查网络后重试",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-form">
      <p className="about-section-desc">
        使用中遇到问题或有改进建议？直接告诉我们，每一封反馈都会被认真查看。
      </p>

      <div className={`feedback-field${errors.name ? " feedback-field--error" : ""}`}>
        <label className="feedback-label" htmlFor="fb-name">
          称呼 <em>必填</em>
        </label>
        <input
          id="fb-name"
          className="feedback-input"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder="怎么称呼你，如：小李"
          onChange={e => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
          }}
        />
        {errors.name && <div className="feedback-error">{errors.name}</div>}
      </div>

      <div className={`feedback-field${errors.email ? " feedback-field--error" : ""}`}>
        <label className="feedback-label" htmlFor="fb-email">
          邮箱 <em>必填</em>
        </label>
        <input
          id="fb-email"
          className="feedback-input"
          type="email"
          value={email}
          maxLength={EMAIL_MAX}
          placeholder="方便我们回复你，不会对外公开"
          onChange={e => {
            setEmail(e.target.value);
            if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
          }}
        />
        {errors.email && <div className="feedback-error">{errors.email}</div>}
      </div>

      <div className={`feedback-field${errors.content ? " feedback-field--error" : ""}`}>
        <label className="feedback-label" htmlFor="fb-content">
          反馈内容 <em>必填 · 最多 {CONTENT_MAX} 字</em>
        </label>
        <textarea
          id="fb-content"
          className="feedback-input feedback-textarea"
          value={content}
          maxLength={CONTENT_MAX}
          rows={5}
          placeholder="描述你遇到的问题、操作步骤或改进建议…"
          onChange={e => {
            setContent(e.target.value);
            if (errors.content) setErrors(prev => ({ ...prev, content: undefined }));
          }}
        />
        <div className="feedback-count">
          {content.length}/{CONTENT_MAX}
        </div>
        {errors.content && <div className="feedback-error">{errors.content}</div>}
      </div>

      <button
        type="button"
        className="btn btn-primary feedback-submit"
        disabled={submitting}
        onClick={() => void submit()}
      >
        <Send size={14} />
        {submitting ? "发送中…" : "提交反馈"}
      </button>
    </div>
  );
}
