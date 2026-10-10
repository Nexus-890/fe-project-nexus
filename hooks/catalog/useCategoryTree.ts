"use client";

import { useApiQuery } from "../useApiQuery";
import { getCategoryTree } from "../../service/catalog";
import { queryKeys } from "../../configs/query-keys";

/** Shared category-tree query used by Home and client-side catalog pages. */
export function useCategoryTree() {
  return useApiQuery({
    queryKey: queryKeys.catalog.tree,
    service: getCategoryTree,
  });
}
