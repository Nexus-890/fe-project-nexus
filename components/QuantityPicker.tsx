"use client";

import { useRef, useState } from "react";

export interface QuantityPickerProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Item name that distinguishes controls when several quantities are shown. */
  label?: string;
  /** Keep manual edits local until the user finishes editing. */
  commitOnBlur?: boolean;
  compact?: boolean;
}

export function QuantityPicker({
  value,
  onChange,
  disabled = false,
  label,
  commitOnBlur = false,
  compact = false,
}: QuantityPickerProps) {
  const step = compact ? "min-h-11 min-w-11 px-2 text-base sm:min-h-9 sm:min-w-9" : "min-h-11 min-w-11 px-3 text-lg";
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{
    sourceValue: number;
    text: string;
  } | null>(null);
  const text =
    commitOnBlur && draft?.sourceValue === value && !disabled
      ? draft.text
      : String(value);
  const readDraft = (text: string): number | null => {
    if (!/^\d+$/.test(text)) return null;
    const next = Number(text);
    return Number.isSafeInteger(next) && next >= 1 ? next : null;
  };
  const stepValue = commitOnBlur ? (readDraft(text) ?? value) : value;
  const setQuantity = (next: number) => {
    if (disabled || !Number.isFinite(next)) return;
    const quantity = Math.max(1, Math.floor(next));
    if (Number.isSafeInteger(quantity)) onChange(quantity);
  };
  const commitDraft = (text: string) => {
    setDraft(null);
    if (disabled) return;
    const quantity = readDraft(text);
    if (quantity !== null && quantity !== value) onChange(quantity);
  };
  const stepQuantity = (offset: number) => {
    setDraft(null);
    setQuantity(stepValue + offset);
  };
  const preserveInputFocus = (event: React.PointerEvent<HTMLButtonElement>) => {
    // A step click replaces the draft in one request rather than committing it
    // on blur immediately before the increment/decrement request.
    if (commitOnBlur && document.activeElement === input.current)
      event.preventDefault();
  };
  const suffix = label ? ` for ${label}` : "";

  return (
    <div
      className={`inline-flex items-center rounded-md border border-border ${compact ? "min-h-11 sm:min-h-9" : "min-h-11"}`}
      aria-label={`Quantity${suffix}`}
    >
      <button
        type="button"
        aria-label={`Decrease quantity${suffix}`}
        disabled={disabled || stepValue <= 1}
        onPointerDown={preserveInputFocus}
        onClick={() => stepQuantity(-1)}
        className={`inline-flex ${step} items-center justify-center disabled:cursor-not-allowed disabled:text-muted-foreground`}
      >
        −
      </button>
      <input
        ref={input}
        aria-label={`Quantity${suffix}`}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={commitOnBlur ? text : value}
        disabled={disabled}
        onChange={(event) => {
          if (commitOnBlur) {
            setDraft({ sourceValue: value, text: event.target.value });
          } else {
            setQuantity(Number(event.target.value) || 1);
          }
        }}
        onBlur={(event) => {
          if (commitOnBlur) commitDraft(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (!commitOnBlur) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(null);
          }
        }}
        className={`box-border ${compact ? "h-11 w-12 sm:h-9 sm:w-11" : "h-11 w-14"} appearance-none border-x border-border px-0 text-center text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground`}
      />
      <button
        type="button"
        aria-label={`Increase quantity${suffix}`}
        disabled={disabled}
        onPointerDown={preserveInputFocus}
        onClick={() => stepQuantity(1)}
        className={`inline-flex ${step} items-center justify-center disabled:cursor-not-allowed disabled:text-muted-foreground`}
      >
        +
      </button>
    </div>
  );
}

export default QuantityPicker;
