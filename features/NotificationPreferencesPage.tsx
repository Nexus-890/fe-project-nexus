"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Info, LockKeyhole } from "lucide-react";

const initialPreferences = [
  { id: "outbid", title: "Outbid alerts", description: "When someone places a higher bid", email: true, push: true },
  { id: "ending", title: "Auction ending soon", description: "5 minutes before auctions you bid on end", email: true, push: false },
  { id: "results", title: "Auction results", description: "Won, lost or cancelled auctions", email: true, push: true },
  { id: "watched", title: "Watched items", description: "Price drops and new auctions from sellers you follow", email: false, push: true },
  { id: "orders", title: "Order updates", description: "Confirmation, shipping and delivery", email: true, push: true, required: true },
  { id: "payments", title: "Payments & refunds", description: "Receipts, failed payments, refund status", email: true, push: true, required: true },
  { id: "promotions", title: "Promotions", description: "Deals and seasonal campaigns", email: false, push: false },
];
const button = "min-h-11 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";

function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const change = (id: string, channel: "email" | "push") => {
    setPreferences((current) => current.map((item) => item.id === id ? { ...item, [channel]: !item[channel] } : item));
    setSaved(false); setDirty(true);
  };
  return <section className="min-w-0 pb-12" aria-labelledby="preferences-title">
    <Link href="/notifications" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} aria-hidden="true" />Notifications</Link>
    <h1 id="preferences-title" className="text-heading-32">Notification Preferences</h1>
    <p className="mt-3 text-sm text-muted-foreground">Order and payment messages are always sent.</p>
    <p className="mt-5 rounded-sm border border-border bg-muted p-4 text-sm leading-6"><strong>Sample preview.</strong> Preferences API is not available. Changes apply only to this page and are not sent to the server.</p>
    {[{ title: "Auctions", items: preferences.slice(0, 4) }, { title: "Orders & Payments", items: preferences.slice(4) }].map((group) => <section key={group.title} className="mt-7" aria-label={group.title}>
      <h2 className="text-heading-20">{group.title}</h2>
      <div className="mt-4 rounded-sm border border-border">
        <div aria-hidden="true" className="hidden grid-cols-[1.1fr_2fr_100px_100px_80px] gap-4 border-b border-border bg-muted p-4 text-xs text-muted-foreground xl:grid"><span>Notification</span><span>Description</span><span>Email</span><span>Push</span><span>SMS</span></div>
        {group.items.map((item) => <div key={item.id} className="grid min-w-0 gap-3 border-b border-border p-4 last:border-0 xl:grid-cols-[1.1fr_2fr_100px_100px_80px] xl:items-center xl:gap-4">
          <h3 className="text-sm font-medium">{item.title}</h3><p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          <div className="flex gap-5 xl:contents">{(["email", "push"] as const).map((channel) => <div key={channel} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="xl:hidden">{channel === "email" ? "Email" : "Push"}</span>{item.required ? <span className="inline-flex items-center gap-1"><LockKeyhole size={13} aria-hidden="true" />Required</span> : <button type="button" role="switch" aria-checked={item[channel]} aria-label={`${item.title} ${channel}`} onClick={() => change(item.id, channel)} className={`relative h-6 w-10 shrink-0 rounded-full border border-border ${item[channel] ? "bg-primary" : "bg-secondary"}`}><span className={`absolute top-0.5 size-[18px] rounded-full bg-background shadow-sm ${item[channel] ? "right-0.5" : "left-0.5"}`} /></button>}</div>)}
            <span aria-label={`${item.title} SMS unavailable`} className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="xl:hidden">SMS</span><span aria-hidden="true" className="h-6 w-10 rounded-full bg-muted" /></span></div>
        </div>)}
      </div>
    </section>)}
    <div className="mt-6 flex gap-3 rounded-sm border border-border p-4 text-sm"><Info size={18} className="shrink-0" aria-hidden="true" /><div><p className="font-medium">SMS notifications aren’t available yet</p><p className="mt-2 leading-6 text-muted-foreground">Email and push cover all alerts in this design preview. SMS requires a future delivery integration.</p></div></div>
    {saved && <p role="status" className="mt-5 text-sm text-success">Preview preferences applied locally. Nothing was saved to the server.</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" className={button} onClick={() => { setPreferences(initialPreferences); setSaved(false); setDirty(false); }}>Reset to Defaults</button><button type="button" disabled={!dirty} className={`${button} border-primary bg-primary text-primary-foreground hover:bg-primary-hover`} onClick={() => { setSaved(true); setDirty(false); }}>Apply Preview Preferences</button></div>
  </section>;
}

export default NotificationPreferencesPage;
