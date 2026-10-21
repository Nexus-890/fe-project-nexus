import type { CategoryNode, ProductSummary } from "../catalog/response/type";
import type { UserResponse } from "../auth/response/type";

export interface HeaderProps {
  user: UserResponse | null;
  authenticating: boolean;
  onSignOut: () => void;
  categories: CategoryNode[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  onRetryCategories: () => void;
}

export type ProductCardProps = {
  product: Pick<ProductSummary, "id" | "name" | "slug" | "minPrice" | "imageUrl">;
};

export type ProductGridProps = {
  products: ProductSummary[];
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
};

export interface CategoryTreeProps {
  categories: CategoryNode[];
  depth?: number;
  activeSlug?: string;
  variant?: "tree" | "tiles";
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}
