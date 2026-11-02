"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getCategoryTree } from "@/service/catalogService";
import { getCart } from "@/service/cartService";
import { getCartQuantity } from "@/features/cartUtils";

function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut, requestContext, sessionId } = useAuth();
  const cart = useApiQuery({
    queryKey: queryKeys.cart.me(sessionId),
    service: (signal) => getCart({ context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: status === "authenticated" });
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
        cartQuantity={cart.data ? getCartQuantity(cart.data.items) : undefined}
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
