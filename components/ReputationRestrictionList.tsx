import type { ReputationRestriction } from "../types/ratingModerationType";

const displayTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function ReputationRestrictionList({ items, revoke }: { items: ReputationRestriction[]; revoke?: (item: ReputationRestriction) => void }) {
  if (!items.length) return <p role="status" className="py-4 text-sm text-muted-foreground">No action restrictions.</p>;
  return <ul className="divide-y divide-border">{items.map((item) => <li key={item.id} className="space-y-2 py-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{item.action === "BID" ? "Bidding" : "Selling / publishing listings"} · {item.active ? "Restricted" : item.revokedAt ? "Revoked" : "Expired"}</p>
      {item.active && revoke && <button type="button" onClick={() => revoke(item)} className="min-h-11 rounded-sm border border-border px-3 focus-visible:outline-2 focus-visible:outline-ring">Remove restriction</button>}</div>
    <p className="break-words">{item.reason}</p>
    <p className="text-xs text-muted-foreground">Until <time dateTime={item.restrictedUntil}>{displayTime(item.restrictedUntil)}</time> · your local time</p>
    {item.revocationReason && <p className="break-words text-xs text-muted-foreground">Removal reason: {item.revocationReason}</p>}
  </li>)}</ul>;
}

export default ReputationRestrictionList;
