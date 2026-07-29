/**
 * Toast 容器：底部居中堆叠，自动消失。
 */
import { useUiStore } from "../stores/uiStore";

export function Toasts(): React.JSX.Element | null {
  const toasts = useUiStore(s => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
