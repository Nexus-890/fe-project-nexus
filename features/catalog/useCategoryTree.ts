"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import type { CategoryNode } from "@/types/api";
import { categoryTreeRequest } from "./api";

export function useCategoryTree() {
    return useApiQuery<CategoryNode[]>(
        categoryTreeRequest(),
    );
}