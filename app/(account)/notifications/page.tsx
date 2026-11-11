import { Suspense } from "react";
import NotificationsPage from "@/features/NotificationsPage";

function Page() {
  return <Suspense fallback={<p role="status">Loading notifications…</p>}><NotificationsPage /></Suspense>;
}

export default Page;
