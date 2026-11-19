"use client";

import { useEffect, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";
import { createCanceledError } from "@/configs/api";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationStream } from "./useNotificationStream";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_ENDPOINTS,
} from "@/service/notificationService";

type ReadOperation = {
  notificationId?: string;
  sessionId: number;
  controller: AbortController;
};

const latestNotifications = { page: 0, size: 10 };

function NotificationBellFeature() {
  const liveUpdatesPaused = useNotificationStream();
  const { status, requestContext, sessionId, isSessionCurrent } = useAuth();
  const pendingRead = useRef<AbortController | null>(null);
  const enabled = status === "authenticated";
  const notifications = useApiQuery(
    {
      queryKey: queryKeys.notification.list(sessionId, latestNotifications),
      service: (signal) => {
        if (!isSessionCurrent(sessionId)) throw createCanceledError();
        return getNotifications(latestNotifications, {
          context: requestContext,
          signal,
        });
      },
      meta: { requiresAuth: true },
    },
    { enabled },
  );
  const unreadCount = useApiQuery(
    {
      queryKey: queryKeys.notification.unreadCount(sessionId),
      service: (signal) => {
        if (!isSessionCurrent(sessionId)) throw createCanceledError();
        return getUnreadNotificationCount({
          context: requestContext,
          signal,
        });
      },
      meta: { requiresAuth: true },
    },
    { enabled },
  );

  useEffect(() => () => pendingRead.current?.abort(), []);

  const markRead = useApiMutation<void, ReadOperation>({
    mutationKey: ["notification", sessionId, "mark-read"],
    execute: ({ notificationId, controller }) => {
      const options = { context: requestContext, signal: controller.signal };
      return notificationId === undefined
        ? markAllNotificationsRead(options)
        : markNotificationRead(notificationId, options);
    },
    isCurrent: (operation) =>
      isSessionCurrent(operation.sessionId) &&
      !operation.controller.signal.aborted,
    invalidateKey: (_data, operation) => [
      queryKeys.notification.list(operation.sessionId, latestNotifications),
      queryKeys.notification.unreadCount(operation.sessionId),
    ],
  });
  const canMarkRead = Boolean(NOTIFICATION_ENDPOINTS.read.trim());
  const canMarkAllRead = Boolean(NOTIFICATION_ENDPOINTS.readAll.trim());
  const isUpdating = markRead.isPending;
  const updateReadStatus = (notificationId?: string) => {
    if (
      !isSessionCurrent(sessionId) ||
      isUpdating ||
      !(notificationId === undefined ? canMarkAllRead : canMarkRead)
    )
      return;
    pendingRead.current?.abort();
    const controller = new AbortController();
    pendingRead.current = controller;
    markRead.mutate({ notificationId, sessionId, controller });
  };

  return (
    <NotificationBell
      notifications={notifications.data?.content ?? []}
      liveUpdatesPaused={liveUpdatesPaused}
      unreadCount={unreadCount.data}
      loading={notifications.isPending}
      error={notifications.isError}
      countError={unreadCount.isError}
      isUpdating={isUpdating}
      canMarkRead={canMarkRead}
      canMarkAllRead={canMarkAllRead}
      mutationError={
        markRead.isError && markRead.error.kind !== "aborted"
          ? "Unable to update read status. Please try again."
          : undefined
      }
      onOpenNotification={(id) => updateReadStatus(id)}
      onMarkAllRead={() => updateReadStatus()}
      onRetry={() => {
        if (!isSessionCurrent(sessionId)) return;
        void notifications.refetch();
        void unreadCount.refetch();
      }}
    />
  );
}

export default NotificationBellFeature;
