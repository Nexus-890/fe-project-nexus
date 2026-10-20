import type { CategoryNode, ProductSummary } from "../catalog/response/type";
import type { UserResponse } from "../auth/response/type";

export interface CategoryNavigationProps {
  categories: CategoryNode[];
  loading: boolean;
  error: boolean;
  retrying: boolean;
  onRetry: () => void;
}

export interface HeaderProps {
  cartCount?: number;
  user: UserResponse | null;
  authenticating: boolean;
  onSignOut: () => void;
  categories: CategoryNode[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  onRetryCategories: () => void;
}

export type ProductCardProps = {
  product: Pick<ProductSummary, "id" | "name" | "slug" | "minPrice">;
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
