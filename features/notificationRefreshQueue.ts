import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";

/** A received revision is acknowledged only after both inbox reads have refreshed successfully. */
export function createNotificationRefreshQueue(client: QueryClient, sessionId: number, isCurrent: () => boolean,
  onSettled: (failed: boolean) => void) {
  const keys = [queryKeys.notification.list(sessionId, { page: 0, size: 10 }), queryKeys.notification.unreadCount(sessionId)];
  let desired: string | undefined, applied: string | undefined;
  let running = false, stopped = false, failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const current = () => !stopped && isCurrent();

  const refresh = async () => {
    if (running || !current() || desired === applied) return;
    running = true;
    try {
      while (current() && desired !== applied) {
        const revision = desired;
        // invalidateQueries alone reuses a pending initial GET when no data is cached.
        await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey, exact: true })));
        if (!current()) return;
        const results = await Promise.allSettled(keys.map((queryKey) =>
          client.invalidateQueries({ queryKey, exact: true }, { throwOnError: true })));
        if (!current()) return;
        const incomplete = results.some((result) => result.status === "rejected") || keys.some((queryKey) => {
          const state = client.getQueryState(queryKey);
          return !state || state.status !== "success" || state.fetchStatus !== "idle" || state.isInvalidated;
        });
        if (incomplete) {
          onSettled(true);
          retry = setTimeout(() => { retry = undefined; void refresh(); }, Math.min(30_000, 1_000 * 2 ** Math.min(failures++, 5)));
          return;
        }
        applied = revision;
        failures = 0;
        onSettled(false);
      }
    } finally { running = false; }
  };

  return {
    request(revision: string) {
      if (!current()) return;
      desired = revision;
      if (!retry) void refresh();
    },
    stop() { stopped = true; clearTimeout(retry); },
  };
}
