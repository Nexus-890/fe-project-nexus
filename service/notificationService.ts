import {
  createInvalidResponseError,
  isRecord,
  requestApi,
  resolveApiUrl,
} from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiError, ApiResponse, Page } from "../types/commonResponseType";
import type { NotificationFilters } from "../types/notificationRequestType";
import type { Notification } from "../types/notificationResponseType";

/** Paths use the common base URL configured in configs/api.ts. */
export const NOTIFICATION_ENDPOINTS = {
  list: "/api/v1/notifications",
  unreadCount: "/api/v1/notifications/unread-count",
  // Fill these when the backend endpoints are available on this branch.
  // The single-notification route should contain :id for the notification ID.
  read: "",
  readAll: "",
};

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const parseNotification = (value: unknown): Notification => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.type !== "string" ||
    typeof value.title !== "string" ||
    typeof value.content !== "string" ||
    (value.readAt !== null && !isTimestamp(value.readAt)) ||
    !isTimestamp(value.createdAt)
  )
    throw createInvalidResponseError("Invalid notification");
  return {
    id: value.id,
    type: value.type,
    title: value.title,
    content: value.content,
    readAt: value.readAt,
    createdAt: value.createdAt,
  };
};

export const parseNotificationPage = (
  response: ApiResponse<unknown>,
): Page<Notification> => {
  const { data, page } = response;
  if (!Array.isArray(data) || !page)
    throw createInvalidResponseError(
      "Expected notification data[] with page metadata",
    );
  return {
    content: data.map(parseNotification),
    page: page.number,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
  };
};

export const getNotifications = async (
  { page = 0, size = 10 }: NotificationFilters = {},
  options: ServiceRequestOptions = {},
): Promise<Page<Notification>> => {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw createInvalidResponseError("Invalid notification pagination");
  return parseNotificationPage(
    await requestApi<unknown>("GET", NOTIFICATION_ENDPOINTS.list, undefined, {
      ...options,
      auth: true,
      params: { page, size },
    }),
  );
};

export const getUnreadNotificationCount = async (
  options: ServiceRequestOptions = {},
): Promise<number> => {
  const { data } = await requestApi<unknown>(
    "GET",
    NOTIFICATION_ENDPOINTS.unreadCount,
    undefined,
    { ...options, auth: true },
  );
  if (
    !isRecord(data) ||
    !Number.isSafeInteger(data.count) ||
    Number(data.count) < 0
  )
    throw createInvalidResponseError("Invalid unread notification count");
  return data.count as number;
};

const requireEndpoint = (path: string): string => {
  if (!path.trim())
    throw {
      ...createInvalidResponseError("Notification endpoint is not configured"),
      code: "NOTIFICATION_ENDPOINT_NOT_CONFIGURED",
      title: "Marking notifications as read is not available yet.",
    } satisfies ApiError;
  return path;
};

export const markNotificationRead = async (
  id: string,
  options: ServiceRequestOptions = {},
): Promise<void> => {
  const path = requireEndpoint(NOTIFICATION_ENDPOINTS.read);
  if (!id.trim()) throw createInvalidResponseError("Notification id is required");
  await requestApi<void>(
    "PATCH",
    resolveApiUrl(path, { id }),
    undefined,
    { ...options, auth: true },
  );
};

export const markAllNotificationsRead = async (
  options: ServiceRequestOptions = {},
): Promise<void> => {
  await requestApi<void>(
    "PATCH",
    requireEndpoint(NOTIFICATION_ENDPOINTS.readAll),
    undefined,
    { ...options, auth: true },
  );
};
