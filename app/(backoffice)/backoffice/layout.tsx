import { Suspense, type ReactNode } from "react";
import BackofficeLayout from "@/features/BackofficeLayout";

function Layout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-8">Loading back office…</p>}><BackofficeLayout>{children}</BackofficeLayout></Suspense>;
}

export default Layout;
