"use client";

import { useEffect, useRef, useState } from "react";
import { reputationRestrictionMessage } from "./reputationRestrictionMessage";
import { useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { parseAuctionBidMinimum, placeAuctionBid } from "../service/auctionService";
import { compareAuctionMoney } from "./auctionRoomUtils";
import { waitForAuctionBidResult } from "./auctionBidQueue";
import type { ApiError } from "../types/commonResponseType";

type BidAttempt = { amount: string; idempotencyKey: string; sessionId: number; signal: AbortSignal; bidId?: string };

/** Giữ một lần đặt bid xuyên suốt POST 202, chờ xử lý và retry bằng cùng khóa/bidId. */
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
    execute: async (variables: BidAttempt) => {
      const options = { context: requestContext, signal: variables.signal };
      if (!variables.bidId) {
        const receipt = await placeAuctionBid(auctionId, variables, options);
        // Đã biết bidId thì retry chỉ đọc lại kết quả, không tạo một yêu cầu bid khác.
        variables.bidId = receipt.bidId;
      }
      return waitForAuctionBidResult(auctionId, variables.bidId, options);
    },
    isCurrent: (variables) => isSessionCurrent(variables.sessionId),
  }, {
    onSuccess: async (result) => {
      attempt.current = null;
      if (result.status === "CANCELLED") {
        setUncertain(false); setSuccess(false); setError("Your previous bid was cancelled.");
        await refresh();
        return;
      }
      if (result.status === "REJECTED") {
        setUncertain(false); setSuccess(false);
        if (result.reason === "AUCTION_BID_TOO_LOW" && result.minimum !== null) {
          setServerMinimum(result.minimum); setAmount(null);
          setError(`Your bid was too low. The new minimum is ${result.minimum}.`);
        } else if (result.reason === "AUCTION_NOT_ACTIVE") setError("Bidding has closed for this auction.");
        else setError("Your bid was rejected. Check the auction state before trying again.");
        await refresh();
        return;
      }
      setUncertain(false); setSuccess(true); setError(null); setAmount(null); setServerMinimum(null);
      await refresh();
    },
    onError: (failure: ApiError, variables: BidAttempt) => {
      if (!isSessionCurrent(variables.sessionId)) return;
      if (failure.kind === "aborted" || (failure instanceof DOMException && failure.name === "AbortError")) return;
      // Lỗi đọc sau biên nhận không chứng minh bid thất bại, kể cả rate-limit/404 tạm thời.
      const unknownResult = Boolean(variables.bidId) || failure.kind === "network" || failure.kind === "invalid-response" || failure.status >= 500;
      setUncertain(unknownResult);
      setSuccess(false);
      if (unknownResult) {
        setError(failure.code === "AUCTION_BID_PENDING" ? "Your bid is still queued. Retry the same bid to check its result." : "The bid result is unknown. Retry the same bid safely.");
        return;
      }
      attempt.current = null;
      const nextMinimum = parseAuctionBidMinimum(failure);
      if (nextMinimum) {
        setServerMinimum(nextMinimum); setAmount(null);
        setError(`Your bid was too low. The new minimum is ${nextMinimum}.`);
      } else if (failure.code === "AUCTION_NOT_ACTIVE") setError("Bidding has closed for this auction.");
      else if (failure.code === "AUCTION_REPUTATION_RESTRICTED") setError(reputationRestrictionMessage(failure));
      else if (failure.code === "AUCTION_SELLER_CANNOT_BID") setError("You cannot bid on your own auction.");
      else if (failure.status === 401) setError("Your session expired. Sign in to place a bid.");
      else setError(failure.detail || "Your bid could not be placed. Please try again.");
      void refresh();
    },
  });

  // Cleanup ngắt POST/GET đang chạy và thời gian chờ khi rời phòng hoặc đổi phiên đăng nhập.
  useEffect(() => () => controller.current?.abort(), [auctionId, sessionId]);

  /** Chỉ tạo khóa mới khi yêu cầu trước đã có kết quả xác định hoặc chưa từng gửi. */
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
  /** Khóa số tiền trong lúc đang xử lý hoặc chưa biết kết quả để retry giữ đúng nội dung. */
  const changeAmount = (value: string) => { if (uncertain || mutation.isPending) return; setAmount(value); setError(null); setSuccess(false); };
  return { amount: displayAmount, minimum: effectiveMinimum, changeAmount, submit, error, success, uncertain, pending: mutation.isPending };
}
