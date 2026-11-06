"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyableFieldProps = {
  label: string;
  value: string;
  copyValue?: string;
  disabled?: boolean;
  prominent?: boolean;
};

function CopyableField({ label, value, copyValue = value, disabled = false, prominent = false }: CopyableFieldProps) {
  const id = useId();
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  return (
    <div className="min-w-0 py-4">
      <dt id={id} className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-start justify-between gap-3">
        <span aria-labelledby={id} className={`min-w-0 select-text font-mono tabular-nums [overflow-wrap:anywhere] ${prominent ? "text-heading-24 text-primary" : "text-label-16"}`}>{value}</span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          disabled={disabled}
          onClick={() => void copy()}
          className="-mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {feedback === "copied" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        </button>
      </dd>
      <p role="status" aria-live="polite" className={`text-xs ${feedback === "failed" ? "mt-2 text-danger" : "text-muted-foreground"}`}>
        {feedback === "copied" ? `${label} copied.` : feedback === "failed" ? "Couldn’t copy. Select the text above and copy it manually." : ""}
      </p>
    </div>
  );
}

export default CopyableField;
