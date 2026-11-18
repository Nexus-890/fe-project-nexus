import type { ReactNode } from "react";
import { adminInputClass } from "./AdminPrimitives";
import { MoneyField } from "./moneyInput";

export function PromotionField({ name, label, type = "text", value, required = false, min, max, step, pattern, className = "", money = false }: {
  name: string; label: string; type?: string; value?: string | number | null; required?: boolean; min?: number; max?: number; step?: string; pattern?: string; className?: string; money?: boolean;
}) {
  if (money) return <label className={`grid content-start gap-2 text-sm ${className}`}>{label}<MoneyField className={adminInputClass} name={name} defaultValue={value} required={required} pattern="[0-9.]+(,[0-9]{1,2})?" /></label>;
  return <label className={`grid content-start gap-2 text-sm ${className}`}>{label}<input className={adminInputClass} name={name} type={type} defaultValue={value ?? ""} required={required} min={min} max={max} step={step} pattern={pattern} maxLength={type === "text" ? 200 : undefined} /></label>;
}
export function PromotionSelect({ name, label, value, values, onChange, disabled, labels, className = "max-w-xs" }: { name: string; label: string; value: string; values: string[]; onChange?: (value: string) => void; disabled?: boolean; labels?: Record<string, string>; className?: string }) {
  return <label className={`grid content-start gap-2 text-sm ${className}`}>{label}<select aria-label={label} className={adminInputClass} name={name} value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled}>{values.map((item) => <option key={item} value={item}>{labels?.[item] ?? (item ? item.replaceAll("_", " ") : "All")}</option>)}</select></label>;
}
export function PromotionSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0"><div><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>;
}
export function PromotionPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title} className="space-y-5 rounded-sm border border-border bg-card p-5 sm:p-6"><h2 className="text-heading-20">{title}</h2>{children}</section>;
}
export const localDateTime = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
export const formText = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export const formDate = (data: FormData, key: string) => new Date(formText(data, key)).toISOString();
