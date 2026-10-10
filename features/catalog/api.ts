export const CATEGORY_TREE_PATH = "/api/v1/categories/tree";
export const PRODUCTS_PATH = "/api/v1/products";

export type ProductFilters = {
  categoryId?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export function categoryTreeRequest() {
    return {
        queryKey: ["catalog", "category-tree"] as const,
        url: CATEGORY_TREE_PATH,
    };
}

export function productsRequest(filters: ProductFilters = {}) {
  return {
    queryKey: ["catalog", "products", filters] as const,
    url: PRODUCTS_PATH,
    query: filters,
  };
}

export function formatVND(price: string | null): string | null {
  if (price === null) return null;

  const match = /^(\d+)(?:\.(\d+))?$/.exec(price);
  if (!match) return null;

  const integer = match[1].replace(/^0+(?=\d)/, "");
  const fraction = match[2];

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const decimal =
    fraction === undefined ? "" : `,${fraction.padEnd(2, "0")}`;

  return `${grouped}${decimal} ₫`;
}

