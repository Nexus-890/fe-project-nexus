"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import ManagedVouchers from "./ManagedVouchers";
import PromotionEvents from "./PromotionEvents";
import { readBackofficeRoles, resolvePromotionWorkspace } from "./backofficeAccess";
import { useAuth } from "../hooks/useAuth";

function PromotionsPage({ eventsOnly = false }: { eventsOnly?: boolean }) {
  const [tab, setTab] = useState("events");
  const auth = useAuth(); const params = useSearchParams(); const roles = readBackofficeRoles(auth.accessToken);
  const workspace = resolvePromotionWorkspace(roles, eventsOnly ? null : params.get("view"));
  if (!workspace) return null;
  const admin = workspace === "admin"; const mixedRoles = roles.includes("ADMIN") && roles.includes("SELLER");
  if (eventsOnly) return <><nav aria-label="Promotion management" className="mb-6 flex gap-3"><button className={sellerButton} aria-pressed={tab === "events"} onClick={() => setTab("events")}>Sale events</button><button className={sellerButton} aria-pressed={tab === "vouchers"} onClick={() => setTab("vouchers")}>Platform / event vouchers</button></nav>{tab === "events" ? <PromotionEvents admin={admin} /> : <ManagedVouchers admin={admin} />}</>;
  return <>{mixedRoles && <nav aria-label="Voucher workspace" className="mb-6 flex flex-wrap gap-3"><Link href="/backoffice/vouchers" aria-current={admin ? "page" : undefined} className={admin ? sellerPrimary : sellerButton}>Manage vouchers</Link><Link href="/backoffice/vouchers?view=seller" aria-current={admin ? undefined : "page"} className={admin ? sellerButton : sellerPrimary}>My shop vouchers</Link></nav>}<Fragment key={workspace}><ManagedVouchers admin={admin} />{!admin && <div className="border-t border-border pt-8"><PromotionEvents /></div>}</Fragment></>;
}
export default PromotionsPage;
