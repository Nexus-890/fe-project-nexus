"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";
import NotificationBellFeature from "@/features/NotificationBellFeature";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getCategoryTree } from "@/service/catalogService";

function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut, sessionId } = useAuth();
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
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export default ShopLayout;
