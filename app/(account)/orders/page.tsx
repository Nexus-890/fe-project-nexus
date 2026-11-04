import { Suspense } from "react";
import OrdersPage from "../../../features/OrdersPage";

function Page() {
  return <Suspense fallback={<p role="status" className="p-8">Loading your orders…</p>}><OrdersPage /></Suspense>;
}

export default Page;
