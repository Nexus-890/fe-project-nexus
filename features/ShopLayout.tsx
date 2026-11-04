"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { getCategoryTree } from "@/service/catalogService";

function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut } = useAuth();
  const cart = useCart();
  const categories = useApiQuery({
    queryKey: queryKeys.catalog.tree,
    service: (signal) => getCategoryTree({ signal }),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={user}
        authenticating={status === "authenticating"}
        onSignOut={signOut}
        cartCount={cart.data ? cart.count : undefined}
        categories={categories.data ?? []}
        categoriesLoading={categories.isPending}
        categoriesError={categories.isError}
        onRetryCategories={() => void categories.refetch()}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export default ShopLayout;
