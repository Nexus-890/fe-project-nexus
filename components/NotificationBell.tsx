"use client";

import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import type { Notification } from "@/types/notificationResponseType";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/popover";
import { ScrollArea } from "@/components/scroll-area";
import { cn } from "cn";

export type NotificationBellProps = {
  notifications: Notification[];
  unreadCount?: number;
  loading?: boolean;
  error?: boolean;
  countError?: boolean;
  isUpdating?: boolean;
  canMarkRead?: boolean;
  canMarkAllRead?: boolean;
  mutationError?: string | null;
  onOpenNotification?: (id: string) => void;
  onMarkAllRead?: () => void;
  onRetry?: () => void;
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function displayUnreadCount(value: number | undefined) {
  if (value === undefined) return null;
  if (value <= 0) return null;
  return value > 99 ? "99+" : value;
}

function NotificationBell({
  notifications,
  unreadCount,
  loading = false,
  error = false,
  countError = false,
  isUpdating = false,
  canMarkRead = false,
  canMarkAllRead = false,
  mutationError,
  onOpenNotification,
  onMarkAllRead,
  onRetry,
}: NotificationBellProps) {
  const contentId = useId();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const latestNotifications = notifications.slice(0, 10);
  const badgeLabel = displayUnreadCount(countError ? undefined : unreadCount);
  const hasUnread = !countError && (unreadCount ?? 0) > 0;
  const readStatusUnavailable = !canMarkRead || !canMarkAllRead;

  function openNotification(notification: Notification) {
    if (isUpdating && notification.readAt === null) return;
    const opening = expandedId !== notification.id;
    setExpandedId(opening ? notification.id : null);
    if (
      opening &&
      notification.readAt === null &&
      canMarkRead &&
      !isUpdating
    ) {
      onOpenNotification?.(notification.id);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={
          badgeLabel === null
            ? "Notifications"
            : `Notifications, ${unreadCount} unread`
        }
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 hover:text-primary"
      >
        <Bell size={17} aria-hidden="true" />
        {badgeLabel !== null && (
          <Badge
            variant="destructive"
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 min-w-4 justify-center px-1 text-[10px] leading-4"
          >
            {badgeLabel}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
        aria-label="Notifications"
      >
        <PopoverHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle className="text-base">Notifications</PopoverTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              disabled={
                !hasUnread || isUpdating || !canMarkAllRead || !onMarkAllRead
              }
              className="min-h-8 text-xs text-primary"
            >
              {isUpdating ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CheckCheck className="size-3.5" aria-hidden="true" />
              )}
              Mark all as read
            </Button>
          </div>
          <PopoverDescription className="text-xs">
            Latest updates for your account
          </PopoverDescription>
        </PopoverHeader>

        {mutationError && (
          <p
            role="alert"
            className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive"
          >
            {mutationError}
          </p>
        )}

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-32 items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading notifications…
          </div>
        ) : error ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              Unable to load notifications.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="min-h-8 text-xs text-primary"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Retry
              </Button>
            )}
          </div>
        ) : latestNotifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="h-[min(24rem,55dvh)]">
            <ul
              aria-label="Recent notifications"
              className="divide-y divide-border"
            >
              {latestNotifications.map((notification) => {
                const unread = notification.readAt === null;
                const expanded = expandedId === notification.id;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      disabled={isUpdating && unread}
                      onClick={() => openNotification(notification)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left outline-none transition hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        unread && "bg-primary/5",
                      )}
                      aria-label={`${notification.title}, ${unread ? "unread" : "read"}`}
                      aria-expanded={expanded}
                      aria-controls={`${contentId}-${notification.id}`}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent",
                            unread && "bg-primary",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]",
                            unread && "font-medium",
                          )}
                        >
                          {notification.title}
                        </span>
                      </span>
                      <span
                        id={`${contentId}-${notification.id}`}
                        className={cn(
                          "max-w-full break-words pl-3.5 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]",
                          !expanded && "line-clamp-2",
                        )}
                      >
                        {notification.content}
                      </span>
                      <time
                        dateTime={notification.createdAt}
                        className="pl-3.5 text-[11px] text-muted-foreground"
                      >
                        {formatNotificationDate(notification.createdAt)} UTC
                      </time>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        {!loading && !error && readStatusUnavailable && (
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Read status updates are unavailable.
          </p>
        )}
        {countError && !error && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
            <p role="status" className="text-xs text-muted-foreground">
              The unread count is temporarily unavailable.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Retry unread count"
                onClick={onRetry}
                className="min-h-8 text-xs text-primary"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Retry
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
