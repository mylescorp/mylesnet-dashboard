"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../utils";
import type { ToastData, ToastVariant } from "../types";

interface ToastContextValue {
  toast: (data: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByVariant: Record<ToastVariant, ReactNode> = {
  default: <Info size={17} aria-hidden="true" />,
  success: <CircleCheck size={17} aria-hidden="true" />,
  warning: <TriangleAlert size={17} aria-hidden="true" />,
  danger: <CircleX size={17} aria-hidden="true" />,
  info: <Info size={17} aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (data: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => {
      const id = `toast-${++counter.current}`;
      setToasts((prev) => [...prev, { id, ...data, duration: data.duration ?? 4500 }]);
      const duration = data.duration ?? 4500;
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="mn-toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn("mn-toast", `mn-toast-${t.variant || "default"}`)}
            role="alert"
          >
            <span className="mn-toast-icon" aria-hidden="true">
              {iconByVariant[t.variant || "default"]}
            </span>
            <div className="mn-toast-content">
              <p className="mn-toast-title">{t.title}</p>
              {t.description != null ? <p className="mn-toast-description">{t.description}</p> : null}
            </div>
            <button
              type="button"
              className="mn-toast-dismiss"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}