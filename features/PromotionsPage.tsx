"use client";
import { useState } from "react";
import { sellerButton } from "../components/SellerUi";
import ManagedVouchers from "./ManagedVouchers";
import PromotionEvents from "./PromotionEvents";
import { readBackofficeRoles } from "./backofficeAccess";
import { useAuth } from "../hooks/useAuth";

function PromotionsPage({ eventsOnly = false }: { eventsOnly?: boolean }) {
  const [tab, setTab] = useState("events");
  const auth = useAuth(); const roles = readBackofficeRoles(auth.accessToken); const admin = roles.includes("ADMIN");
  if (!admin && !roles.includes("SELLER")) return null;
  return <>{eventsOnly ? <><nav aria-label="Promotion management" className="mb-6 flex gap-3"><button className={sellerButton} aria-pressed={tab === "events"} onClick={() => setTab("events")}>Sale events</button><button className={sellerButton} aria-pressed={tab === "vouchers"} onClick={() => setTab("vouchers")}>Platform / event vouchers</button></nav>{tab === "events" ? <PromotionEvents admin={admin} /> : <ManagedVouchers admin={admin} />}</> : <><ManagedVouchers admin={admin} />{!admin && <div className="border-t border-border pt-8"><PromotionEvents /></div>}</>}</>;
}
export default PromotionsPage;
