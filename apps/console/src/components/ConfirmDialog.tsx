import { CircleAlert, X } from "lucide-react";
import { useEffect } from "react";

export interface ConfirmDialogCopy {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  details?: string[];
  recovery?: string;
  tone?: "default" | "warning" | "danger";
}

interface ConfirmDialogProps {
  busy: boolean;
  copy: ConfirmDialogCopy;
  error: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ busy, copy, error, onCancel, onConfirm }: ConfirmDialogProps) {
  const tone = copy.tone || "default";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-busy={busy}
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className={`action-dialog confirm-dialog confirm-dialog--${tone}`}
        role="dialog"
      >
        <header>
          <div className="confirm-dialog__heading">
            <span className="confirm-dialog__icon" aria-hidden="true">
              <CircleAlert size={18} />
            </span>
            <div>
              <h2 id="confirm-dialog-title">{copy.title}</h2>
              <p id="confirm-dialog-description">{copy.description}</p>
            </div>
          </div>
          <button aria-label="关闭确认弹窗" className="icon-button" disabled={busy} onClick={onCancel} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="confirm-dialog__body">
          {copy.details?.length ? (
            <ul className="confirm-dialog__details" aria-label="操作影响">
              {copy.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}

          {copy.recovery ? (
            <p className="confirm-dialog__recovery">
              <strong>失败恢复</strong>
              <span>{copy.recovery}</span>
            </p>
          ) : null}

          {error ? (
            <p aria-live="polite" className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="confirm-dialog__footer">
            <button className="button" disabled={busy} onClick={onCancel} type="button">
              {copy.cancelLabel || "取消"}
            </button>
            <button
              aria-live="polite"
              className={tone === "danger" ? "button button--danger" : "button button--primary"}
              disabled={busy}
              onClick={() => void onConfirm()}
              type="button"
            >
              {busy ? "处理中" : copy.confirmLabel}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
