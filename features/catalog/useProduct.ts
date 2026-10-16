"use client";

import { queryKeys } from "@/configs/query-keys";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getProduct } from "@/service/catalog";
import type { ProductDetail } from "@/types/catalog/response/type";

export function useProduct(productId: string, enabled = true) {
  return useApiQuery<ProductDetail>({
    queryKey: queryKeys.catalog.product(productId),
    service: (signal) => getProduct(productId, signal),
  }, {
    enabled: enabled && Boolean(productId),
    staleTime: 60_000,
  });
}
