"use client";

import { useSearchParams } from "next/navigation";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getOrders, isOrderStatus } from "../service/orderService";
import { parsePage } from "./catalogUtils";
import type { OrderStatus } from "../types/orderResponseType";

export function useOrders() {
  const params = useSearchParams();
  const auth = useAuth();
  const value = params.get("status");
  const status = isOrderStatus(value) ? value : undefined;
  const page = parsePage(params.get("page") ?? undefined);
  const filters = { status, page: page - 1, size: 10 };
  const hrefFor = (nextStatus: OrderStatus | undefined, nextPage = 1) => {
    const query = new URLSearchParams();
    if (nextStatus) query.set("status", nextStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    if (params.get("payment") === "confirmed" && params.get("groupId")) {
      query.set("payment", "confirmed");
      query.set("groupId", params.get("groupId")!);
    }
    return query.size ? `/orders?${query}` : "/orders";
  };
  const orders = useApiQuery({
    queryKey: queryKeys.orders.list(auth.sessionId, filters),
    service: (signal) => getOrders(filters, { context: auth.requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated" });
  return { auth, orders, status, page, hrefFor, href: hrefFor(status, page) };
}
