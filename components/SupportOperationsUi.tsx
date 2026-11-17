"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminError, AdminPagination } from "./AdminPrimitives";
import type { ApiError, Page } from "../types/commonResponseType";

export function OperationsTabs() {
  const pathname = usePathname();
  return <nav aria-label="Order operations" className="flex flex-wrap gap-6 border-b border-border text-sm">{["orders", "payments", "refunds", "shipments"].map((section) => <Link key={section} href={`/backoffice/${section}`} aria-current={pathname === `/backoffice/${section}` ? "page" : undefined} className={`min-h-11 border-b-2 py-3 ${pathname === `/backoffice/${section}` ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}>{section.charAt(0).toUpperCase() + section.slice(1)}</Link>)}</nav>;
}

export function OperationsError({ error, retry }: { error?: ApiError | null; retry?: () => void }) {
  if (!error || error.kind === "aborted") return null;
  const details = [error.code, error.detail || error.title, ...(error.errors ?? []).map((field) => `${field.field}: ${field.detail}`)].filter(Boolean).join(" · ");
  return <AdminError error={{ ...error, detail: details }} onRetry={retry} />;
}

export function OperationsTable({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: boolean }) {
  return <div className="overflow-x-auto rounded-sm border border-border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-xs text-muted-foreground"><tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{children}</tbody></table>{empty && <p role="status" className="p-10 text-center text-sm text-muted-foreground">No results match these filters.</p>}</div>;
}

export function OperationsPagination({ result, change }: { result?: Page<unknown>; change: (page: number) => void }) {
  return <AdminPagination page={result ? { number: result.page, size: result.size, totalElements: result.totalElements, totalPages: result.totalPages } : undefined} onPageChange={change} />;
}

export function OperationTime({ value }: { value: string }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value))}</time>;
}

export const operationCell = "px-4 py-4 align-top";
export const referenceClass = "break-all font-mono text-xs text-muted-foreground";
