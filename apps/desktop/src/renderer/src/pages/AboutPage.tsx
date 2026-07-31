/**
 * 关于页：左侧应用介绍（系统图标 + 主题色渐变），右侧详情（与设置页同风格分组卡片）。
 */
import { useEffect, useState } from "react";
import {
  FolderOpen,
  Heart,
  Info,
  Lock,
  Mail,
  MessageCircle,
  MessagesSquare,
  Monitor,
  Shield,
  Tag
} from "lucide-react";
import appIcon from "../../../../build/icon.svg";
import "../styles/about.css";
import "../styles/settings.css";

export function AboutPage(): React.JSX.Element {
  const [version, setVersion] = useState("");

  useEffect(() => {
    let alive = true;
    void window.app.getVersion().then(v => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="about-page">
        <header className="settings-header">
          <h1>关于</h1>
          <p className="subtitle">了解瞬图压缩的功能与支持信息</p>
        </header>

        <div className="about-main">
          <div className="about-left">
            <img className="about-app-icon" src={appIcon} alt="瞬图压缩" />
            <h2 className="about-app-name">瞬图压缩</h2>
            <div className="about-app-version">v{version}</div>
            <p className="about-app-desc">
              高效的本地图片压缩工具
              <br />
              支持 JPG / PNG / WebP / GIF / TIFF / BMP 批量压缩，等比缩放与格式转换
            </p>
          </div>

          <div className="about-right">
            {/* 安全可靠 */}
            <section className="settings-group">
              <h2 className="settings-group-title">
                <span className="group-icon"><Shield size={16} /></span>
                安全可靠
              </h2>
              <div className="settings-card about-card-pad">
                <p className="about-section-desc">
                  所有处理均在本机完成，不上传任何文件；输出结果保存到独立目录，永不覆盖原图。
                </p>
                <div className="about-feature-grid">
                  <FeatureCard
                    icon={<Monitor size={22} />}
                    title="本地处理"
                    desc="所有操作在本机完成"
                    tone="blue"
                  />
                  <FeatureCard
                    icon={<Lock size={22} />}
                    title="隐私保护"
                    desc="不上传任何文件"
                    tone="purple"
                  />
                  <FeatureCard
                    icon={<FolderOpen size={22} />}
                    title="原图安全"
                    desc="永不覆盖原图文件"
                    tone="orange"
                  />
                </div>
              </div>
            </section>

            {/* 版本信息 */}
            <section className="settings-group">
              <h2 className="settings-group-title">
                <span className="group-icon"><Info size={16} /></span>
                版本信息
              </h2>
              <div className="settings-card">
                <InfoRow icon={<Tag size={16} />} label="当前版本" value={`v${version}`} />
                <InfoRow icon={<MessageCircle size={16} />} label="QQ" value="1627742336" />
                <InfoRow icon={<MessagesSquare size={16} />} label="微信" value="giszhc" />
                <InfoRow
                  icon={<Mail size={16} />}
                  label="联系邮箱"
                  value={<a href="mailto:giszhc@163.com">giszhc@163.com</a>}
                  isLink
                />
              </div>
            </section>

            {/* 特别感谢 */}
            <section className="settings-group about-thanks">
              <h2 className="settings-group-title">
                <span className="group-icon"><Heart size={16} /></span>
                特别感谢
              </h2>
              <div className="settings-card about-card-pad">
                <p className="about-section-desc">
                  感谢所有支持和使用瞬图压缩的用户，你的反馈让我们变得更好！
                </p>
              </div>
            </section>
          </div>
        </div>

        <footer className="about-footer">
          瞬图压缩 v{version || "1.0.0"} ｜ 版权所有 © 2026 giszhc ｜ 让图片压缩更简单、更安全、更高效
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  tone
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "blue" | "purple" | "orange";
}): React.JSX.Element {
  return (
    <div className={`about-feature-card about-feature-card--${tone}`}>
      <div className="about-feature-icon">{icon}</div>
      <div className="about-feature-content">
        <div className="about-feature-title">{title}</div>
        <div className="about-feature-desc">{desc}</div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLink
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isLink?: boolean;
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <span className="row-icon">{icon}</span>
      <div className="info">
        <div className="title">{label}</div>
      </div>
      <div className="control">
        <span className={`about-info-value${isLink ? " about-info-value--link" : ""}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
