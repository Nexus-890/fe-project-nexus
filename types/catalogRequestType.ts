import type { operations } from "./catalogGeneratedType";
type SearchQuery = NonNullable<operations["searchProducts"]["parameters"]["query"]>;
type UrlQuery = NonNullable<operations["listProducts"]["parameters"]["query"]>;
// Keep existing shop URLs; catalogService translates their sort values for the canonical search API.
export type ProductFilters = Omit<SearchQuery, "sort"> & Pick<UrlQuery, "sort">;
