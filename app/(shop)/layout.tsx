import type { ReactNode } from "react";
import ShopLayout from "@/features/shop/ShopLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <ShopLayout>{children}</ShopLayout>;
}


