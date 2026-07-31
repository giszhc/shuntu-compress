/**
 * 关于页：版本、简介、版权与联系方式（不暴露底层技术实现）。
 */
import { useEffect, useState } from "react";

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
      <h1>关于</h1>
      <div className="about-block">
        <strong>瞬图压缩 {version && `v${version}`}</strong>
        <span>瞬图 —— 高效的本地图片压缩工具。</span>
        <span>支持 JPG / PNG 批量压缩、等比缩放与格式转换；所有处理均在本机完成，不上传任何文件。</span>
        <span>输出永不覆盖原图：结果保存到独立目录，重名自动追加序号。</span>
        <span>版权所有 © 2026 giszhc</span>
        <span>QQ：1627742336</span>
        <span>微信：giszhc</span>
        <span>
          联系邮箱：<a href="mailto:giszhc@163.com">giszhc@163.com</a>
        </span>
      </div>
    </div>
  );
}
