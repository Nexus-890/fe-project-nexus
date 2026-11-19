import { createInvalidResponseError, isRecord, requestApi, requestApiStream } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { deliveryChannels, deliveryStatuses, type NotificationDelivery, type NotificationDeliveryAttempt, type NotificationDeliveryDetail,
  type NotificationDeliveryFilters, type NotificationDeliveryPage, type NotificationPreference, type NotificationPreferences, type UpdateNotificationPreferences } from "../types/notificationSettingsType";

const instant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableInstant = (value: unknown): value is string | null => value === null || instant(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const preferenceKey = (value: { notificationType: string; channel: string }) => `${value.notificationType}:${value.channel}`;

const parsePreference = (value: unknown): NotificationPreference => {
  if (!isRecord(value) || !text(value.notificationType) || (value.channel !== "EMAIL" && value.channel !== "IN_APP") ||
    typeof value.enabled !== "boolean" || typeof value.mandatory !== "boolean" || value.mandatory && !value.enabled)
    throw createInvalidResponseError("Invalid notification preference");
  return { notificationType: value.notificationType, channel: value.channel, enabled: value.enabled, mandatory: value.mandatory };
};
export const parseNotificationPreferences = (value: unknown): NotificationPreferences => {
  if (!isRecord(value) || !Array.isArray(value.preferences)) throw createInvalidResponseError("Invalid notification preferences");
  const preferences = value.preferences.map(parsePreference);
  if (new Set(preferences.map(preferenceKey)).size !== preferences.length)
    throw createInvalidResponseError("Duplicate notification preferences");
  return { preferences };
};
export const getNotificationPreferences = async (options: ServiceRequestOptions = {}): Promise<NotificationPreferences> => {
  const { data } = await requestApi<unknown>("GET", "/api/v1/notifications/preferences", undefined, { ...options, auth: true, params: undefined });
  return parseNotificationPreferences(data);
};
export const updateNotificationPreferences = async (body: UpdateNotificationPreferences, options: ServiceRequestOptions = {}): Promise<NotificationPreferences> => {
  if (!Array.isArray(body.preferences) || !body.preferences.length || body.preferences.length > 100 || body.preferences.some((entry) => !text(entry.notificationType) ||
    (entry.channel !== "EMAIL" && entry.channel !== "IN_APP") || typeof entry.enabled !== "boolean") ||
    new Set(body.preferences.map(preferenceKey)).size !== body.preferences.length)
    throw createInvalidResponseError("Invalid notification preference update");
  const { data } = await requestApi<unknown>("PUT", "/api/v1/notifications/preferences", body, { ...options, auth: true, params: undefined });
  const result = parseNotificationPreferences(data);
  if (body.preferences.some((change) => !result.preferences.some((entry) => preferenceKey(entry) === preferenceKey(change) && entry.enabled === change.enabled)))
    throw createInvalidResponseError("Saved preferences do not match your changes");
  return result;
};

export const watchNotifications = async (changed: (snapshot: { unreadCount: number; revision: string }) => void, options: ServiceRequestOptions = {}): Promise<void> =>
  requestApiStream("/api/v1/notifications/stream", (event) => {
    if (event.event !== "notifications") return;
    let value: unknown;
    try { value = JSON.parse(event.data); } catch { throw createInvalidResponseError("Invalid notification update"); }
    if (!isRecord(value) || !integer(value.unreadCount) || !text(value.revision))
      throw createInvalidResponseError("Invalid notification update");
    changed({ unreadCount: value.unreadCount, revision: value.revision });
  }, { ...options, auth: true });

const parseDelivery = (value: unknown): NotificationDelivery => {
  if (!isRecord(value) || !text(value.id) || !text(value.notificationId) || !text(value.userId) || !text(value.type) || typeof value.title !== "string" ||
    !deliveryChannels.some((channel) => channel === value.channel) || !deliveryStatuses.some((status) => status === value.status) || !integer(value.attemptCount) ||
    !nullableInstant(value.nextAttemptAt) || !instant(value.createdAt) || !instant(value.updatedAt) || !nullableText(value.lastErrorCode))
    throw createInvalidResponseError("Invalid notification delivery");
  return { id: value.id, notificationId: value.notificationId, userId: value.userId, type: value.type, title: value.title,
    channel: value.channel as NotificationDelivery["channel"], status: value.status as NotificationDelivery["status"], attemptCount: value.attemptCount,
    nextAttemptAt: value.nextAttemptAt, createdAt: value.createdAt, updatedAt: value.updatedAt, lastErrorCode: value.lastErrorCode };
};
const parseAttempt = (value: unknown): NotificationDeliveryAttempt => {
  if (!isRecord(value) || !text(value.id) || !integer(value.attemptNumber) || Number(value.attemptNumber) < 1 ||
    !["STARTED", "SUCCEEDED", "FAILED"].includes(String(value.status)) || !instant(value.attemptedAt) || !nullableInstant(value.completedAt) ||
    !nullableText(value.errorCode) || typeof value.retryable !== "boolean") throw createInvalidResponseError("Invalid delivery attempt");
  return { id: value.id, attemptNumber: value.attemptNumber, status: value.status as NotificationDeliveryAttempt["status"],
    attemptedAt: value.attemptedAt, completedAt: value.completedAt, errorCode: value.errorCode, retryable: value.retryable };
};
export const getNotificationDeliveries = async (filters: NotificationDeliveryFilters = {}, options: ServiceRequestOptions = {}): Promise<NotificationDeliveryPage> => {
  const { page = 0, size = 20, status, channel, from, to, errorCode } = filters;
  if (!integer(page) || !integer(size) || size < 1 || size > 100 || status !== undefined && !deliveryStatuses.includes(status) ||
    channel !== undefined && !deliveryChannels.includes(channel) || from !== undefined && !instant(from) || to !== undefined && !instant(to) ||
    from && to && Date.parse(from) >= Date.parse(to) || errorCode !== undefined && !/^[A-Z0-9_]{1,60}$/.test(errorCode))
    throw createInvalidResponseError("Invalid notification delivery filters");
  const response = await requestApi<unknown>("GET", "/api/v1/notifications/deliveries", undefined, {
    ...options, auth: true, params: { page, size, status, channel, from, to, errorCode },
  });
  if (!Array.isArray(response.data) || !response.page) throw createInvalidResponseError("Expected deliveries with page metadata");
  const items = response.data.map(parseDelivery);
  // errorCode matches any historical attempt, so the latest error may differ or be null after success.
  if (response.page.number !== page || response.page.size !== size || items.some((row) => status && row.status !== status || channel && row.channel !== channel))
    throw createInvalidResponseError("Delivery results do not match the requested filters");
  return { items, page: response.page };
};
export const getNotificationDelivery = async (id: string, options: ServiceRequestOptions = {}): Promise<NotificationDeliveryDetail> => {
  if (!text(id)) throw createInvalidResponseError("A delivery ID is required");
  const { data } = await requestApi<unknown>("GET", `/api/v1/notifications/deliveries/${encodeURIComponent(id)}`, undefined, { ...options, auth: true, params: undefined });
  const row = parseDelivery(data);
  if (row.id !== id || !isRecord(data) || !Array.isArray(data.attempts)) throw createInvalidResponseError("Invalid delivery detail");
  return { ...row, attempts: data.attempts.map(parseAttempt) };
};
