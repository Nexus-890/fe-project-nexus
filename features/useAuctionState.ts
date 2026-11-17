"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openPublicAuctionStream } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAuction, getAuctionBids, getAuctionState, getMyAuctionBid, parseAuctionState } from "../service/auctionService";
import { compareAuctionMoney, isAuctionTerminal } from "./auctionRoomUtils";
import { auctionStateChanged, getAuctionMineInterval, hasCurrentAuctionResult, isAuctionReadUnavailable, isAuctionStreamHealthy, reconcileAuctionStatus, selectLatestAuctionState } from "./auctionStateReconciliation";
import type { AuctionRoom, AuctionState } from "../types/auctionRoomType";
const SUPPORTING_REFRESH_MS = 2000;

/** Validated push snapshots update immediately; absent heartbeats restore two-second polling. */
export function useAuctionState(auctionId: string) {
  const { status: authStatus, sessionId, requestContext } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  const [heartbeat, setHeartbeat] = useState<{ source: EventSource; at: number } | null>(null);
  const [clock, setClock] = useState(() => ({ monotonic: performance.now(), wall: Date.now() }));
  const connected = Boolean(heartbeat && isAuctionStreamHealthy(heartbeat.at, clock.monotonic, heartbeat.source.readyState));
  const interval = connected ? 15_000 : 2000;
  const state = useApiQuery({
    queryKey: queryKeys.auctions.state(auctionId),
    service: async (signal) => {
      const incoming = await getAuctionState(auctionId, { signal });
      // A REST request started before a push must not replace that newer state on completion.
      return selectLatestAuctionState(client.getQueryData<AuctionState>(queryKeys.auctions.state(auctionId)), incoming);
    },
  }, {
    enabled: visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !isAuctionTerminal(reconcileAuctionStatus(query.state.data?.status,
      client.getQueryData<AuctionRoom>(queryKeys.auctions.detail(auctionId))?.status) ?? "") && !isAuctionReadUnavailable(query.state.error) ? interval : false,
    refetchOnWindowFocus: true,
  });
  const detail = useApiQuery({
    queryKey: queryKeys.auctions.detail(auctionId),
    service: (signal) => getAuction(auctionId, { signal }),
  }, {
    staleTime: 0,
    // Rich detail and the private lookup reconcile more slowly to fit the gateway budget.
    refetchInterval: (query) => {
      if (!visible || isAuctionReadUnavailable(query.state.error)) return false;
      const latestStatus = reconcileAuctionStatus(query.state.data?.status, state.data?.status);
      if (latestStatus && isAuctionTerminal(latestStatus))
        return query.state.data && hasCurrentAuctionResult(latestStatus, query.state.data.status) ? false : 15_000;
      return state.data ? 15_000 : interval;
    },
    refetchOnWindowFocus: true,
  });
  const currentStatus = reconcileAuctionStatus(state.data?.status, detail.data?.status);
  const terminal = isAuctionTerminal(currentStatus ?? "");
  // ENDED đóng SSE; REST/private polling vẫn chờ kết quả settlement và order.
  const stopStream = currentStatus === "ENDED" || terminal;
  const hasDetail = Boolean(detail.data);
  const serverNow = state.data ? Date.parse(state.data.serverTime) + Math.max(0, clock.monotonic - state.data.receivedAt) : clock.wall;
  const history = useApiQuery({
    queryKey: queryKeys.auctions.bids(auctionId, page),
    service: (signal) => getAuctionBids(auctionId, page, { signal }),
  }, {
    enabled: hasDetail && visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !terminal && !isAuctionReadUnavailable(query.state.error) ? interval : false,
  });
  const mine = useApiQuery({
    queryKey: queryKeys.auctions.mine(sessionId, auctionId),
    service: (signal) => getMyAuctionBid(auctionId, { context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, {
    enabled: authStatus === "authenticated" && hasDetail && visible,
    staleTime: 0,
    refetchInterval: (query) => getAuctionMineInterval({
      status: currentStatus, own: query.state.data, error: query.state.error,
      visible, now: serverNow,
    }),
  });

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["auctions", auctionId] }),
    client.invalidateQueries({ queryKey: queryKeys.auctions.mine(sessionId, auctionId), exact: true }),
  ]);

  useEffect(() => {
    const update = () => { setVisible(document.visibilityState !== "hidden"); setClock({ monotonic: performance.now(), wall: Date.now() }); };
    const timer = window.setInterval(() => setClock({ monotonic: performance.now(), wall: Date.now() }), 250);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); window.removeEventListener("pageshow", update); };
  }, []);

  useEffect(() => {
    if (!visible || stopStream || !hasDetail) return;
    let stream: EventSource;
    try { stream = openPublicAuctionStream(auctionId); } catch { return; }
    let disposed = false;
    let lastRefresh = -Infinity;
    let queued: number | undefined;
    let refreshDetail = false;
    const refreshSupporting = () => {
      queued = undefined;
      lastRefresh = performance.now();
      void client.invalidateQueries({ queryKey: ["auctions", auctionId, "bids"] });
      if (authStatus === "authenticated") void client.invalidateQueries({ queryKey: queryKeys.auctions.mine(sessionId, auctionId), exact: true });
      if (refreshDetail) void client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true });
      refreshDetail = false;
    };
    const scheduleSupporting = (needsDetail: boolean) => {
      refreshDetail ||= needsDetail;
      const delay = SUPPORTING_REFRESH_MS - (performance.now() - lastRefresh);
      if (delay <= 0) refreshSupporting();
      else if (queued === undefined) queued = window.setTimeout(refreshSupporting, delay);
    };
    const receiveState = (event: MessageEvent<string>) => {
      if (disposed) return;
      try {
        const receivedAt = performance.now();
        const incoming = parseAuctionState(JSON.parse(event.data), receivedAt, receivedAt);
        if (incoming.auctionId !== auctionId) return;
        const previous = client.getQueryData<AuctionState>(queryKeys.auctions.state(auctionId));
        const latest = selectLatestAuctionState(previous, incoming);
        // Malformed, foreign and old state events cannot keep a silent stream healthy.
        if (latest !== incoming) return;
        setHeartbeat({ source: stream, at: receivedAt });
        client.setQueryData<AuctionState>(queryKeys.auctions.state(auctionId), latest);
        if (auctionStateChanged(previous, latest))
          scheduleSupporting(!previous || previous.endAt !== latest.endAt || previous.status !== latest.status);
      } catch {
        // Invalid push data leaves the last verified snapshot and polling fallback intact.
      }
    };
    const markAlive = () => { if (!disposed) setHeartbeat({ source: stream, at: performance.now() }); };
    // Opening starts the grace window for the first heartbeat at 15 seconds.
    stream.onopen = markAlive;
    stream.onerror = () => { if (!disposed) setHeartbeat((current) => current?.source === stream ? null : current); };
    stream.addEventListener("state", receiveState);
    // The named transport heartbeat has no auction-data payload contract. Its
    // arrival renews liveness only; REST reconciliation and the countdown keep
    // their verified auction snapshot and monotonic server-clock anchor.
    stream.addEventListener("heartbeat", markAlive);
    // Keep this EventSource alive through errors/silence so native reconnect retains Last-Event-ID.
    return () => {
      disposed = true;
      stream.close();
      if (queued !== undefined) window.clearTimeout(queued);
    };
  }, [auctionId, authStatus, client, sessionId, visible, stopStream, hasDetail]);

  useEffect(() => {
    if (!visible || !hasDetail || !currentStatus || (currentStatus !== "ENDED" && !isAuctionTerminal(currentStatus))) return;
    // Refresh the final rows once. The private query owns subsequent settlement
    // retries, so waiting for the order never starts a second competing timer.
    void client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true });
    void client.invalidateQueries({ queryKey: ["auctions", auctionId, "bids"] });
    if (authStatus === "authenticated")
      void client.invalidateQueries({ queryKey: queryKeys.auctions.mine(sessionId, auctionId), exact: true });
  }, [auctionId, authStatus, client, currentStatus, hasDetail, sessionId, visible]);

  const stateEndAt = state.data?.endAt;
  useEffect(() => {
    if (stateEndAt && !connected && visible) void client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true });
  }, [auctionId, client, stateEndAt, connected, visible]);

  const auction = detail.data;
  const live = state.data;
  const endAt = auction && live ? Date.parse(auction.endAt) > Date.parse(live.endAt) ? auction.endAt : live.endAt : live?.endAt ?? auction?.endAt;
  const seconds = auction && endAt ? Math.max(0, Math.ceil(
    (live
      ? live.remainingMs + Date.parse(endAt) - Date.parse(live.endAt) - Math.max(0, clock.monotonic - live.receivedAt) -
        (["CREATED", "SCHEDULED"].includes(currentStatus ?? "") ? Date.parse(endAt) - Date.parse(auction.startAt) : 0)
      : Date.parse(["CREATED", "SCHEDULED"].includes(currentStatus ?? "") ? auction.startAt : endAt) - clock.wall) / 1000,
  )) : 0;
  return { detail, state, history, mine, page, setPage, refresh, seconds, serverNow, terminal,
    connected: connected && visible && !stopStream, status: currentStatus,
    currentPrice: live && (!auction || compareAuctionMoney(live.currentPrice, auction.currentPrice) >= 0) ? live.currentPrice : auction?.currentPrice,
    bidIncrement: live?.bidIncrement ?? auction?.bidIncrement,
    bidCount: Math.max(live?.bidCount ?? 0, auction?.bidCount ?? 0),
  };
}
