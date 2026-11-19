import type { components } from "./notificationGeneratedType";
import type { PageInfo } from "./commonResponseType";

export type NotificationPreference = components["schemas"]["NotificationPreference"];
export type NotificationPreferences = components["schemas"]["NotificationPreferences"];
export type UpdateNotificationPreferences = components["schemas"]["UpdateNotificationPreferences"];
export type NotificationDelivery = components["schemas"]["NotificationDeliverySummary"];
export type NotificationDeliveryDetail = components["schemas"]["NotificationDeliveryDetail"];
export type NotificationDeliveryAttempt = components["schemas"]["NotificationDeliveryAttempt"];
export const deliveryStatuses = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export const deliveryChannels = ["EMAIL", "PUSH", "SMS"] as const;
export type NotificationDeliveryFilters = {
  page?: number; size?: number; status?: typeof deliveryStatuses[number];
  channel?: typeof deliveryChannels[number]; from?: string; to?: string; errorCode?: string;
};
export type NotificationDeliveryPage = { items: NotificationDelivery[]; page: PageInfo };
