import type { ReactNode } from "react";
import ShopLayout from "@/features/ShopLayout";

function Layout({ children }: { children: ReactNode }) {
  return <ShopLayout>{children}</ShopLayout>;
}

export default Layout;
