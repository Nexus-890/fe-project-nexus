import type { CategoryNode } from "./catalogResponseType";
import type { UserResponse } from "./authResponseType";

/** Shared by Header and its composed navigation/account components. */
export type HeaderProps = {
  user: UserResponse | null;
  authenticating: boolean;
  onSignOut: () => void;
  cartQuantity?: number;
  categories: CategoryNode[];
  categoriesLoading: boolean;
  categoriesError: boolean;
  onRetryCategories: () => void;
};
