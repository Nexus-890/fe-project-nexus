import type { ReactNode } from "react";
import ShopLayout from "../../features/ShopLayout";

function AccountLayout({ children }: { children: ReactNode }) {
  return <ShopLayout>{children}</ShopLayout>;
}

export default AccountLayout;
