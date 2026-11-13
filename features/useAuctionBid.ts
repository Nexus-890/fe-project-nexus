"use client";

import { useEffect, useRef, useState } from "react";
import { useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { parseAuctionBidMinimum, placeAuctionBid } from "../service/auctionService";
import { compareAuctionMoney } from "./auctionRoomUtils";
import type { ApiError } from "../types/commonResponseType";

type BidAttempt = { amount: string; idempotencyKey: string; sessionId: number; signal: AbortSignal };

export function useAuctionBid(auctionId: string, minimum: string, refresh: () => Promise<unknown>) {
  const { requestContext, sessionId, isSessionCurrent } = useAuth();
  const [amount, setAmount] = useState<string | null>(null);
  const [serverMinimum, setServerMinimum] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<BidAttempt | null>(null);
  const controller = useRef<AbortController | null>(null);
  const effectiveMinimum = serverMinimum && compareAuctionMoney(serverMinimum, minimum) > 0 ? serverMinimum : minimum;
  const displayAmount = amount ?? effectiveMinimum;
  const mutation = useApiMutation({
    execute: (variables: BidAttempt) => placeAuctionBid(auctionId, variables, { context: requestContext, signal: variables.signal }),
    isCurrent: (variables) => isSessionCurrent(variables.sessionId),
  }, {
    onSuccess: async () => {
      attempt.current = null;
      setUncertain(false); setSuccess(true); setError(null); setAmount(null); setServerMinimum(null);
      await refresh();
    },
    onError: (failure: ApiError) => {
      if (failure.kind === "aborted" || (failure instanceof DOMException && failure.name === "AbortError")) return;
      const unknownResult = failure.kind === "network" || failure.kind === "invalid-response" || failure.status >= 500;
      setUncertain(unknownResult);
      setSuccess(false);
      if (unknownResult) {
        setError("The bid result is unknown. Retry the same bid safely.");
        return;
      }
      attempt.current = null;
      const nextMinimum = parseAuctionBidMinimum(failure);
      if (nextMinimum) {
        setServerMinimum(nextMinimum); setAmount(null);
        setError(`Your bid was too low. The new minimum is ${nextMinimum}.`);
      } else if (failure.code === "AUCTION_NOT_ACTIVE") setError("Bidding has closed for this auction.");
      else if (failure.code === "AUCTION_SELLER_CANNOT_BID") setError("You cannot bid on your own auction.");
      else if (failure.status === 401) setError("Your session expired. Sign in to place a bid.");
      else setError(failure.detail || "Your bid could not be placed. Please try again.");
      void refresh();
    },
  });

  useEffect(() => () => controller.current?.abort(), []);

  const submit = () => {
    if (mutation.isPending) return;
    setSuccess(false);
    if (!attempt.current) {
      const value = displayAmount.trim();
      if (!/^\d{1,17}(?:\.\d{1,2})?$/.test(value) || compareAuctionMoney(value, "0.00") <= 0) {
        setError("Enter a positive bid with up to 2 decimal places."); return;
      }
      if (compareAuctionMoney(value, effectiveMinimum) < 0) {
        setError(`Enter ${effectiveMinimum} or more.`); return;
      }
      const [whole, fraction = ""] = value.split(".");
      if (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")) > BigInt(Number.MAX_SAFE_INTEGER)) {
        setError("This amount is too large to submit safely."); return;
      }
      controller.current = new AbortController();
      attempt.current = { amount: value, idempotencyKey: crypto.randomUUID(), sessionId, signal: controller.current.signal };
    }
    setError(null);
    mutation.mutate(attempt.current);
  };
  const changeAmount = (value: string) => { if (uncertain || mutation.isPending) return; setAmount(value); setError(null); setSuccess(false); };
  return { amount: displayAmount, minimum: effectiveMinimum, changeAmount, submit, error, success, uncertain, pending: mutation.isPending };
}
