import type { operations } from "./catalogGeneratedType";
/** q/sort remain URL state for the existing UI; delivered BE has no search/sort implementation. */
export type ProductFilters =
  operations["listProducts"]["parameters"]["query"] & {
    q?: string;
    sort?: string;
  };
