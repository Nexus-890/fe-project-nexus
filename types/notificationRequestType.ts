import type { operations } from "./notificationGeneratedType";

export type NotificationFilters = NonNullable<
  operations["listNotifications"]["parameters"]["query"]
>;
