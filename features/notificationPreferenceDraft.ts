import type { NotificationPreference, UpdateNotificationPreferences } from "../types/notificationSettingsType";

export type NotificationPreferenceEdits = Readonly<Record<string, boolean>>;
export const notificationPreferenceKey = ({ notificationType, channel }: Pick<NotificationPreference, "notificationType" | "channel">) => `${notificationType}:${channel}`;

/** Only user-edited cells override the latest server snapshot; reconnect may reorder or add cells. */
export const projectNotificationPreferenceDraft = (preferences: readonly NotificationPreference[], edits: NotificationPreferenceEdits) => {
  const changes: UpdateNotificationPreferences["preferences"] = [];
  const rows = preferences.map((preference) => {
    const enabled = preference.mandatory ? true : edits[notificationPreferenceKey(preference)] ?? preference.enabled;
    if (enabled !== preference.enabled && !preference.mandatory) {
      changes.push({ notificationType: preference.notificationType, channel: preference.channel, enabled });
    }
    return enabled === preference.enabled ? preference : { ...preference, enabled };
  });
  return { rows, changes };
};

export const editNotificationPreferenceDraft = (
  preferences: readonly NotificationPreference[], edits: NotificationPreferenceEdits,
  key: string, enabled: boolean,
): NotificationPreferenceEdits => {
  const preference = preferences.find((entry) => notificationPreferenceKey(entry) === key);
  if (!preference || preference.mandatory) return edits;
  const next = { ...edits };
  if (enabled === preference.enabled) delete next[key];
  else next[key] = enabled;
  return next;
};
