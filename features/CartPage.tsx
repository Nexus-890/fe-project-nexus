"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Heart, ShoppingBag, Store } from "lucide-react";
import CartLine from "../components/CartLine";
import CartPromotionSummary from "./CartPromotionSummary";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getCartProducts } from "../service/cartCatalogService";
import { getCartQuantity, getCartSubtotal } from "./cartUtils";
import { useCart } from "./useCart";
import type { CartItem } from "../types/cartResponseType";
import { getStockLevels } from "../service/backofficeService";

function CartPage() {
  const { status, sessionId, user, error, retryProfile } = useAuth();
  return (
    <section
      className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-9"
      aria-labelledby="cart-title"
    >
      <h1 id="cart-title" className="text-heading-32">
        Cart
      </h1>
      {status === "authenticated" ? (
        user?.roles.includes("BUYER") ? <CartContents key={sessionId} /> : <div className="mt-6 rounded-sm border border-border p-6"><h2 className="text-heading-20">A buyer account is required</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Shopping carts are available to buyer accounts. Your saved guest items are kept for your next buyer sign-in.</p><Link href={user?.roles.includes("SELLER") ? "/backoffice" : "/"} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">{user?.roles.includes("SELLER") ? "Open back office" : "Continue browsing"}</Link></div>
      ) : status === "restoring" || status === "authenticating" ? (
        <p role="status" className="py-12 text-muted-foreground">
          Loading your account…
        </p>
      ) : status === "error" ? (
        <div className="mt-6 rounded-sm border border-border p-6">
          <p role="alert">
            {error?.detail || "Unable to load your account. Please try again."}
          </p>
          <button
            type="button"
            className="mt-4 min-h-11 rounded-sm border border-border px-4"
            onClick={() => void retryProfile()}
          >
            Retry account
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-sm border border-border px-6 py-12 text-center">
          <ShoppingBag
            className="mx-auto mb-4 text-muted-foreground"
            size={40}
            aria-hidden="true"
          />
          <h2 className="text-heading-20">Sign in to view your cart</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your saved items will be waiting when you sign in.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      )}
    </section>
  );
}

function CartContents() {
  const { cart, pending, feedback, updateQuantity, removeItem } = useCart();
  const [saved, setSaved] = useState<string[]>([]);
  const quantity = getCartQuantity(cart.data?.items ?? []);
  const items = cart.data?.items ?? [];
  const productIds = [...new Set(items.map((item) => item.productId))].sort();
  const products = useApiQuery({
    queryKey: queryKeys.catalog.cartProducts(productIds),
    service: (signal) => getCartProducts(productIds, { signal }),
  }, { enabled: productIds.length > 0, staleTime: 60_000, retry: false });
  const skuIds = items.map((item) => item.skuId);
  const stock = useApiQuery({
    queryKey: queryKeys.catalog.stockLevels(skuIds),
    service: (signal) => getStockLevels(skuIds, { signal }),
  }, { enabled: skuIds.length > 0, retry: false });
  const stockBlocked = items.some((item) => stock.data?.[item.skuId] !== undefined && item.quantity > stock.data[item.skuId]);
  const sellers = new Map<string, CartItem[]>();
  for (const item of items) {
    const sellerId = products.data?.[item.productId]?.sellerId ?? item.sellerId ?? "shop";
    sellers.set(sellerId, [...(sellers.get(sellerId) ?? []), item]);
  }

  if (!cart.data && cart.isPending)
    return (
      <p role="status" className="py-12 text-muted-foreground">
        Loading your cart…
      </p>
    );
  if (!cart.data)
    return (
      <div className="mt-6 rounded-sm border border-border p-6">
        <h2 className="text-heading-20">Unable to load your cart</h2>
        <p
          role="alert"
          className="mt-2 break-words text-sm text-muted-foreground"
        >
          {cart.error?.detail || "Please try again in a moment."}
        </p>
        <button
          type="button"
          onClick={() => void cart.refetch()}
          className="mt-4 min-h-11 rounded-sm border border-border px-4 text-sm font-medium hover:bg-secondary"
        >
          Retry cart
        </button>
      </div>
    );

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {quantity} {quantity === 1 ? "item" : "items"} from {sellers.size} {sellers.size === 1 ? "seller" : "sellers"}
      </p>
      {stockBlocked && <p role="alert" className="mt-4 rounded-sm border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">Some items are out of stock or above the available quantity. Update your cart to check out.</p>}
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`mt-5 rounded-sm border p-4 text-sm break-words ${feedback.error ? "border-danger text-danger" : "border-border text-foreground"}`}
        >
          {feedback.text}
        </p>
      )}
      {cart.isError && (
        <div className="mt-4 rounded-sm border border-border p-4 text-sm">
          <p role="alert">
            We couldn’t refresh your cart. Your last saved items are shown.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void cart.refetch()}
            className="min-h-11 px-2 font-medium text-primary disabled:opacity-50"
          >
            Retry cart
          </button>
        </div>
      )}
      {items.length ? (
        <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className="min-w-0 space-y-4"
            aria-label="Cart items"
            aria-busy={pending}
          >
            {[...sellers].map(([sellerId, lines], index) => <section key={sellerId} className="overflow-hidden rounded-sm border border-border" aria-label={`Seller ${index + 1}`}>
              <h2 className="flex min-h-12 items-center gap-2 border-b border-border bg-muted/40 px-4 text-sm font-medium"><Store size={16} aria-hidden="true" />{lines?.[0]?.sellerName || (sellerId === "shop" ? "Your shop" : `Shop ${index + 1}`)}<span className="ml-auto text-xs font-normal text-muted-foreground">{lines?.length} {lines?.length === 1 ? "product" : "products"}</span></h2>
              <div className="divide-y divide-border">{lines?.map((item) => <CartLine key={item.id} item={item} product={products.data?.[item.productId]} available={stock.data?.[item.skuId]} pending={pending} saved={saved.includes(item.id)} onSave={() => setSaved((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} onQuantityChange={(next) => updateQuantity(item.id, next)} onRemove={() => removeItem(item.id)} />)}</div>
            </section>)}
            {saved.length > 0 && <p role="status" className="flex items-start gap-2 rounded-sm bg-muted p-4 text-xs leading-5 text-muted-foreground"><Heart size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{saved.length} {saved.length === 1 ? "item marked" : "items marked"} for later in this visit. Items stay in your cart until you remove them.</p>}
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <ArrowLeft size={16} aria-hidden="true" />Continue shopping
            </Link>
          </div>
          <CartPromotionSummary
            cartSignature={JSON.stringify(items)}
            quantity={quantity}
            subtotal={getCartSubtotal(items)}
            pending={pending}
            stockBlocked={stockBlocked}
          />
        </div>
      ) : (
        <div
          className="mt-6 rounded-sm border border-border px-6 py-14 text-center"
          aria-busy={pending}
        >
          <ShoppingBag
            className="mx-auto mb-4 text-muted-foreground"
            size={44}
            aria-hidden="true"
          />
          <h2 className="text-heading-24">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Find something you love and add it to your cart.
          </p>
          {pending && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Updating your cart…
            </p>
          )}
          <Link
            href="/search"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Browse catalog
          </Link>
        </div>
      )}
    </>
  );
}

export default CartPage;
