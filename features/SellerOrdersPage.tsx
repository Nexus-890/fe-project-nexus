"use client";

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { queryKeys } from "../configs/queryKeys";
import { getSellerSales } from "../service/sellerService";
import { formatVND } from "../components/formatPrice";
import { SellerError, SellerHeading, SellerStatus, SellerTabs, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { sellerSalesDates } from "./sellerSalesFilters";

const statuses: Record<string, string | undefined> = { "All": undefined, "To Ship": "PAID", "Shipping": "SHIPPED", "Delivered": "DELIVERED", "Completed": "COMPLETED", "Cancelled": "CANCELED", "Refunds": "REFUND_REQUESTED", "Refunded": "REFUNDED", "Awaiting Payment": "PENDING" };
const saleDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function SellerOrdersPage({ title = "Sales" }: { title?: string }) {
  const auth = useAuth();
  const [tab, setTab] = useState("To Ship");
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dates, setDates] = useState<{ from?: string; to?: string }>({});
  const [dateError, setDateError] = useState("");
  const result = useApiQuery({ queryKey: queryKeys.seller.sales(auth.sessionId, page, statuses[tab], dates.from, dates.to), meta: { requiresAuth: true }, service: (signal) => getSellerSales(page, statuses[tab], { context: auth.requestContext, signal }, dates) }, { retry: false });
  const rows = result.data?.content ?? [];
  return <>
    <SellerHeading title={title} description="Review your own customer orders and their payment status." />
    <SellerTabs values={Object.keys(statuses)} selected={tab} change={(value) => { setTab(value); setPage(0); }} />
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault();
      const range = sellerSalesDates(from, to);
      if (!range) { setDateError("Enter valid dates with the start on or before the end."); return; }
      setDateError(""); setDates(range); setPage(0);
    }}>
      <label className="grid gap-2 text-xs">From date<input type="date" aria-describedby="sales-date-help" className={sellerInput} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="grid gap-2 text-xs">To date<input type="date" aria-describedby="sales-date-help" className={sellerInput} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <button className={sellerPrimary} type="submit">Apply filters</button>
      <button className={sellerButton} type="button" onClick={() => { setFrom(""); setTo(""); setDates({}); setDateError(""); setPage(0); }}>Clear dates</button>
      <p id="sales-date-help" className="basis-full text-xs text-muted-foreground">Order date · Vietnam time (UTC+7), including both selected days.</p>
      {dateError && <p role="alert" className="basis-full text-sm text-danger">{dateError}</p>}
    </form>
    <p className="text-xs text-muted-foreground">Buyer contact details come from the order’s shipping snapshot. Older orders without a name show a short buyer reference.</p>
    {result.isPending ? <p role="status">Loading seller orders…</p> : result.error ? <SellerError error={result.error} retry={() => void result.refetch()} /> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[820px] text-left text-sm"><caption className="sr-only">Seller orders</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Order", "Date", "Buyer", "Items", "Total", "Payment / status"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-normal">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.orderId} className="border-t border-border"><th scope="row" className="break-words px-4 py-5 font-mono text-xs font-normal">{row.orderNumber}</th><td className="px-4 py-5 text-xs text-muted-foreground"><time dateTime={row.createdAt}>{saleDate.format(new Date(row.createdAt))}</time></td><td className="max-w-40 break-words px-4 py-5 text-xs"><span title={row.buyerId}>{row.recipientName || row.buyerId.slice(0, 8)}</span>{row.phoneNumber && <span className="mt-1 block text-muted-foreground">{row.phoneNumber}</span>}</td><td className="max-w-64 px-4 py-5 text-xs"><ul className="space-y-3">{row.saleItems.map((item) => <li key={item.id}><p className="break-words">{item.name}</p><p className="mt-1 break-words text-muted-foreground">{item.skuCode} · Qty {item.quantity}</p></li>)}</ul></td><td className="px-4 py-5 font-mono">{formatVND(row.totalAmount)}</td><td className="px-4 py-5"><SellerStatus>{row.status === "PAID" ? "Paid" : row.status}</SellerStatus></td></tr>)}</tbody></table>{!rows.length && <p role="status" className="p-10 text-center text-muted-foreground">No orders with this status.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p>Page {page + 1} · {result.data?.totalElements ?? 0} orders</p><nav aria-label="Seller order pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}
export default SellerOrdersPage;
