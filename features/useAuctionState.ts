"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openPublicAuctionStream } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAuction, getAuctionBids, getAuctionState, getMyAuctionBid, parseAuctionState } from "../service/auctionService";
import { compareAuctionMoney, isAuctionTerminal } from "./auctionRoomUtils";
import { auctionStateChanged, hasCurrentAuctionResult, reconcileAuctionStatus, selectLatestAuctionState } from "./auctionStateReconciliation";
import type { ApiError } from "../types/commonResponseType";
import type { AuctionRoom, AuctionState, MyAuctionBid } from "../types/auctionRoomType";

const unavailable = (error: ApiError | null) => error?.kind === "invalid-response" ||
  (error?.kind === "http" && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status));
const HEARTBEAT_TIMEOUT_MS = 5000;
const SUPPORTING_REFRESH_MS = 2000;

/** Validated push snapshots update immediately; absent heartbeats restore two-second polling. */
export function useAuctionState(auctionId: string) {
  const { status: authStatus, sessionId, requestContext } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  const [heartbeat, setHeartbeat] = useState<{ source: EventSource; at: number } | null>(null);
  const [clock, setClock] = useState(() => ({ monotonic: performance.now(), wall: Date.now() }));
  const connected = Boolean(heartbeat && heartbeat.source.readyState === 1 &&
    clock.monotonic - heartbeat.at < HEARTBEAT_TIMEOUT_MS);
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
      client.getQueryData<AuctionRoom>(queryKeys.auctions.detail(auctionId))?.status) ?? "") && !unavailable(query.state.error) ? interval : false,
    refetchOnWindowFocus: true,
  });
  const detail = useApiQuery({
    queryKey: queryKeys.auctions.detail(auctionId),
    service: (signal) => getAuction(auctionId, { signal }),
  }, {
    staleTime: 0,
    // Rich detail and the private lookup reconcile more slowly to fit the gateway budget.
    refetchInterval: (query) => visible && !isAuctionTerminal(reconcileAuctionStatus(query.state.data?.status, state.data?.status) ?? "") && !unavailable(query.state.error)
      ? state.data ? 15_000 : interval : false,
    refetchOnWindowFocus: true,
  });
  const currentStatus = reconcileAuctionStatus(state.data?.status, detail.data?.status);
  const terminal = isAuctionTerminal(currentStatus ?? "");
  const hasDetail = Boolean(detail.data);
  const history = useApiQuery({
    queryKey: queryKeys.auctions.bids(auctionId, page),
    service: (signal) => getAuctionBids(auctionId, page, { signal }),
  }, {
    enabled: hasDetail && visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !terminal && !unavailable(query.state.error) ? interval : false,
  });
  const mine = useApiQuery({
    queryKey: queryKeys.auctions.mine(sessionId, auctionId),
    service: (signal) => getMyAuctionBid(auctionId, { context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, {
    enabled: authStatus === "authenticated" && hasDetail && visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !terminal && !unavailable(query.state.error) ? 15_000 : false,
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
    if (!visible || terminal || !hasDetail) return;
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
        // Neither an open connection nor malformed/old messages prove that live data still arrives.
        if (latest !== incoming) return;
        setHeartbeat({ source: stream, at: receivedAt });
        client.setQueryData<AuctionState>(queryKeys.auctions.state(auctionId), latest);
        if (auctionStateChanged(previous, latest))
          scheduleSupporting(!previous || previous.endAt !== latest.endAt || previous.status !== latest.status);
      } catch {
        // Invalid push data leaves the last verified snapshot and polling fallback intact.
      }
    };
    stream.onerror = () => setHeartbeat((current) => current?.source === stream ? null : current);
    stream.addEventListener("state", receiveState);
    // Keep this EventSource alive through errors/silence so native reconnect retains Last-Event-ID.
    return () => {
      disposed = true;
      stream.close();
      if (queued !== undefined) window.clearTimeout(queued);
    };
  }, [auctionId, authStatus, client, sessionId, visible, terminal, hasDetail]);

  useEffect(() => {
    if (!visible || !hasDetail || !currentStatus || (currentStatus !== "ENDED" && !isAuctionTerminal(currentStatus))) return;
    let disposed = false;
    let retry: number | undefined;
    let attempts = 0;
    const reconcileFinal = async () => {
      attempts += 1;
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true }),
        attempts === 1 ? client.invalidateQueries({ queryKey: ["auctions", auctionId, "bids"] }) : Promise.resolve(),
        authStatus === "authenticated" ? client.invalidateQueries({ queryKey: queryKeys.auctions.mine(sessionId, auctionId), exact: true }) : Promise.resolve(),
      ]);
      if (disposed || !isAuctionTerminal(currentStatus) || attempts >= 15) return;
      const snapshot = client.getQueryData<AuctionRoom>(queryKeys.auctions.detail(auctionId));
      const own = client.getQueryState<MyAuctionBid | null>(queryKeys.auctions.mine(sessionId, auctionId));
      const detailCurrent = snapshot && hasCurrentAuctionResult(currentStatus, snapshot.status);
      const ownCurrent = authStatus !== "authenticated" || (own?.status === "success" && (own.data === null || (own.data && hasCurrentAuctionResult(currentStatus, own.data.auctionStatus))));
      if (!detailCurrent || !ownCurrent) retry = window.setTimeout(() => void reconcileFinal(), 2000);
    };
    void reconcileFinal();
    return () => { disposed = true; if (retry !== undefined) window.clearTimeout(retry); };
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
  const serverNow = live ? Date.parse(live.serverTime) + Math.max(0, clock.monotonic - live.receivedAt) : clock.wall;
  return { detail, state, history, mine, page, setPage, refresh, seconds, serverNow, terminal,
    connected: connected && visible && !terminal, status: currentStatus,
    currentPrice: live && (!auction || compareAuctionMoney(live.currentPrice, auction.currentPrice) >= 0) ? live.currentPrice : auction?.currentPrice,
    bidIncrement: live?.bidIncrement ?? auction?.bidIncrement,
    bidCount: Math.max(live?.bidCount ?? 0, auction?.bidCount ?? 0),
  };
}
