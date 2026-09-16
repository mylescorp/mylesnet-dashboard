"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="profile-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="profile-modal-dialog">
        <header className="profile-modal-header">
          <div>
            <h2 className="page-title">{title}</h2>
            {description ? <p className="page-subtitle">{description}</p> : null}
          </div>
          <button
            type="button"
            className="profile-modal-close"
            onClick={() => {
              if (!loading) onClose();
            }}
            aria-label="Close"
            disabled={loading}
          >
            ×
          </button>
        </header>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (!loading) onClose();
            }}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "danger-button" : "primary-button"}
            onClick={() => onConfirm()}
            disabled={loading}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
