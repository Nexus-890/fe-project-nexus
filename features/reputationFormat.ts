import type { Penalty, TrustLevel } from "../types/ratingType";

export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  NEW: "New", BASIC: "Standard", TRUSTED: "Trusted", TOP: "Top Seller",
};

export const REPUTATION_LEVELS = [
  { label: "Standard", score: 0 },
  { label: "Trusted", score: 60 },
  { label: "Top Seller", score: 80 },
] as const;

export const PENALTY_LABELS: Record<Penalty["changeType"], string> = {
  USER_RATED: "Low rating",
  ORDER_COMPLETED: "Order outcome",
  AUCTION_PAYMENT_TIMEOUT: "Unpaid auction",
  ADMIN_ADJUSTMENT: "Admin deduction",
};

export const PENALTY_REFERENCE_LABELS: Record<Penalty["changeType"], string> = {
  USER_RATED: "Rating",
  ORDER_COMPLETED: "Order",
  AUCTION_PAYMENT_TIMEOUT: "Auction",
  ADMIN_ADJUSTMENT: "Admin",
};

export const penaltyReference = (penalty: Pick<Penalty, "changeType" | "sourceId">): string =>
  penalty.sourceId ? `${PENALTY_REFERENCE_LABELS[penalty.changeType]} ${penalty.sourceId.slice(0, 8).toUpperCase()}` : "—";

export const penaltyImpact = (penalty: Pick<Penalty, "delta" | "previousScore" | "newScore">): string =>
  `${penalty.delta} (${penalty.previousScore} → ${penalty.newScore})`;

export const averageRatingText = (value: number | null): string => value === null ? "—" : value.toFixed(1);

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
export const penaltyDate = (iso: string): string => dateFormat.format(new Date(iso));
