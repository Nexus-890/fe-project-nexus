import type { ReactNode } from "react";
import { adminInputClass } from "./AdminPrimitives";

export function PromotionField({ name, label, type = "text", value, required = false, min, max, step, pattern }: {
  name: string; label: string; type?: string; value?: string | number | null; required?: boolean; min?: number; max?: number; step?: string; pattern?: string;
}) {
  return <label className="grid gap-2 text-sm">{label}<input className={adminInputClass} name={name} type={type} defaultValue={value ?? ""} required={required} min={min} max={max} step={step} pattern={pattern} maxLength={type === "text" ? 200 : undefined} /></label>;
}
export function PromotionSelect({ name, label, value, values, onChange, disabled }: { name: string; label: string; value: string; values: string[]; onChange?: (value: string) => void; disabled?: boolean }) {
  return <label className="grid max-w-xs gap-2 text-sm">{label}<select aria-label={label} className={adminInputClass} name={name} value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled}>{values.map((item) => <option key={item} value={item}>{item ? item.replaceAll("_", " ") : "All"}</option>)}</select></label>;
}
export function PromotionPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title} className="space-y-5 rounded-sm border border-border bg-card p-5 sm:p-6"><h2 className="text-heading-20">{title}</h2>{children}</section>;
}
export const localDateTime = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
export const formText = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export const formDate = (data: FormData, key: string) => new Date(formText(data, key)).toISOString();
