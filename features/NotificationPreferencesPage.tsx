"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/button";
import { AdminError } from "../components/AdminPrimitives";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getNotificationPreferences, updateNotificationPreferences } from "../service/notificationSettingsService";
import type { NotificationPreferences, UpdateNotificationPreferences } from "../types/notificationSettingsType";

const label = (value: string) => value.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

function PreferencesForm({ initial, saved }: { initial: NotificationPreferences; saved: () => void }) {
  const auth = useAuth();
  const client = useQueryClient();
  const [rows, setRows] = useState(initial.preferences);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mutation = useApiMutation<NotificationPreferences, { body: UpdateNotificationPreferences; sessionId: number; controller: AbortController }>({
    mutationKey: ["notification", auth.sessionId, "preferences", "update"],
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    execute: ({ body, controller }) => updateNotificationPreferences(body, { context: auth.requestContext, signal: controller.signal }),
  }, { onSuccess: (data) => { client.setQueryData(queryKeys.notification.preferences(auth.sessionId), data); saved(); } });
  const changes = rows.filter((entry, index) => entry.enabled !== initial.preferences[index].enabled);
  return <form onSubmit={(event) => {
    event.preventDefault();
    if (!changes.length || mutation.isPending) return;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    mutation.mutate({ sessionId: auth.sessionId, controller, body: { preferences: changes.map(({ notificationType, channel, enabled }) => ({ notificationType, channel, enabled })) } });
  }} className="space-y-5">
    <fieldset disabled={mutation.isPending} className="overflow-x-auto rounded-sm border border-border">
      <legend className="sr-only">Notification type and channel preferences</legend>
      <table className="w-full text-left text-sm"><caption className="sr-only">Notification preferences</caption><thead className="bg-muted text-muted-foreground"><tr>{["Notification", "Channel", "Receive"].map((heading) => <th scope="col" key={heading} className="px-4 py-3 font-normal">{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.notificationType}:${row.channel}`} className="border-t border-border">
          <th scope="row" className="px-4 py-4 font-normal">{label(row.notificationType)}{row.mandatory && <span className="mt-1 block text-xs text-muted-foreground">Required for your transactions</span>}</th>
          <td className="px-4 py-4">{row.channel === "EMAIL" ? "Email" : "In app"}</td>
          <td className="px-4 py-4"><input type="checkbox" aria-label={`${label(row.notificationType)} ${row.channel === "EMAIL" ? "email" : "in app"}`} disabled={row.mandatory} checked={row.enabled}
            onChange={(event) => { const enabled = event.target.checked; setRows((current) => current.map((entry, at) => at === index ? { ...entry, enabled } : entry)); }}
            className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60" /></td>
        </tr>)}</tbody></table>
    </fieldset>
    <AdminError error={mutation.error} />
    <Button type="submit" className="min-h-11" disabled={mutation.isPending || !changes.length}>{mutation.isPending ? "Saving…" : "Save preferences"}</Button>
  </form>;
}

function NotificationPreferencesPage() {
  const auth = useAuth();
  const [notice, setNotice] = useState("");
  const preferences = useApiQuery({ queryKey: queryKeys.notification.preferences(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getNotificationPreferences({ context: auth.requestContext, signal }) }, { enabled: auth.status === "authenticated" });
  if (auth.status === "anonymous") return <div className="space-y-4"><h1 className="text-heading-32">Notification settings</h1><Link href="/sign-in?returnTo=%2Fnotifications" className="inline-flex min-h-11 items-center text-primary underline">Sign in to manage notifications</Link></div>;
  if (auth.status === "error") return <AdminError error={auth.error} onRetry={() => void auth.retryProfile()} />;
  return <section aria-label="Notification settings" className="space-y-6 pb-10">
    <div><h1 className="text-heading-32">Notification settings</h1><p className="mt-2 text-sm text-muted-foreground">Choose how you receive updates. Transaction notifications stay enabled so you can follow your orders and payments.</p></div>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {preferences.isPending ? <p role="status">Loading notification settings…</p> : preferences.error ? <AdminError error={preferences.error} onRetry={() => void preferences.refetch()} /> : preferences.data && <PreferencesForm key={`${auth.sessionId}:${preferences.dataUpdatedAt}`} initial={preferences.data} saved={() => setNotice("Notification preferences saved.")} />}
  </section>;
}
export default NotificationPreferencesPage;
