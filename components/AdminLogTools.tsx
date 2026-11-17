"use client";

import type { ReactNode } from "react";
import { adminInputClass } from "./AdminPrimitives";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh", hour12: false,
});
export const formatLogTime = (value: string | null | undefined) => value ? dateFormatter.format(new Date(value)) : "Not recorded";

export function AdminLogField({ name, label, placeholder, type = "text", children }: {
  name: string; label: string; placeholder?: string; type?: "text" | "datetime-local"; children?: ReactNode;
}) {
  return <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
    <span className="block">{label}</span>
    <input name={name} type={type} placeholder={placeholder} className={`${adminInputClass} w-full`} />
    {children}
  </label>;
}

export const logFormText = (data: FormData, name: string) => {
  const value = String(data.get(name) ?? "").trim();
  return value || undefined;
};
export const logFormTime = (data: FormData, name: string) => {
  const value = logFormText(data, name);
  return value ? new Date(value).toISOString() : undefined;
};

/** Local export contains only the currently loaded page. */
export const downloadAdminLog = (content: string, filename: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
export const csvLogCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
