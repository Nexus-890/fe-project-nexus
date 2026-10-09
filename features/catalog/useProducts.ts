"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { ProductFilters, productsRequest } from "./api";
import { Page, ProductSummary } from "@/types/api";

export function useProducts(filters: ProductFilters = {}) {
    return useApiQuery<Page<ProductSummary>>(
        productsRequest(filters),
    );
}