"use client";

import Link from "next/link";
import { useState } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { getSellerPayouts, maskedBankAccount, payoutErrorMessage } from "../service/payoutService";
import { formatVND } from "../components/formatPrice";
import { SellerHeading, SellerPanel, SellerStatus, sellerButton } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";

const payoutDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function SellerPayoutsPage() {
  const auth = useAuth();
  const isSeller = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("SELLER");
  const [page, setPage] = useState(0);
  const result = useApiQuery({ queryKey: queryKeys.seller.payouts(auth.sessionId, page), meta: { requiresAuth: true },
    service: (signal) => getSellerPayouts(page, { context: auth.requestContext, signal }) }, { enabled: isSeller, retry: false });
  if (!isSeller) return <SellerPanel title="403 · Seller access required"><p className="text-sm text-muted-foreground">Payout history is available to the signed-in seller.</p></SellerPanel>;

  return <>
    <SellerHeading title="Payout history" description="Track payouts for your completed sales orders."><Link className={sellerButton} href="/backoffice/bank-accounts">Bank accounts</Link></SellerHeading>
    {result.isPending ? <p role="status">Loading payouts…</p> : result.error ? <SellerPanel title="Payout history unavailable"><p role="alert" className="text-sm text-danger">{payoutErrorMessage(result.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void result.refetch()}>Retry payouts</button></SellerPanel> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Your payout history</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Order", "Requested", "Bank account", "Amount", "Status", "Transfer reference"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-normal">{title}</th>)}</tr></thead><tbody>{result.data?.content.map((payout) => <tr key={payout.id} className="border-t border-border"><th scope="row" className="px-4 py-5 font-mono text-xs font-normal">{payout.orderNumber}</th><td className="px-4 py-5 text-xs text-muted-foreground"><time dateTime={payout.createdAt}>{payoutDate.format(new Date(payout.createdAt))}</time></td><td className="px-4 py-5 text-xs"><p>{payout.bankAccount.bankName}</p><p className="mt-1 font-mono text-muted-foreground">{maskedBankAccount(payout.bankAccount)}</p></td><td className="px-4 py-5 font-mono">{formatVND(payout.amount)}</td><td className="px-4 py-5"><SellerStatus>{payout.status}</SellerStatus>{payout.paidAt && <time className="mt-1 block text-xs text-muted-foreground" dateTime={payout.paidAt}>{payoutDate.format(new Date(payout.paidAt))}</time>}</td><td className="max-w-48 break-words px-4 py-5 font-mono text-xs">{payout.reference || "—"}</td></tr>)}</tbody></table>{!result.data?.content.length && <p role="status" className="p-10 text-center text-sm text-muted-foreground">No payouts yet. Completed orders become eligible after refund and payout checks.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data?.totalElements ?? 0} payouts</p><nav aria-label="Payout pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}

export default SellerPayoutsPage;
