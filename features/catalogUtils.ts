import type { CategoryNode } from "../types/catalogResponseType";
import type { ProductFilters } from "../types/catalogRequestType";

export const CATALOG_PAGE_SIZE = 12;
export const SEARCH_MAX_PRICE = 50000000;

export const parsePage = (value: string | string[] | undefined): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 2147483647 ? page : 1;
};

export const findCategory = (
  nodes: CategoryNode[],
  slug: string,
): CategoryNode | undefined => {
  for (const node of nodes) {
    // Routes normally use the public slug, but accepting the API id keeps
    // shared links such as /categories/1 working while the backend migrates.
    if (node.slug === slug || node.id === slug) return node;
    const child = findCategory(node.children, slug);
    if (child) return child;
  }
};

export interface FlatCategory extends CategoryNode {
  depth: number;
}

/** Flatten the API tree for select controls without duplicating category data in the UI. */
export const flattenCategories = (
  nodes: CategoryNode[],
  depth = 0,
): FlatCategory[] => {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
};

export const readQueryValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")).trim();

export const categoryHref = (slug: string): string =>
  `/categories/${encodeURIComponent(slug)}`;

export interface SearchState {
  q?: string;
  category?: string;
  sort?: ProductFilters["sort"];
  page?: number;
  listingType?: ProductFilters["listingType"];
  trust?: string[];
  condition?: string[];
  maxPrice?: number;
  minRating?: number;
}

export const searchHref = ({
  q,
  category,
  sort,
  page,
  listingType,
  maxPrice,
}: SearchState): string => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort && sort !== "relevance") params.set("sort", sort);
  if (listingType && listingType !== "all") params.set("listingType", listingType);
  // Trust/condition/rating have no catalog search data and remain disabled controls.
  if (maxPrice !== undefined && maxPrice < SEARCH_MAX_PRICE) params.set("maxPrice", String(maxPrice));
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
};
