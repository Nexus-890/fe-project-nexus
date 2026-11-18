import { formatVND } from "./formatPrice";
import { SellerStatus, sellerButton } from "./SellerUi";
import type { ManualPayoutSummary } from "../types/manualPayoutType";
import type { PayoutStatus } from "../types/payoutType";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
export const manualStatusLabel = (status: PayoutStatus) => status === "ON_HOLD" ? "On hold" : status.charAt(0) + status.slice(1).toLowerCase();
export const receiptLabel = (status: string | null) => status === null || status === "NOT_REQUESTED" ? "Not requested" : status === "AWAITING_CONFIRMATION" ? "Awaiting seller" : status === "CONFIRMED" ? "Seller confirmed" : "Seller disputed";

type Props = { rows: ManualPayoutSummary[]; selectedId: string | null; select: (id: string) => void };

function ManualPayoutTable({ rows, selectedId, select }: Props) {
  return <div className="overflow-x-auto rounded-sm border border-border">
    <table className="w-full min-w-[960px] text-left text-sm">
      <caption className="sr-only">Manual payout queue</caption>
      <thead className="bg-muted text-xs text-muted-foreground"><tr>{["Order / payout", "Seller", "Created", "Net amount", "Payout status", "Owner", "Seller receipt", "Review", "Details"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-normal">{title}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className={`border-t border-border ${selectedId === row.id ? "bg-secondary/40" : ""}`}>
        <th scope="row" className="px-4 py-4 font-mono text-xs font-normal"><span title={row.orderId}>Order {row.orderId.slice(0, 8)}</span><span title={row.id} className="mt-2 block text-muted-foreground">Payout {row.id.slice(0, 8)}</span></th>
        <td title={row.sellerId} className="px-4 py-4 font-mono text-xs">{row.sellerId.slice(0, 8)}</td>
        <td className="px-4 py-4 text-xs text-muted-foreground"><time dateTime={row.createdAt}>{date.format(new Date(row.createdAt))}</time></td>
        <td className="px-4 py-4 font-mono text-xs text-primary">{formatVND(row.netAmount)}</td>
        <td className="px-4 py-4"><SellerStatus>{manualStatusLabel(row.status)}</SellerStatus>{row.blockedReason && <p className="mt-2 max-w-56 text-xs text-warning">{row.blockedReason}</p>}</td>
        <td className="px-4 py-4 text-xs">{row.claimedByMe ? "You" : row.claimedBy ? <span title={row.claimedBy} className="font-mono">{row.claimedBy.slice(0, 8)}</span> : <span className="text-muted-foreground">Unclaimed</span>}</td>
        <td className="px-4 py-4 text-xs">{receiptLabel(row.receiptStatus)}</td>
        <td className="px-4 py-4 text-xs">{row.hasOpenDispute ? <span className="text-danger">Open seller case</span> : row.needsReview ? <span className="text-warning">Needs review</span> : <span className="text-muted-foreground">None</span>}</td>
        <td className="px-4 py-4"><button type="button" className={sellerButton} aria-expanded={selectedId === row.id} aria-label={`Open payout ${row.id.slice(0, 8)}`} onClick={() => select(row.id)}>Open payout</button></td>
      </tr>)}</tbody>
    </table>
    {!rows.length && <p role="status" className="p-10 text-center text-sm text-muted-foreground">No manual payouts match this view.</p>}
  </div>;
}

export default ManualPayoutTable;
