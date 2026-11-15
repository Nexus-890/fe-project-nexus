import type { AuctionState, AuctionStatus } from "../types/auctionRoomType";
import type { ApiError } from "../types/commonResponseType";
import { compareAuctionMoney } from "./auctionRoomUtils";

/** #253 sends a transport heartbeat every 15 seconds; allow two missed beats. */
export const AUCTION_STREAM_SILENCE_MS = 30_000;

export const isAuctionStreamHealthy = (lastActivityAt: number | null, now: number, readyState: number) =>
  readyState === 1 && lastActivityAt !== null && Number.isFinite(lastActivityAt) && lastActivityAt >= 0 &&
  Number.isFinite(now) && now >= 0 && Math.max(0, now - lastActivityAt) < AUCTION_STREAM_SILENCE_MS;

const statusStage: Record<AuctionStatus, number> = {
  CREATED: 0, SCHEDULED: 1, ACTIVE: 2, ENDED: 3,
  WON: 4, FAILED: 4, CANCELLED: 4, SETTLED: 5, PAYMENT_TIMEOUT: 5,
};

/** The settlement result cannot reopen bidding when a cached projection arrives late. */
export const reconcileAuctionStatus = (
  current: AuctionStatus | undefined, incoming: AuctionStatus | undefined,
): AuctionStatus | undefined => {
  if (!current) return incoming;
  if (!incoming || current === incoming) return current;
  if (["FAILED", "CANCELLED", "PAYMENT_TIMEOUT"].includes(current)) return current;
  if (current === "SETTLED") return incoming === "PAYMENT_TIMEOUT" ? incoming : current;
  if (current === "WON" && incoming !== "SETTLED" && incoming !== "PAYMENT_TIMEOUT") return current;
  return statusStage[incoming] >= statusStage[current] ? incoming : current;
};

/** Both REST completions and push updates pass through the same monotonic snapshot rule. */
export const selectLatestAuctionState = (
  current: AuctionState | undefined, incoming: AuctionState,
): AuctionState => {
  if (!current) return incoming;
  if (incoming.auctionId !== current.auctionId ||
    Date.parse(incoming.serverTime) < Date.parse(current.serverTime) ||
    incoming.bidCount < current.bidCount ||
    compareAuctionMoney(incoming.currentPrice, current.currentPrice) < 0 ||
    Date.parse(incoming.endAt) < Date.parse(current.endAt) ||
    reconcileAuctionStatus(current.status, incoming.status) !== incoming.status)
    return current;
  if (Date.parse(incoming.serverTime) === Date.parse(current.serverTime) && !auctionStateChanged(current, incoming))
    return current;
  return incoming;
};

/** Heartbeat clock changes update the UI without causing supporting REST reads. */
export const auctionStateChanged = (current: AuctionState | undefined, incoming: AuctionState) =>
  !current || current.bidCount !== incoming.bidCount || current.currentPrice !== incoming.currentPrice ||
  current.endAt !== incoming.endAt || current.status !== incoming.status;

export const hasCurrentAuctionResult = (status: AuctionStatus, ownStatus: AuctionStatus) =>
  reconcileAuctionStatus(status, ownStatus) === ownStatus;

export const isAuctionReadUnavailable = (error: ApiError | null) => error?.kind === "invalid-response" ||
  (error?.kind === "http" && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status));

type OwnSettlement = {
  auctionStatus: AuctionStatus;
  won: boolean;
  orderId?: string | null;
  paymentDueAt?: string | null;
};

/** The winner's private projection can lag the public result while #172 creates the order. */
export const getAuctionMineInterval = ({ status, own, error, visible, now }: {
  status: AuctionStatus | undefined;
  own: OwnSettlement | null | undefined;
  error: ApiError | null;
  visible: boolean;
  now: number;
}): number | false => {
  if (!visible || isAuctionReadUnavailable(error)) return false;
  const latestStatus = reconcileAuctionStatus(status, own?.auctionStatus);
  if (latestStatus === "PAYMENT_TIMEOUT") return false;
  const terminal = Boolean(latestStatus && ["WON", "SETTLED", "FAILED", "CANCELLED"].includes(latestStatus));
  if (!terminal) return 15_000;
  if (own === undefined) return 2000;
  if (own === null) return false;
  if (own.paymentDueAt && Date.parse(own.paymentDueAt) <= now) return false;
  if (latestStatus && !hasCurrentAuctionResult(latestStatus, own.auctionStatus)) return 2000;
  return own.won && !own.orderId ? 2000 : false;
};
