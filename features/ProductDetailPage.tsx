"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, House, MapPin, ShoppingCart, Truck, Zap } from "lucide-react";
import { isApiError } from "@/configs/api";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";
import { formatVND, formatVNDRange } from "@/components/formatPrice";
import { getProduct, getProducts } from "@/service/catalogService";
import { getProductAvailability } from "@/service/backofficeService";
import ProductInformationTabs, { RatingStars } from "@/components/ProductInformationTabs";
import ProductCard from "@/components/ProductCard";
import SampleSaleCountdown from "@/components/SampleSaleCountdown";
import {
  mockProductDetail,
  USE_PRODUCT_DETAIL_MOCK,
} from "@/mocks/product-detail";
import type { ProductSku } from "@/types/catalogResponseType";
import SKUSelector from "@/components/SKUSelector";
import QuantityPicker from "@/components/QuantityPicker";
import ProductGallery from "@/components/ProductGallery";
import ClaimableVouchers from "./ClaimableVouchers";
import SellerReputation from "./SellerReputation";

interface ProductDetailPageProps {
  slug: string;
  productId?: string;
}

function ProductStockAvailability({ skuId }: { skuId: string }) {
  const stock = useApiQuery({ queryKey: queryKeys.catalog.stock(skuId), service: (signal) => getProductAvailability(skuId, { signal }) }, { retry: false });
  if (stock.isPending) return <p role="status" className="text-sm text-muted-foreground">Checking availability...</p>;
  if (stock.isError) return <p className="text-sm text-muted-foreground">Stock availability is unavailable. <button type="button" className="min-h-9 underline" onClick={() => void stock.refetch()}>Retry availability</button></p>;
  const available = stock.data;
  return <p data-testid="product-stock" className={`text-sm ${available ? "text-success" : "text-muted-foreground"}`}>{available ? `In stock · ${available} available` : "Out of stock"}</p>;
}

const UUID_SUFFIX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveProductId(slug: string, productId?: string): string {
  if (productId?.trim()) return productId.trim();
  return (
    slug.match(UUID_SUFFIX)?.[0] ??
    (USE_PRODUCT_DETAIL_MOCK
      ? slug === mockProductDetail.slug
        ? mockProductDetail.id
        : slug
      : "")
  );
}

function selectedSku(
  skus: ProductSku[],
  selectedId: string,
): ProductSku | undefined {
  return skus.find((sku) => sku.id === selectedId) ?? skus[0];
}

function ProductDetailPage({ slug, productId }: ProductDetailPageProps) {
  const router = useRouter();
  const id = resolveProductId(slug, productId);
  const { status, sessionId, isSessionCurrent } = useAuth();
  const cart = useGuestCart();
  const product = useApiQuery(
    {
      queryKey: queryKeys.catalog.product(id),
      service: (signal) => getProduct(id, { signal }),
    },
    {
      enabled: Boolean(id),
      staleTime: 60_000,
    },
  );
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [signInPrompt, setSignInPrompt] = useState<number | null>(null);
  const [cartMessage, setCartMessage] = useState<{
    sessionId: number;
    text: string;
  } | null>(null);
  const activeSession = useRef<{ sessionId: number; status: typeof status } | null>(null);
  const recommendationFilters = { categoryId: product.data?.categoryId, page: 0, size: 5 };
  const recommendations = useApiQuery({
    queryKey: queryKeys.catalog.products(recommendationFilters),
    service: (signal) => getProducts(recommendationFilters, { signal }),
  }, { enabled: Boolean(product.data?.categoryId) });

  useEffect(() => {
    activeSession.current = { sessionId, status };
    return () => { activeSession.current = null; };
  }, [sessionId, status]);

  if (!id) {
    return (
      <ProductError message="This product link does not include a product id." />
    );
  }

  if (product.isPending) {
    return (
      <section
        className="mx-auto w-full max-w-[1248px] px-4 py-12 sm:px-6"
        role="status"
      >
        Loading product…
      </section>
    );
  }

  if (product.isError || !product.data) {
    return (
      <ProductError
        message="Unable to load this product. Please try again."
        onRetry={() => void product.refetch()}
      />
    );
  }

  const detail = product.data;
  const sku = selectedSku(detail.skus, selectedSkuId);
  const price = formatVND(sku?.price ?? null);
  const formattedRange = formatVNDRange(detail.minPrice, detail.maxPrice);
  const priceRange = formattedRange !== formatVND(detail.minPrice) ? formattedRange : null;
  const returnTo = `/products/${encodeURIComponent(slug)}${productId ? `?id=${encodeURIComponent(productId)}` : ""}`;

  const handleAddToCart = async (buyNow = false) => {
    if (status === "anonymous" && !cart.guestEnabled) {
      setSignInPrompt(sessionId);
      setCartMessage(null);
      return;
    }
    if (!sku || !cart.ready || cart.adding || cart.loading || status === "restoring" || status === "authenticating" || status === "error") return;
    setCartMessage(null);
    setSignInPrompt(null);
    const isCurrent = () => activeSession.current?.sessionId === sessionId &&
      activeSession.current.status === status &&
      (status !== "authenticated" || isSessionCurrent(sessionId));
    try {
      const result = await cart.addItem({ skuId: sku.id, quantity });
      if (!isCurrent()) return;
      if (result.ok) {
        setCartMessage({ sessionId, text: "Added to cart." });
        if (buyNow) router.push("/checkout");
      } else if (result.error.kind !== "aborted") {
        if (status === "anonymous" && (result.error.status === 401 || result.error.status === 403)) {
          setSignInPrompt(sessionId);
        } else {
          setCartMessage({ sessionId, text: isApiError(result.error)
            ? result.error.detail || result.error.title
            : "Unable to add this item to cart." });
        }
      }
    } catch {
      if (isCurrent()) {
        setCartMessage({ sessionId, text: "Unable to add this item to cart. Please try again." });
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-6 pb-12 sm:px-6 lg:pb-16">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-900"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-11 items-center gap-1.5 hover:text-primary"
        >
          <House size={16} aria-hidden="true" />
          Home
        </Link>
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="shrink-0 text-gray-700"
        />
        <span
          aria-current="page"
          className="min-w-0 max-w-full [overflow-wrap:anywhere]"
        >
          {detail.name}
        </span>
      </nav>

      <section className="mt-5 grid min-w-0 items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0">
          <ProductGallery
            key={detail.id}
            images={detail.images}
            productName={detail.name}
          />
        </div>

        <section className="min-w-0 space-y-6" aria-label="Product details">
          <div className="space-y-2">
            <h1 className="text-heading-32 [overflow-wrap:anywhere]">
              {detail.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm"><RatingStars /><strong>4.8</strong><span className="text-muted-foreground">126 sample reviews</span></div>
            <p className="text-sm text-gray-800">
              Price depends on the option you choose.
            </p>
            {priceRange !== null && (
              <p data-testid="product-price-range" className="text-base font-semibold text-primary [overflow-wrap:anywhere]">
                {priceRange}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-gradient-to-r from-primary-active to-primary p-3 text-primary-foreground"><span className="inline-flex items-center gap-2 text-sm font-medium"><Zap size={17} aria-hidden="true" />FLASH SALE PREVIEW</span><SampleSaleCountdown inverse /></div>
          <p
            className="min-h-10 text-heading-32 text-primary [overflow-wrap:anywhere]"
            aria-live="polite"
          >
            {price ?? "Price unavailable"}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Shop vouchers</span>{["50K off", "15% off audio", "Free shipping"].map((offer) => <span key={offer} className="rounded-sm border border-orange-300 px-2 py-1 text-primary">{offer}</span>)}<span className="w-full text-muted-foreground">Sample offers · final price is shown at checkout.</span></div>

          {detail.skus.length > 0 ? (
            <SKUSelector
              skus={detail.skus}
              selectedSkuId={sku?.id}
              onChange={(next) => {
                setSelectedSkuId(next);
                setCartMessage(null);
              }}
            />
          ) : (
            <p role="status">This product has no available options.</p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Quantity</p>
            {sku && <ProductStockAvailability key={sku.id} skuId={sku.id} />}
            <QuantityPicker value={quantity} onChange={setQuantity} />
          </div>

          <div className="flex flex-wrap gap-3"><button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={!sku || !cart.ready || cart.adding || cart.loading || status === "restoring" || status === "authenticating" || status === "error"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-gray-700 sm:w-auto sm:min-w-56"
          >
            <ShoppingCart size={20} className="mr-2" aria-hidden="true" />{cart.adding ? "Adding…" : "Add to Cart"}
          </button>
          <button type="button" disabled={!sku || !cart.ready || cart.adding || cart.loading || status === "restoring" || status === "authenticating" || status === "error"} onClick={() => void handleAddToCart(true)} className="inline-flex min-h-12 min-w-32 flex-1 items-center justify-center rounded-md border border-border px-5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground sm:flex-none">Buy Now</button></div>

          {signInPrompt === sessionId ? (
            <p
              role="status"
              className="rounded-md border border-border bg-muted p-3 text-sm"
            >
              Please sign in before adding items.{" "}
              <Link
                className="inline-flex min-h-11 items-center px-1 font-medium text-primary underline"
                href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Sign in
              </Link>
            </p>
          ) : null}
          {cartMessage?.sessionId === sessionId ? (
            <p role="status" aria-live="polite" className="text-sm">
              {cartMessage.text}
            </p>
          ) : null}

          <div className="space-y-3 border-t border-border pt-5 text-sm"><p className="flex items-center gap-2"><MapPin size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />Choose your delivery address at checkout</p><p className="flex items-center gap-2"><Truck size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />Shipping options and fees are confirmed before payment.</p></div>
          <SellerReputation sellerId={detail.sellerId} />
        </section>
      </section>
      <ClaimableVouchers key={`${sessionId}-${detail.id}`} productId={detail.id} />
      <ProductInformationTabs product={detail} />
      <section aria-label="You might also like" className="mt-8 space-y-5"><h2 className="text-heading-24">You might also like</h2>{recommendations.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading recommendations…</p> : recommendations.isError ? <div role="alert" className="space-y-3 rounded-sm border border-border p-4 text-sm"><p>Unable to load recommendations.</p><button type="button" onClick={() => void recommendations.refetch()} disabled={recommendations.isFetching} className="min-h-11 rounded-sm border border-border px-3">Retry recommendations</button></div> : recommendations.data?.content.some((item) => item.id !== detail.id) ? <ul className="grid list-none grid-cols-1 gap-4 p-0 min-[480px]:grid-cols-2 lg:grid-cols-4">{recommendations.data.content.filter((item) => item.id !== detail.id).slice(0, 4).map((item) => <li key={item.id} className="min-w-0"><ProductCard product={item} /></li>)}</ul> : <p className="text-sm text-muted-foreground">More finds are on the way. <Link href="/search" className="inline-flex min-h-11 items-center text-primary">Browse all products</Link></p>}</section>
    </div>
  );
}

export default ProductDetailPage;

function ProductError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section
      className="mx-auto w-full max-w-[1248px] space-y-4 px-4 py-12 sm:px-6"
      role="alert"
    >
      <h1 className="text-heading-24">Unable to load product</h1>
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md border border-border px-4 hover:bg-muted"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
