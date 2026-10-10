export interface ProductFilters {
  categoryId?: string;
  /** Free-text query used by the search results page. */
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
