"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, CircleCheck, Gavel, Settings2, ShieldCheck, Truck } from "lucide-react";
import { createCanceledError } from "@/configs/api";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from "@/service/notificationService";
import { Pagination } from "@/components/Pagination";
import type { Notification } from "@/types/notificationResponseType";
import { parsePage } from "./catalogUtils";

const tabs = ["All", "Auctions", "Orders", "Payments", "System"] as const;
type Category = typeof tabs[number];
const categoryFor = (type: string): Category => /AUCTION|BID/.test(type) ? "Auctions" : /PAYMENT|REFUND/.test(type) ? "Payments" : /ORDER|SHIP/.test(type) ? "Orders" : "System";
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";

function NotificationRow({ item, pending, onRead }: { item: Notification; pending: boolean; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const category = categoryFor(item.type);
  const Icon = category === "Auctions" ? Gavel : category === "Orders" ? Truck : category === "Payments" ? CircleCheck : ShieldCheck;
  return <li className="min-w-0 border-b border-border last:border-0">
    <button type="button" disabled={pending && item.readAt === null} aria-expanded={expanded}
      onClick={() => { setExpanded(!expanded); if (!expanded && item.readAt === null) onRead(item.id); }}
      className="flex w-full min-w-0 items-start gap-4 p-4 text-left hover:bg-muted disabled:opacity-60 sm:p-5">
      <Icon className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className={`block break-words text-sm ${item.readAt === null ? "font-semibold" : "font-medium"}`}>{item.title}</span>
        <span className={`mt-1 block break-words text-sm leading-6 text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>{item.content}</span>
        <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground sm:hidden">{dateFormat.format(new Date(item.createdAt))}</time>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-3"><time dateTime={item.createdAt} className="hidden text-xs text-muted-foreground sm:block">{dateFormat.format(new Date(item.createdAt))}</time>
        {item.readAt === null && <span className="size-2 rounded-full bg-info" aria-label="Unread" />}</span>
    </button>
  </li>;
}

function NotificationContents() {
  const auth = useAuth();
  const params = useSearchParams();
  const page = parsePage(params.get("page") ?? undefined) - 1;
  const [tab, setTab] = useState<Category>("All");
  const pendingRead = useRef<AbortController | null>(null);
  const filters = { page, size: 10 };
  const notifications = useApiQuery({ queryKey: queryKeys.notification.list(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => {
      if (!auth.isSessionCurrent(auth.sessionId)) throw createCanceledError();
      return getNotifications(filters, { context: auth.requestContext, signal });
    } });
  const count = useApiQuery({ queryKey: queryKeys.notification.unreadCount(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getUnreadNotificationCount({ context: auth.requestContext, signal }) });
  useEffect(() => () => pendingRead.current?.abort(), []);
  const read = useApiMutation<void, { id?: string; sessionId: number; controller: AbortController }>({
    execute: ({ id, controller }) => id ? markNotificationRead(id, { context: auth.requestContext, signal: controller.signal }) : markAllNotificationsRead({ context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [["notification", auth.sessionId]],
  });
  const mark = (id?: string) => {
    if (read.isPending || !auth.isSessionCurrent(auth.sessionId)) return;
    const controller = new AbortController(); pendingRead.current = controller;
    read.mutate({ id, controller, sessionId: auth.sessionId });
  };
  const items = notifications.data?.content.filter((item) => tab === "All" || categoryFor(item.type) === tab) ?? [];
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 id="notifications-title" className="text-heading-32">Notifications</h1><p className="mt-2 text-sm text-muted-foreground">{count.isSuccess ? `${count.data} unread` : "Your latest account updates"}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={control} disabled={!count.data || read.isPending} onClick={() => mark()}><CheckCheck size={16} aria-hidden="true" />{read.isPending ? "Updating…" : "Mark All as Read"}</button><Link href="/notifications/preferences" className={control} aria-label="Notification preferences"><Settings2 size={16} aria-hidden="true" /></Link></div></div>
    <nav aria-label="Notification categories" className="mt-7 flex flex-wrap gap-x-5 border-b border-border">{tabs.map((value) => <button type="button" key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)} className={`min-h-11 border-b-2 text-sm ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{value}</button>)}</nav>
    {tab !== "All" && <p className="mt-4 text-xs leading-5 text-muted-foreground">Filtering the current page. Use pagination to browse older updates.</p>}
    {read.isError && read.error.kind !== "aborted" && <p role="alert" className="mt-4 text-sm text-danger">{read.error.detail || "Unable to update read status. Please try again."}</p>}
    {count.isError && <p role="status" className="mt-4 text-sm text-muted-foreground">Unread count unavailable. <button type="button" className="underline" onClick={() => void count.refetch()}>Retry count</button></p>}
    {notifications.isPending ? <p role="status" className="py-12 text-muted-foreground">Loading notifications…</p> : notifications.isError ? <div className="py-8"><p role="alert">{notifications.error.detail || "Unable to load notifications."}</p><button type="button" className={`${control} mt-4`} onClick={() => void notifications.refetch()}>Retry notifications</button></div> : <>
      {!items.length ? <div role="status" className="py-14 text-center"><Bell size={28} className="mx-auto text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-heading-20">No notifications found</h2><p className="mt-2 text-sm text-muted-foreground">{tab === "All" ? "Account updates will appear here." : "No updates in this category on the current page."}</p></div> : <ul aria-label="Account notifications" className="mt-6 overflow-hidden rounded-sm border border-border">{items.map((item) => <NotificationRow key={item.id} item={item} pending={read.isPending} onRead={mark} />)}</ul>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted-foreground">{notifications.data?.totalElements ?? 0} notifications</p><Pagination ariaLabel="Notification pagination" page={page + 1} totalPages={notifications.data?.totalPages ?? 0} hrefForPage={(value) => `/notifications?page=${value}`} /></div>
    </>}
  </>;
}

function NotificationsPage() {
  const auth = useAuth();
  return <section className="min-w-0 pb-12" aria-labelledby="notifications-title">{auth.status === "authenticated" ? <NotificationContents key={auth.sessionId} /> : auth.status === "anonymous" ? <><h1 id="notifications-title" className="text-heading-32">Notifications</h1><p className="mt-4 text-muted-foreground">Sign in to view your notifications.</p><Link href="/sign-in?returnTo=%2Fnotifications" className={`${control} mt-5`}>Sign in</Link></> : auth.status === "error" ? <><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><button type="button" onClick={() => void auth.retryProfile()} className={control}>Retry account</button></> : <p role="status">Loading your account…</p>}</section>;
}

export default NotificationsPage;
