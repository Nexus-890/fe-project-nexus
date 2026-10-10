import type { CategoryNode } from "./response/type";

export interface CategoryListingProps {
  category: CategoryNode;
  categories: CategoryNode[];
  page: number;
}

export interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
