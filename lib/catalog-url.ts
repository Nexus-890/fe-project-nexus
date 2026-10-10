export function categoryHref(slug: string): string {
  return `/categories/${encodeURIComponent(slug)}`;
}

export function searchHref({
  q,
  category,
  sort,
  page,
}: { q?: string; category?: string; sort?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}
