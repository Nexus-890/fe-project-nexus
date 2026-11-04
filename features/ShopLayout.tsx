"use client";

import { useState, type ReactNode } from "react";
import Header from "@/components/Header";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getCategoryTree } from "@/service/catalogService";

function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut } = useAuth();
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
        categories={categories.data ?? []}
        categoriesLoading={categories.isPending}
        categoriesError={categories.isError}
        onRetryCategories={() => void categories.refetch()}
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
