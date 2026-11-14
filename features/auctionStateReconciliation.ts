import type { AuctionState, AuctionStatus } from "../types/auctionRoomType";
import { compareAuctionMoney } from "./auctionRoomUtils";

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
  if (["FAILED", "CANCELLED", "SETTLED", "PAYMENT_TIMEOUT"].includes(current)) return current;
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
