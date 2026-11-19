"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { RevealPanel } from "../components/RevealPanel";
import { OperationsError, OperationsPagination, OperationsTable, OperationsTabs, OperationTime, operationCell as cell, referenceClass } from "../components/SupportOperationsUi";
import { SellerPanel, SellerStatus, sellerButton, sellerPrimary } from "../components/SellerUi";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { getOrderHistory, ORDER_STATUSES } from "../service/orderService";
import { changeManagedOrderStatus, getManagedOrders } from "../service/supportOperationsService";
import type { OrderDetail } from "../types/orderResponseType";
import type { ChangeOrderStatusInput, ManagedOrderFilters } from "../types/supportOperationsType";
import { readBackofficeRoles } from "./backofficeAccess";
import { sellerSalesDates } from "./sellerSalesFilters";
import { useAdminAction } from "./useAdminAction";

function OrderOperationsDetail({ order, close }: { order: OrderDetail; close: () => void }) {
  const auth = useAuth();
  const [status, setStatus] = useState<ChangeOrderStatusInput["status"]>(order.status);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const admin = readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const history = useApiQuery({ queryKey: queryKeys.orders.history(auth.sessionId, order.orderId), meta: { requiresAuth: true }, service: (signal) => getOrderHistory(order.orderId, { context: auth.requestContext, signal }) });
  const save = useAdminAction((body: ChangeOrderStatusInput, options) => changeManagedOrderStatus(order.orderId, body, options), [queryKeys.operations.root(auth.sessionId), queryKeys.orders.history(auth.sessionId, order.orderId), queryKeys.orders.detail(auth.sessionId, order.orderId)], (updated) => { setNotice(`Order status updated to ${updated.status}.`); setReason(""); });
  return <SellerPanel title={`Order ${order.orderNumber}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className={referenceClass}>{order.orderId}</p><button className={sellerButton} onClick={close}>Close order</button></div>
    <ul className="mt-4 space-y-2 text-sm">{order.items.map((item) => <li key={item.orderItemId}>{item.productName} · {item.skuCode} × {item.quantity}</li>)}</ul>
    <div className="mt-5 flex flex-wrap gap-3">{["payments", "refunds", "shipments"].map((section) => <Link key={section} className={sellerButton} href={`/backoffice/${section}?orderId=${order.orderId}`}>View {section}</Link>)}</div>
    {admin && <form className="mt-5 space-y-4 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); setNotice(""); save.run({ status, reason }); }}><h3 className="font-medium">Change order status</h3><fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">New order status<select className={adminInputClass} value={status} onChange={(event) => setStatus(event.target.value as ChangeOrderStatusInput["status"])}>{ORDER_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-2 text-xs">Status change reason<textarea className={adminInputClass} required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button type="submit" className={`${sellerPrimary} justify-self-start`}>{save.isPending ? "Saving…" : "Confirm status change"}</button></fieldset><OperationsError error={save.error} />{notice && <p role="status" className="text-sm text-success">{notice}</p>}</form>}
    <section aria-label="Order status history" className="mt-5 space-y-3 border-t border-border pt-5"><h3 className="font-medium">Status history</h3><OperationsError error={history.error} retry={() => void history.refetch()} />{history.isPending ? <p role="status">Loading history…</p> : history.data?.length ? <ol className="space-y-3">{history.data.map((step) => <li key={step.id} className="rounded-sm border border-border p-3 text-sm"><p>{step.previousStatus ? `${step.previousStatus} → ` : ""}{step.newStatus}</p><p className="mt-1 text-muted-foreground">{step.reason || "No reason recorded"}</p><p className="mt-1 text-xs text-muted-foreground"><OperationTime value={step.createdAt} /></p></li>)}</ol> : !history.error && <p className="text-sm text-muted-foreground">No history yet.</p>}</section>
  </SellerPanel>;
}

function SupportOrdersPage() {
  const auth = useAuth();
  const [filters, setFilters] = useState<ManagedOrderFilters>({ page: 0, size: 10 });
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [validation, setValidation] = useState("");
  const orders = useApiQuery({ queryKey: queryKeys.operations.list(auth.sessionId, "orders", filters), meta: { requiresAuth: true }, service: (signal) => getManagedOrders(filters, { context: auth.requestContext, signal }) });
  return <><AdminPageHeader title="Orders" description="All marketplace orders · investigate payments, refunds and delivery." /><OperationsTabs />
    <form className="grid gap-4 rounded-sm border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const range = sellerSalesDates(String(data.get("from")), String(data.get("to")));
      if (!range) { setValidation("Enter a valid date range."); return; } setValidation(""); setSelected(null);
      setFilters({ page: 0, size: 10, ...range, userId: String(data.get("buyer")).trim() || undefined, sellerId: String(data.get("seller")).trim() || undefined, status: String(data.get("status")) as ManagedOrderFilters["status"] || undefined, orderType: String(data.get("type")) as ManagedOrderFilters["orderType"] || undefined });
    }}>
      {[["buyer", "Buyer UUID"], ["seller", "Seller UUID"]].map(([name, label]) => <label key={name} className="grid gap-2 text-xs">{label}<input name={name} className={adminInputClass} placeholder="All" /></label>)}
      <label className="grid gap-2 text-xs">Order status<select name="status" className={adminInputClass}><option value="">All statuses</option>{ORDER_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="grid gap-2 text-xs">Order type<select name="type" className={adminInputClass}><option value="">All types</option><option>STANDARD</option><option>AUCTION</option></select></label>
      <label className="grid gap-2 text-xs">From date<input name="from" type="date" className={adminInputClass} /></label><label className="grid gap-2 text-xs">To date<input name="to" type="date" className={adminInputClass} /></label>
      <div className="flex flex-wrap items-end gap-2"><button className={sellerPrimary}>Apply order filters</button><button type="reset" className={sellerButton} onClick={() => { setFilters({ page: 0, size: 10 }); setSelected(null); setValidation(""); }}>Reset</button></div>
    </form>
    {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}<OperationsError error={orders.error} retry={() => void orders.refetch()} />
    {orders.isPending ? <p role="status">Loading orders…</p> : !orders.error && <><OperationsTable headers={["Order", "Buyer / seller", "Total", "Status", "Created", "Action"]} empty={!orders.data?.content.length}>{orders.data?.content.map((order) => <tr key={order.orderId} className="border-t border-border"><th scope="row" className={`${cell} text-xs font-medium`}>{order.orderNumber}<p className="mt-1 text-muted-foreground">{order.orderType}</p></th><td className={`${cell} ${referenceClass}`}><p title="Buyer">{order.userId}</p><p title="Seller" className="mt-2">{order.sellerId}</p></td><td className={`${cell} whitespace-nowrap font-mono text-xs`}>{formatVND(order.totalAmount)}</td><td className={cell}><SellerStatus>{order.status}</SellerStatus></td><td className={`${cell} text-xs`}><OperationTime value={order.createdAt} /></td><td className={cell}><button className={sellerButton} onClick={() => setSelected(order)}>Manage order</button></td></tr>)}</OperationsTable><OperationsPagination result={orders.data} change={(page) => setFilters({ ...filters, page })} /></>}
    {selected && <RevealPanel key={selected.orderId}><OrderOperationsDetail order={selected} close={() => setSelected(null)} /></RevealPanel>}
  </>;
}
export default SupportOrdersPage;
