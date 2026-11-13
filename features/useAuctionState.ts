"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openPublicAuctionStream } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAuction, getAuctionBids, getAuctionState, getMyAuctionBid } from "../service/auctionService";
import { compareAuctionMoney, isAuctionTerminal } from "./auctionRoomUtils";
import type { ApiError } from "../types/commonResponseType";

const unavailable = (error: ApiError | null) => error?.kind === "invalid-response" ||
  (error?.kind === "http" && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status));

/** A stream invalidates the authoritative reads; two-second polling survives disconnects. */
export function useAuctionState(auctionId: string) {
  const { status: authStatus, sessionId, requestContext } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  const [streamConnection, setStreamConnection] = useState<{ source: EventSource; connected: boolean } | null>(null);
  const connected = Boolean(streamConnection?.connected && streamConnection.source.readyState === 1);
  const [clock, setClock] = useState(() => ({ monotonic: performance.now(), wall: Date.now() }));
  const interval = connected ? 15_000 : 2000;
  const state = useApiQuery({
    queryKey: queryKeys.auctions.state(auctionId),
    service: (signal) => getAuctionState(auctionId, { signal }),
  }, {
    enabled: visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !isAuctionTerminal(query.state.data?.status ?? "") && !unavailable(query.state.error) ? interval : false,
    refetchOnWindowFocus: true,
  });
  const detail = useApiQuery({
    queryKey: queryKeys.auctions.detail(auctionId),
    service: (signal) => getAuction(auctionId, { signal }),
  }, {
    staleTime: 0,
    // State and history need the two-second cadence. The richer snapshot and
    // private lookup reconcile more slowly to stay within the gateway budget.
    refetchInterval: (query) => visible && !isAuctionTerminal(query.state.data?.status ?? "") && !unavailable(query.state.error) ? state.data ? 15_000 : interval : false,
    refetchOnWindowFocus: true,
  });
  const detailStatus = detail.data?.status;
  const stateStatus = state.data?.status;
  // Public projections may be cached for a second. A late ACTIVE projection
  // must not reopen bidding after an authoritative terminal snapshot.
  const currentStatus = isAuctionTerminal(detailStatus ?? "") ? detailStatus
    : isAuctionTerminal(stateStatus ?? "") ? stateStatus
      : detailStatus === "ENDED" || stateStatus === "ENDED" ? "ENDED"
        : state.data && state.dataUpdatedAt >= detail.dataUpdatedAt ? stateStatus : detailStatus;
  const terminal = isAuctionTerminal(currentStatus ?? "");
  const hasDetail = Boolean(detail.data);
  const history = useApiQuery({
    queryKey: queryKeys.auctions.bids(auctionId, page),
    service: (signal) => getAuctionBids(auctionId, page, { signal }),
  }, {
    enabled: Boolean(detail.data) && visible,
    staleTime: 0,
    refetchInterval: (query) => visible && !terminal && !unavailable(query.state.error) ? interval : false,
  });
  const mine = useApiQuery({
    queryKey: queryKeys.auctions.mine(sessionId, auctionId),
    service: (signal) => getMyAuctionBid(auctionId, { context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, {
    enabled: authStatus === "authenticated" && Boolean(detail.data) && visible,
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
    let lastRefresh = -Infinity;
    let queued: number | undefined;
    const refreshEvents = () => {
      if (queued !== undefined) { window.clearTimeout(queued); queued = undefined; }
      lastRefresh = performance.now();
      void client.invalidateQueries({ queryKey: queryKeys.auctions.state(auctionId), exact: true });
      void client.invalidateQueries({ queryKey: ["auctions", auctionId, "bids"] });
    };
    const invalidate = () => {
      const delay = 2000 - (performance.now() - lastRefresh);
      if (delay > 0) {
        if (queued === undefined) queued = window.setTimeout(() => { queued = undefined; refreshEvents(); }, delay);
      } else refreshEvents();
    };
    stream.onopen = () => { setStreamConnection({ source: stream, connected: true }); invalidate(); };
    stream.onerror = () => setStreamConnection({ source: stream, connected: false });
    stream.onmessage = invalidate;
    // Event names remain provisional until #253 delivers its SSE contract.
    for (const name of ["auction-state", "bid-placed", "auction-ended", "auction-extended"]) stream.addEventListener(name, invalidate);
    return () => { stream.close(); if (queued !== undefined) window.clearTimeout(queued); };
  }, [auctionId, client, sessionId, visible, terminal, hasDetail]);

  useEffect(() => {
    if (!currentStatus) return;
    // A terminal snapshot can arrive just before the history/mine interval.
    // Fetch the final rows once even though terminal states stop the timers.
    void client.invalidateQueries({ queryKey: ["auctions", auctionId, "bids"] });
    void client.invalidateQueries({ queryKey: queryKeys.auctions.mine(sessionId, auctionId), exact: true });
    if (isAuctionTerminal(currentStatus) || currentStatus === "ENDED")
      void client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true });
  }, [auctionId, client, currentStatus, sessionId]);

  const stateEndAt = state.data?.endAt;
  useEffect(() => {
    if (stateEndAt) void client.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId), exact: true });
  }, [auctionId, client, stateEndAt]);

  // Prefer whichever authoritative read completed most recently. Never use an
  // idempotent POST replay as the current market price.
  const live = state.data && state.dataUpdatedAt >= detail.dataUpdatedAt ? state.data : undefined;
  const auction = detail.data;
  const endAt = auction && state.data && ["ACTIVE", "ENDED"].includes(currentStatus ?? "")
    ? Date.parse(auction.endAt) > Date.parse(state.data.endAt) ? auction.endAt : state.data.endAt
    : live?.endAt ?? auction?.endAt;
  const seconds = auction && endAt ? Math.max(0, Math.ceil(
    (state.data
      ? state.data.remainingMs + Date.parse(endAt) - Date.parse(state.data.endAt) - Math.max(0, clock.monotonic - state.data.receivedAt) -
        (["CREATED", "SCHEDULED"].includes(currentStatus ?? "") ? Date.parse(endAt) - Date.parse(auction.startAt) : 0)
      : Date.parse(["CREATED", "SCHEDULED"].includes(currentStatus ?? "") ? auction.startAt : endAt) - clock.wall) / 1000,
  )) : 0;
  const serverNow = state.data ? Date.parse(state.data.serverTime) + Math.max(0, clock.monotonic - state.data.receivedAt) : clock.wall;
  return { detail, state, history, mine, page, setPage, refresh, seconds, serverNow, terminal,
    connected: connected && visible && !terminal, status: currentStatus,
    currentPrice: state.data && auction && compareAuctionMoney(state.data.currentPrice, auction.currentPrice) > 0 ? state.data.currentPrice : auction?.currentPrice,
    bidIncrement: live?.bidIncrement ?? auction?.bidIncrement,
    bidCount: Math.max(state.data?.bidCount ?? 0, auction?.bidCount ?? 0),
  };
}
