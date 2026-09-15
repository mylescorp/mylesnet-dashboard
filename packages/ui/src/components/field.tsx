import type { ReactNode } from "react";
import { cn } from "../utils";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  return (
    <label className={cn("pf-field", error != null && "pf-field-invalid", className)}>
      <span className="pf-label">
        {label}
        {required ? (
          <span className="pf-required" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
      {error != null ? <span className="pf-field-error" role="alert">{error}</span> : hint ? <span className="pf-hint">{hint}</span> : null}
    </label>
  );
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, ...props }: TextAreaProps) {
  return <textarea className={cn("mn-input", invalid && "mn-input-invalid", className)} {...props} />;
}
