"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import ShopLayout from "@/features/ShopLayout";
import AccountSidebar from "@/components/AccountSidebar";
import AccountFooter from "@/components/AccountFooter";

function AccountLayout({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();

  return (
    <ShopLayout>
      <div className="mx-auto grid w-full max-w-[1248px] min-w-0 gap-8 px-4 pt-6 sm:px-6 sm:pt-9 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
        <AccountSidebar user={user} loading={status === "authenticating"} />
        <div className="min-w-0">{children}</div>
      </div>
      <AccountFooter />
    </ShopLayout>
  );
}

export default AccountLayout;
