"use client";
import type { ReactNode } from "react";
import Header from "@/ui/components/templates/Header";
import { useAuth } from "@/hooks/auth/useAuth";
import { useCategoryTree } from "@/hooks/catalog/useCategoryTree";
import { useCart } from "@/hooks/cart/useCart";

export default function ShopLayout({ children }: { children: ReactNode }) {
  const { user, status, signOut } = useAuth();
  const categories = useCategoryTree();
  const cart = useCart();

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        cartCount={status === "authenticated" && cart.data ? cart.count : undefined}
        user={user}
        authenticating={status === "authenticating"}
        onSignOut={signOut}
        categories={categories.data ?? []}
        categoriesLoading={categories.isPending}
        categoriesError={categories.isError}
        onRetryCategories={() => void categories.refetch()}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
