"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "../configs/api";
import { useAuth } from "../hooks/useAuth";
import { watchNotifications } from "../service/notificationSettingsService";
import { createNotificationRefreshQueue } from "./notificationRefreshQueue";

export function useNotificationStream() {
  const { status, accessToken, sessionId, requestContext, isSessionCurrent } = useAuth();
  const client = useQueryClient();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const current = () => !controller.signal.aborted && isSessionCurrent(sessionId);
    const refresh = createNotificationRefreshQueue(client, sessionId, current, setPaused);
    const connect = async () => {
      if (!current()) return;
      try {
        await watchNotifications((snapshot) => {
          if (!current()) return;
          failures = 0; setPaused(false);
          refresh.request(snapshot.revision);
        }, { context: requestContext, signal: controller.signal });
      } catch (error) {
        if (!current()) return;
        setPaused(true);
        if (isApiError(error) && (error.status === 401 || error.status === 403)) return;
        failures++;
      }
      if (current()) timer = setTimeout(() => void connect(), Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5)));
    };
    void connect();
    return () => { clearTimeout(timer); refresh.stop(); controller.abort(); };
  }, [status, accessToken, sessionId, requestContext, isSessionCurrent, client]);
  return paused;
}
