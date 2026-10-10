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
  categoryId?: string;
  status?: string;
}
