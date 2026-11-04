"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { isApiError } from "@/configs/api";
import type { CartItem } from "@/types/cartResponseType";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
import CartSellerCard from "@/components/CartSellerCard";
import CartSkeleton from "@/components/CartSkeleton";
import CartSummary from "@/components/CartSummary";

function groupBySeller(items: CartItem[]) {
  const groups = new Map<string, { name: string; hasSeller: boolean; items: CartItem[] }>();
  for (const item of items) {
    const key = item.sellerId || item.sellerName || "__cart";
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, {
      name: item.sellerName || "Your items",
      hasSeller: Boolean(item.sellerId || item.sellerName),
      items: [item],
    });
  }
  return Array.from(groups, ([id, group]) => ({ id, ...group }));
}

function ShoppingCartPage() {
  const { status, retryProfile, sessionId, isSessionCurrent } = useAuth();
  const cart = useCart();
  const [mutationFailure, setMutationFailure] = useState<{ sessionId: number; text: string } | null>(null);
  const mutationError = mutationFailure?.sessionId === sessionId ? mutationFailure.text : null;

  const handleMutation = async (action: () => Promise<unknown>) => {
    setMutationFailure(null);
    try {
      await action();
    } catch (error: unknown) {
      if (!isSessionCurrent(sessionId) || (isApiError(error) && error.kind === "aborted")) return;
      setMutationFailure({ sessionId, text: isApiError(error)
        ? error.detail || error.title
        : "Unable to update your cart. Please try again." });
    }
  };

  if (status === "authenticating") return <CartSkeleton />;

  if (status === "anonymous") return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-9">
      <h1 className="mb-6 text-heading-32">Cart</h1>
      <Card><CardContent className="flex flex-col items-center gap-3 py-7 text-center">
        <ShoppingCart className="mb-1 size-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-heading-20">Sign in to view your cart</h2>
        <p className="text-sm text-muted-foreground">Your cart items will be here when you sign in.</p>
        <Link href="/sign-in?returnTo=%2Fcart" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Sign in</Link>
      </CardContent></Card>
    </div>
  );

  if (status === "error") return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-9">
      <h1 className="mb-6 text-heading-32">Cart</h1>
      <Card><CardContent className="space-y-4" role="alert">
        <AlertCircle className="size-6 text-danger" aria-hidden="true" />
        <h2 className="text-heading-20">Unable to load your account</h2>
        <p className="text-sm text-muted-foreground">Please try again to view your cart.</p>
        <Button variant="outline" className="min-h-11 px-4" onClick={() => void retryProfile()}>Try again</Button>
      </CardContent></Card>
    </div>
  );

  if (cart.isPending) return <CartSkeleton />;

  if (!cart.data) return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-9">
      <h1 className="mb-6 text-heading-32">Cart</h1>
      <Card><CardContent className="space-y-4" role="alert">
        <AlertCircle className="size-6 text-danger" aria-hidden="true" />
        <h2 className="text-heading-20">Unable to load your cart</h2>
        <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
        <Button variant="outline" className="min-h-11 px-4" disabled={cart.isFetching} onClick={() => void cart.refetch()}>{cart.isFetching ? "Loading…" : "Try again"}</Button>
      </CardContent></Card>
    </div>
  );

  const groups = groupBySeller(cart.data.items);
  const itemLabel = `${cart.count} ${cart.count === 1 ? "item" : "items"}`;
  const sellerLabel = groups.length > 0 && groups.every((group) => group.hasSeller)
    ? ` from ${groups.length} ${groups.length === 1 ? "seller" : "sellers"}`
    : "";
  const updating = cart.updateItem.isPending || cart.removeItem.isPending;

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-8 pb-12 sm:px-6 lg:pt-9 lg:pb-16">
      <div className="mb-6 space-y-1">
        <h1 className="text-heading-32">Cart</h1>
        <p className="text-sm text-gray-900" aria-live="polite">{itemLabel}{sellerLabel}</p>
      </div>

      {mutationError || cart.isError ? (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-md border border-danger/30 bg-red-100 px-4 py-3 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="break-words">{mutationError || "Unable to refresh your cart. Please try again."}</p>
            {cart.isError ? <button type="button" className="inline-flex min-h-11 items-center font-medium underline disabled:opacity-50" disabled={cart.isFetching} onClick={() => void cart.refetch()}>Retry cart</button> : null}
          </div>
        </div>
      ) : null}

      {cart.data.items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-7 text-center">
          <ShoppingCart className="mb-1 size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-heading-20">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground">Find something you like and add it to your cart.</p>
          <Link href="/search" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Continue shopping</Link>
        </CardContent></Card>
      ) : (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <section aria-label="Cart items" className="min-w-0 space-y-4" aria-busy={updating}>
            {groups.map((group) => (
              <CartSellerCard
                key={group.id}
                sellerName={group.name}
                items={group.items}
                disabled={updating}
                onUpdateQuantity={(itemId, quantity) => void handleMutation(() => cart.updateItem.mutateAsync({ itemId, quantity }))}
                onRemove={(itemId) => void handleMutation(() => cart.removeItem.mutateAsync(itemId))}
              />
            ))}
          </section>
          <CartSummary count={cart.count} subtotal={cart.data.subtotal} />
        </div>
      )}
    </div>
  );
}

export default ShoppingCartPage;
