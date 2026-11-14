import { sumCartMoney } from "./cartUtils";

export const isAuctionTerminal = (status: string) =>
  ["WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"].includes(status);

export const getAuctionMinimum = (currentPrice: string, increment: string) =>
  sumCartMoney([currentPrice, increment]);

export const compareAuctionMoney = (left: string, right: string) => {
  const cents = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  };
  const a = cents(left), b = cents(right);
  return a < b ? -1 : a > b ? 1 : 0;
};

export const formatAuctionMoney = (amount: string, currency: string) => {
  const [integer, decimals = "00"] = amount.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (currency === "USD") return `$${grouped}.${decimals.padEnd(2, "0")}`;
  if (currency === "VND") return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimals !== "00" ? `,${decimals}` : ""} ₫`;
  return `${grouped}.${decimals.padEnd(2, "0")} ${currency}`;
};

export const formatAuctionCountdown = (seconds: number) => {
  const value = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(value / 3600);
  return [hours, Math.floor(value % 3600 / 60), value % 60].map((part) => String(part).padStart(2, "0")).join(":");
};

export const formatBidAge = (placedAt: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`;
};
