import type { ReactNode } from "react";
import type { ApiError } from "../types/commonResponseType";

const sellerControl = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
export const sellerButton = `${sellerControl} border-border hover:bg-secondary`;
export const sellerPrimary = `${sellerControl} border-primary bg-primary text-primary-foreground hover:bg-primary-hover`;
export const sellerInput = "min-h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2 text-sm disabled:opacity-50";
export function SellerHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="text-heading-32">{title}</h1>{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}</div><div className="flex flex-wrap gap-3">{children}</div></div>;
}
export function SellerPanel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6 ${className}`}>{title && <h2 className="mb-5 text-base font-semibold">{title}</h2>}{children}</section>;
}
export function SellerError({ error, retry }: { error: ApiError; retry: () => void }) {
  return <SellerPanel><h2 className="text-heading-20">Unable to load this data</h2><p role="alert" className="mt-3 break-words text-sm text-danger">{error.detail || error.title}</p><button type="button" onClick={retry} className={`${sellerButton} mt-4`}>Retry</button></SellerPanel>;
}
export function SellerStatus({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 text-xs"><span className="size-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />{children}</span>;
}
export function SellerTabs({ values, selected, change }: { values: readonly string[]; selected: string; change: (value: string) => void }) {
  return <div aria-label="Filter results" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border text-sm">{values.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => change(value)} className={`min-h-11 border-b-2 pb-3 ${selected === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{value}</button>)}</div>;
}
