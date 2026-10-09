export const CATEGORY_TREE_PATH = "/api/v1/categories/tree";
export const PRODUCTS_PATH = "api/v1/products";

export function formatVND(price: string | null): string | null {
  if (price === null || price === undefined) return null;
  const num = Number(price);
  if (!Number.isFinite(num)) return null;
  // Intl.NumberFormat giữ nguyên phần thập phân không bị cắt gọt sai
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 2,
  }).format(num);
}

