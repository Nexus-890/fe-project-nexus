"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import RatingDialog from "../components/RatingDialog";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { createRating, getOrderRating } from "../service/ratingService";
import type { CreateRatingRequest, Rating } from "../types/ratingType";
import type { OrderDetail } from "../types/orderResponseType";

type RatingOrder = Pick<OrderDetail, "orderId" | "orderNumber" | "sellerId" | "status" | "userId">;

function CompletedOrderRating({ order }: { order: RatingOrder }) {
  const auth = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const buyerId = auth.user?.id ?? "";
  const sellerId = order.sellerId ?? "";
  const canRate = !!buyerId && buyerId.toLowerCase() === order.userId.toLowerCase() &&
    !!sellerId && sellerId.toLowerCase() !== buyerId.toLowerCase();
  const key = queryKeys.reputation.orderRating(auth.sessionId, sellerId, buyerId, order.orderId);
  const own = useApiQuery({
    queryKey: key, meta: { requiresAuth: true },
    service: (signal) => getOrderRating(sellerId, buyerId, order.orderId, { context: auth.requestContext, signal }),
  }, { enabled: canRate, retry: false });
  const mutation = useApiMutation<Rating, { body: CreateRatingRequest; sessionId: number }>({
    mutationKey: ["rating", auth.sessionId, "create", order.orderId],
    isCurrent: ({ sessionId }) => auth.isSessionCurrent(sessionId),
    execute: ({ body }) => createRating(body, buyerId, { context: auth.requestContext }),
    invalidateKey: [queryKeys.reputation.seller(auth.sessionId, sellerId)],
  }, {
    onSuccess: (rating) => {
      client.setQueryData(key, rating);
      setOpen(false);
    },
    onError: async (error, { sessionId }) => {
      // Another tab may have rated this order. Re-read; a conflict by itself does not prove a rating exists.
      if (error.status === 409 && auth.isSessionCurrent(sessionId)) {
        const result = await own.refetch();
        if (auth.isSessionCurrent(sessionId) && result.data) setOpen(false);
      }
    },
  });

  if (!canRate) return <p className="mt-4 text-sm text-muted-foreground">Seller rating is unavailable for this order.</p>;
  if (own.isPending) return <p role="status" className="mt-4 text-sm text-muted-foreground">Checking your rating…</p>;
  if (own.isError) return <div className="mt-4 text-sm"><p role="alert" className="text-muted-foreground">Unable to check your rating. {own.error.detail || own.error.title}</p><button type="button" disabled={own.isFetching} onClick={() => void own.refetch()} className="mt-2 min-h-11 rounded-sm border border-border px-4 hover:bg-muted">Retry rating</button></div>;
  if (own.data) return <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><Star size={16} aria-hidden="true" />{mutation.isSuccess ? "Your rating was submitted. " : ""}You rated this seller {own.data.score} out of 5.</p>;
  return <div className="mt-4">
    <button type="button" aria-haspopup="dialog" onClick={() => { mutation.reset(); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-5 text-sm font-medium hover:bg-muted"><Star size={16} aria-hidden="true" />Rate the seller</button>
    {open && <RatingDialog orderNumber={order.orderNumber} pending={mutation.isPending} error={mutation.error} onClose={() => { if (!mutation.isPending) setOpen(false); }} onSubmit={(score, comment) => { if (!mutation.isPending) mutation.mutate({ body: { orderId: order.orderId, toUserId: sellerId, score, comment }, sessionId: auth.sessionId }); }} />}
  </div>;
}

function OrderRating({ order }: { order: RatingOrder }) {
  const auth = useAuth();
  if (order.status !== "COMPLETED" || auth.status !== "authenticated") return null;
  return <CompletedOrderRating key={`${auth.sessionId}:${order.orderId}`} order={order} />;
}

export default OrderRating;
