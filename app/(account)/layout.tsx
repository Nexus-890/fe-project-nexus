import type { ReactNode } from "react";
import AccountLayout from "@/features/AccountLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <AccountLayout>{children}</AccountLayout>;
}
