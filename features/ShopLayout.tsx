"use client";

import { useState, type ReactNode } from "react";
import Header from "@/components/Header";
import NotificationBellFeature from "@/features/NotificationBellFeature";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";
import { getCategoryTree } from "@/service/catalogService";

function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut, sessionId } = useAuth();
  const cart = useGuestCart();
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
        authenticating={status === "authenticating" || status === "restoring"}
        restoring={status === "restoring"}
        onSignOut={() => void endSession()}
        cartQuantity={cart.ready && (status === "authenticated" || cart.guestEnabled) ? cart.itemCount : undefined}
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
      {cart.error ? (
        <p role="alert" className="border-b border-border bg-muted px-4 py-3 text-center text-sm">{cart.error}</p>
      ) : null}
      {cart.mergeError ? (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-3 border-b border-danger/30 bg-red-100 px-4 py-3 text-sm text-danger">
          <span>Your guest cart could not be merged. Your items are saved for another attempt.</span>
          <button type="button" onClick={() => void cart.retryMerge()} disabled={cart.loading} className="min-h-11 font-medium underline disabled:opacity-50">
            {cart.loading ? "Merging cart…" : "Retry merging cart"}
          </button>
        </div>
      ) : null}
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
