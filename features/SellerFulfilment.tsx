"use client";

import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getSellerFulfilment, markSellerFulfilment } from "../service/sellerService";
import { SellerStatus, sellerButton, sellerPrimary } from "../components/SellerUi";
import { fulfilmentStage } from "./sellerFulfilmentStage";
import type { SellerFulfilmentStep } from "../types/sellerType";

function SellerFulfilment({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const auth = useAuth();
  const key = queryKeys.seller.fulfilment(auth.sessionId, orderId);
  const steps = useApiQuery({ queryKey: key, meta: { requiresAuth: true }, service: (signal) => getSellerFulfilment(orderId, { context: auth.requestContext, signal }) }, { retry: false });
  const mark = useApiMutation({
    execute: async (step: SellerFulfilmentStep) => {
      const open = (steps.data ?? []).filter((row) => row.status === "CONFIRMED" && (step === "pick" ? !row.pickedAt : !row.shippedAt));
      for (const row of open) await markSellerFulfilment(row.id, step, { context: auth.requestContext });
      return open.length;
    },
    invalidateKey: [key],
  });
  if (steps.isPending) return <p role="status" className="mt-2 text-xs text-muted-foreground">Checking stock…</p>;
  if (steps.error) return <div className="mt-2 grid justify-items-start gap-2"><p role="alert" className="text-xs text-danger">Unable to load picking status.</p><button type="button" className={sellerButton} onClick={() => void steps.refetch()}>Retry</button></div>;
  const stage = fulfilmentStage(steps.data);
  const busy = mark.isPending || steps.isFetching;
  return <div className="mt-2 grid justify-items-start gap-2">
    {stage === "none" && <p className="text-xs text-muted-foreground">No paid stock reserved</p>}
    {stage === "picked" && <SellerStatus>Picked</SellerStatus>}
    {stage === "packed" && <SellerStatus>Packed for carrier</SellerStatus>}
    {stage === "paid" && <button type="button" className={sellerPrimary} disabled={busy} aria-label={`Mark ${orderNumber} picked`} onClick={() => mark.mutate("pick")}>Mark picked</button>}
    {stage === "picked" && <button type="button" className={sellerPrimary} disabled={busy} aria-label={`Mark ${orderNumber} packed`} onClick={() => mark.mutate("ship")}>Mark packed</button>}
    {mark.error && <p role="alert" className="text-xs text-danger">{mark.error.detail || mark.error.title}</p>}
  </div>;
}

export default SellerFulfilment;
