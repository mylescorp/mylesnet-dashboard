"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export type IpField = {
  label: string;
  value: string | null;
};

const CopyRow = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="landing-tool-copy" onClick={() => void copy()}>
      {copied ? (
        <>
          <Check size={14} aria-hidden="true" /> Copied
        </>
      ) : (
        <>
          <Copy size={14} aria-hidden="true" /> Copy
        </>
      )}
      <span className="sr-only">Copy {value}</span>
    </button>
  );
};

export default function IpDisplay({ fields }: { fields: IpField[] }) {
  return (
    <div className="landing-tool-grid">
      {fields.map((field) => (
        <div key={field.label} className="landing-card landing-card-compact landing-tool-metric">
          <span className="landing-tool-label">{field.label}</span>
          <span className="landing-tool-value landing-tool-value-sm">
            {field.value ?? "—"}
          </span>
          {field.value ? <CopyRow value={field.value} /> : null}
        </div>
      ))}
    </div>
  );
}
