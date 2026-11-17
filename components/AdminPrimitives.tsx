"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Inbox } from "lucide-react";
import { Button } from "./button";
import type { ApiError, PageInfo } from "../types/commonResponseType";

export const adminInputClass = "min-h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export const adminSelectClass = adminInputClass.replace("w-full ", "");

export function AdminPageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="text-heading-32">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{children && <div className="flex flex-wrap items-center gap-2">{children}</div>}</div>;
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return <div role="status" className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-border px-6 py-12 text-center"><Inbox className="mb-2 size-6 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-medium">{title}</p>{description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}</div>;
}

export function AdminError({ error, onRetry }: { error: ApiError | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-danger/30 bg-danger/5 p-4 text-sm"><CircleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" /><p className="min-w-0 flex-1 break-words">{error.detail || error.title || "Unable to load this page."}</p>{onRetry && <Button variant="outline" className="min-h-10" onClick={onRetry}>Retry</Button>}</div>;
}

export function AdminPagination({ page, onPageChange }: { page?: PageInfo; onPageChange: (page: number) => void }) {
  if (!page) return null;
  const first = page.totalElements && page.number * page.size < page.totalElements ? page.number * page.size + 1 : 0;
  const last = Math.min((page.number + 1) * page.size, page.totalElements);
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground"><p>{first ? `Showing ${first}–${last}` : "Showing 0"} of {page.totalElements} results</p><div className="flex items-center gap-2"><Button variant="outline" aria-label="Previous page" className="min-h-10" disabled={page.number === 0} onClick={() => onPageChange(page.number - 1)}><ChevronLeft className="size-4" /></Button><span aria-live="polite">Page {page.number + 1} of {Math.max(1, page.totalPages)}</span><Button variant="outline" aria-label="Next page" className="min-h-10" disabled={page.number + 1 >= page.totalPages} onClick={() => onPageChange(page.number + 1)}><ChevronRight className="size-4" /></Button></div></nav>;
}
