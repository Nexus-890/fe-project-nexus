import type { operations } from "./catalogGeneratedType";
type SearchQuery = NonNullable<operations["searchProducts"]["parameters"]["query"]>;

export type ShopSort = "relevance" | "createdAt,desc" | "price,asc" | "price,desc";
type SearchSort = NonNullable<SearchQuery["sort"]>;
export const SEARCH_SORT: Record<ShopSort, SearchSort> = {
  relevance: "relevance",
  "createdAt,desc": "newest",
  "price,asc": "price_asc",
  "price,desc": "price_desc",
};

export const isShopSort = (value: string): value is ShopSort =>
  Object.prototype.hasOwnProperty.call(SEARCH_SORT, value);

// Keep existing shop URLs; catalogService translates their sort values for the canonical search API.
export type ProductFilters = Omit<SearchQuery, "sort"> & { sort?: ShopSort };
