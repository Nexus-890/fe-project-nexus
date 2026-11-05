"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, House } from "lucide-react";
import { isApiError } from "@/configs/api";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";
import { formatVND } from "@/components/formatPrice";
import { getProduct } from "@/service/catalogService";
import {
  mockProductDetail,
  USE_PRODUCT_DETAIL_MOCK,
} from "@/mocks/product-detail";
import type { ProductSku } from "@/types/catalogResponseType";
import SKUSelector from "@/components/SKUSelector";
import QuantityPicker from "@/components/QuantityPicker";
import ProductGallery from "@/components/ProductGallery";

interface ProductDetailPageProps {
  slug: string;
  productId?: string;
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
  const returnTo = `/products/${encodeURIComponent(slug)}${productId ? `?id=${encodeURIComponent(productId)}` : ""}`;

  const handleAddToCart = async () => {
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
            <p className="text-sm text-gray-800">
              SKU selection controls the price sent to the cart.
            </p>
          </div>

          <p
            className="min-h-10 text-heading-32 text-primary"
            aria-live="polite"
          >
            {price ?? "Price unavailable"}
          </p>

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
            <QuantityPicker value={quantity} onChange={setQuantity} />
          </div>

          <button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={!sku || !cart.ready || cart.adding || cart.loading || status === "restoring" || status === "authenticating" || status === "error"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-gray-700 sm:w-auto sm:min-w-56"
          >
            {cart.adding ? "Adding…" : "Add to Cart"}
          </button>

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

          {detail.description ? (
            <p className="border-t border-border pt-5 text-sm leading-6 text-gray-900 [overflow-wrap:anywhere]">
              {detail.description}
            </p>
          ) : null}
        </section>
      </section>
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
