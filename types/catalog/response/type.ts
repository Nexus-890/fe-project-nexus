export interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  level: number;
  children: CategoryNode[];
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  minPrice: string | null;
  imageUrl?: string | null;
  categoryId?: string;
  sellerId?: string;
  status?: string;
}

/** Detail returned by GET /api/v1/products/{id}. */
export interface ProductSku {
  id: string;
  productId: string;
  skuCode: string;
  color: string | null;
  size: string | null;
  /** Money is normalized to a string at the API boundary. */
  price: string;
  status: string;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  auctionEnable: boolean;
  skus: ProductSku[];
  images: ProductImage[];
}
