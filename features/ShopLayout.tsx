"use client";

import { useState, type ReactNode } from "react";
import Header from "@/components/Header";
import NotificationBellFeature from "@/features/NotificationBellFeature";
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
  const [signOutError, setSignOutError] = useState(false);

  async function endSession() {
    setSignOutError(false);
    try {
      const result = await signOut();
      if (!result.ok) setSignOutError(true);
    } catch {
      setSignOutError(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={user}
        authenticating={status === "authenticating"}
        onSignOut={() => void endSession()}
        cartQuantity={cart.data ? getCartQuantity(cart.data.items) : undefined}
        categories={categories.data ?? []}
        categoriesLoading={categories.isPending}
        categoriesError={categories.isError}
        onRetryCategories={() => void categories.refetch()}
        notificationBell={
          status === "authenticated" ? (
            <NotificationBellFeature key={sessionId} />
          ) : null
        }
      />
      {signOutError ? (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-3 border-b border-danger/30 bg-red-100 px-4 py-3 text-sm text-danger">
          <span>Unable to finish signing out. Please try again.</span>
          <button type="button" onClick={() => void endSession()} className="min-h-11 font-medium underline">Retry sign out</button>
        </div>
      ) : null}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export default ShopLayout;
