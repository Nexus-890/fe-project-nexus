"use client";

import { useEffect, useRef, useState } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { createSellerPayout, getPayableOrders, maskedBankAccount, payoutErrorMessage } from "../service/payoutService";
import { formatVND } from "../components/formatPrice";
import { SellerHeading, SellerPanel, SellerStatus, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";
import type { CreatePayoutInput, PayableOrder, SellerBankAccount, SellerPayout } from "../types/payoutType";

type PayoutOperation = { body: CreatePayoutInput; key: string; sessionId: number; controller: AbortController };
type PayoutSelection = { order: PayableOrder; account: SellerBankAccount };

function AdminPayoutsPage() {
  const auth = useAuth();
  const isAdmin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [page, setPage] = useState(0);
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<PayoutSelection | null>(null);
  const [lastResult, setLastResult] = useState<SellerPayout | null>(null);
  const active = useRef<AbortController | null>(null);
  // Keep one captured key and payload per order during this page session. A
  // timed-out request may already have committed; retry that same operation.
  const [attempts, setAttempts] = useState<Record<string, { body: CreatePayoutInput; key: string }>>({});
  useEffect(() => () => active.current?.abort(), []);
  const result = useApiQuery({ queryKey: queryKeys.backoffice.payableOrders(auth.sessionId, page), meta: { requiresAuth: true },
    service: (signal) => getPayableOrders(page, { context: auth.requestContext, signal }) }, { enabled: isAdmin, retry: false });
  const mutation = useApiMutation<SellerPayout, PayoutOperation>({
    mutationKey: ["backoffice", auth.sessionId, "create-payout"],
    execute: ({ body, key, controller }) => createSellerPayout(body, key, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.backoffice.payableOrders(auth.sessionId), queryKeys.seller.payouts(auth.sessionId)],
  }, {
    onSuccess: (payout) => { setLastResult(payout); setSelection(null); },
    onSettled: (_data, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });

  if (!isAdmin) return <SellerPanel title="403 · Administrator access required"><p className="text-sm text-muted-foreground">Only administrators can create payouts.</p></SellerPanel>;

  return <>
    <SellerHeading title="Seller payouts" description="Review completed orders and pay verified seller bank accounts." />
    <p className="text-sm text-muted-foreground">Eligible orders are completed and have no payout or refund. Bank verification is managed by the payout service.</p>
    {lastResult && <SellerPanel><p role="status" className="text-sm text-success">Payout recorded for {lastResult.orderNumber}.</p><p className="mt-2 text-sm">{formatVND(lastResult.amount)} · {lastResult.bankAccount.bankName} {maskedBankAccount(lastResult.bankAccount)}</p><div className="mt-2"><SellerStatus>{lastResult.status}</SellerStatus></div></SellerPanel>}
    {selection && <SellerPanel title="Review payout"><p className="text-sm">Pay <strong>{formatVND(selection.order.totalAmount)}</strong> for <span className="font-mono">{selection.order.orderNumber}</span> to {selection.order.sellerName}.</p><p className="mt-3 text-sm">{selection.account.bankName} · <span className="font-mono">{maskedBankAccount(selection.account)}</span> · {selection.account.accountHolder}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={mutation.isPending || !selection.account.verified} className={sellerPrimary} onClick={() => {
      if (active.current || !selection.account.verified) return;
      let attempt = attempts[selection.order.orderId];
      if (!attempt) { attempt = { body: { orderId: selection.order.orderId, bankAccountId: selection.account.id }, key: crypto.randomUUID() }; setAttempts((current) => ({ ...current, [selection.order.orderId]: attempt })); }
      const controller = new AbortController(); active.current = controller;
      mutation.mutate({ ...attempt, sessionId: auth.sessionId, controller });
    }}>{mutation.isPending ? "Recording payout…" : mutation.isError ? "Retry same payout" : "Confirm payout"}</button><button type="button" disabled={mutation.isPending} className={sellerButton} onClick={() => { setSelection(null); mutation.reset(); }}>Cancel</button></div>{mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="mt-4 text-sm text-danger">{payoutErrorMessage(mutation.error)} Retry uses the same payout request.</p>}</SellerPanel>}
    {result.isPending ? <p role="status">Loading payable orders…</p> : result.error ? <SellerPanel title="Payable orders unavailable"><p role="alert" className="text-sm text-danger">{payoutErrorMessage(result.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void result.refetch()}>Retry payable orders</button></SellerPanel> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[780px] text-left text-sm"><caption className="sr-only">Completed orders eligible for payout</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Order", "Seller", "Amount", "Bank account", "Action"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-normal">{title}</th>)}</tr></thead><tbody>{result.data?.content.map((order) => {
        const attempt = attempts[order.orderId];
        const accountId = attempt?.body.bankAccountId || accountIds[order.orderId] || order.bankAccounts.find((account) => account.verified)?.id || order.bankAccounts[0]?.id || "";
        const account = order.bankAccounts.find((candidate) => candidate.id === accountId);
        return <tr key={order.orderId} className="border-t border-border"><th scope="row" className="px-4 py-5 font-mono text-xs font-normal">{order.orderNumber}<span className="mt-2 block font-sans text-success">Completed</span></th><td className="max-w-48 break-words px-4 py-5">{order.sellerName}</td><td className="px-4 py-5 font-mono">{formatVND(order.totalAmount)}</td><td className="px-4 py-5"><label className="sr-only" htmlFor={`bank-${order.orderId}`}>Bank account for {order.orderNumber}</label><select id={`bank-${order.orderId}`} className={`${sellerInput} max-w-72`} value={accountId} disabled={mutation.isPending || Boolean(attempt)} onChange={(event) => setAccountIds((current) => ({ ...current, [order.orderId]: event.target.value }))}>{!order.bankAccounts.length && <option value="">No bank account</option>}{order.bankAccounts.map((bank) => <option key={bank.id} value={bank.id}>{bank.bankName} {maskedBankAccount(bank)}{bank.verified ? " · Verified" : " · Unverified"}</option>)}</select>{!account?.verified && <p className="mt-2 text-xs text-warning">A verified bank account is required.</p>}</td><td className="px-4 py-5"><button type="button" className={sellerPrimary} disabled={!account?.verified || mutation.isPending || lastResult?.orderId === order.orderId} onClick={() => { if (account?.verified) { setSelection({ order, account }); mutation.reset(); } }}>Review payout</button></td></tr>;
      })}</tbody></table>{!result.data?.content.length && <p role="status" className="p-10 text-center text-sm text-muted-foreground">No completed orders are eligible for payout.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data?.totalElements ?? 0} payable orders</p><nav aria-label="Payable order pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}

export default AdminPayoutsPage;
