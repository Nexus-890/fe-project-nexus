import type { SellerAuction, SellerPreviewProduct, SellerSale } from "../types/sellerType";

/** Explicit UI preview data. Never used as a fallback for a failed API request. */
export const makeSellerPreviewProducts = (): SellerPreviewProduct[] => [
  ["Apple AirPods Max Silver", "APL-APM-SLV", "Silver", "5490000", 15, "ACTIVE"],
  ["Apple AirPods (3rd generation)", "APL-APP-WHT", "White", "1290000", 2, "ACTIVE"],
  ["Beats Flex Wireless Earphones", "BTS-FLX-BLK", "Black", "499000", 64, "ACTIVE"],
  ["Apple HomePod Mini Cosmic Grey", "APL-HPM-GRY", "Cosmic Grey", "990000", 1, "ACTIVE"],
  ["Amazon Echo Plus", "AMZ-ECP-BLK", "Black", "999000", 8, "DRAFT"],
  ["Apple Airpower Wireless Charger", "APL-APW-WHT", "White", "799000", 0, "INACTIVE"],
  ["Apple MagSafe Battery Pack", "APL-MGS-WHT", "White", "999000", 21, "ACTIVE"],
].map(([name, sku, color, price, stock, status], index) => ({
  id: `sample-product-${index + 1}`, name: String(name), slug: `sample-product-${index + 1}`,
  categoryId: "sample-audio", sellerId: "sample-seller", status: String(status),
  description: "High-fidelity audio with active noise cancellation and up to 20 hours of listening on one charge.",
  auctionEnable: true, minPrice: String(price), maxPrice: String(price), images: [{ id: `sample-image-${index + 1}`, imageUrl: `/seller-preview/product-${index + 1}.png`, sortOrder: 0 }],
  skus: [{ id: `sample-sku-${index + 1}`, productId: `sample-product-${index + 1}`, skuCode: String(sku), color: String(color), size: "Standard", price: String(price), status: "ACTIVE" }],
  stock: Number(stock), reserved: index === 0 ? 3 : 0, unavailable: index === 1 ? 1 : 0, sold: index === 0 ? 1204 : index === 1 ? 702 : 126,
  updated: `2026-11-${String(10 - index).padStart(2, "0")}`,
}));
export const makeSellerPreviewAuctions = (): SellerAuction[] => makeSellerPreviewProducts().slice(0, 4).map((product, index) => ({
  id: `sample-auction-${index + 1}`, productId: product.id, skuId: product.skus[0].id, sellerId: "sample-seller", title: product.name,
  startingPrice: "100000", currentPrice: String(182000 + index * 150000), bidIncrement: "10000", bidCount: index === 3 ? 0 : 11 + index,
  currency: "VND", startAt: "2026-11-12T13:00:00Z", endAt: "2026-11-15T13:00:00Z", originalEndAt: "2026-11-15T13:00:00Z", extensionCount: 0,
  status: index === 3 ? "SCHEDULED" : "ACTIVE", imageUrl: null,
}));
export const makeSellerPreviewSales = (): SellerSale[] => ["PAID", "PAID", "SHIPPED", "COMPLETED", "PENDING", "CANCELED", "REFUND_REQUESTED"].map((status, index) => ({
  orderId: `sample-order-${index + 1}`, orderNumber: `NX-261110-00${42 - index}`,
  buyerId: ["Nguyễn Thị Lan", "Trần Quốc Bảo", "Phạm Mai Anh", "Lê Hoàng Nam"][index % 4],
  createdAt: "2026-11-10T09:00:00+07:00", status: status as SellerSale["status"], totalAmount: String(6790000 - index * 700000), orderGroupId: null,
  itemCount: index === 0 ? 2 : 1, itemNames: [makeSellerPreviewProducts()[index].name],
}));
