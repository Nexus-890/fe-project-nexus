"use client";

import { createContext, useState, type ReactNode } from "react";
import type { ProductSummary } from "@/types/catalogResponseType";
import { useAuth } from "../hooks/useAuth";

type WatchlistContextValue = {
  products: ProductSummary[];
  toggle: (product: ProductSummary) => void;
  contains: (id: string) => boolean;
};

export const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/** Visit-only collection until the wishlist API is delivered. */
function WatchlistProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAuth();
  const [collection, setCollection] = useState<{ sessionId: number; products: ProductSummary[] }>({ sessionId, products: [] });
  const products = collection.sessionId === sessionId ? collection.products : [];
  function toggle(product: ProductSummary) {
    setCollection((previous) => {
      const current = previous.sessionId === sessionId ? previous.products : [];
      return { sessionId, products: current.some(({ id }) => id === product.id)
        ? current.filter(({ id }) => id !== product.id)
        : [...current, product] };
    });
  }
  return <WatchlistContext value={{ products, toggle, contains: (id) => products.some((product) => product.id === id) }}>{children}</WatchlistContext>;
}

export default WatchlistProvider;
