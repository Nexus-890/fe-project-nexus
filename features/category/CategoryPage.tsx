import { notFound } from "next/navigation";
import { QueryClient } from "@tanstack/react-query";
import { apiQueryOptions } from "@/hooks/api-query-options";
import { getCategoryTree } from "@/service/catalog";
import { queryKeys } from "@/configs/query-keys";
import type { CategoryPageProps } from "@/types/catalog/request/type";
import { findCategory, parsePage } from "@/lib/catalog-model";
import { CategoryListing } from "./CategoryListing";

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  const queryClient = new QueryClient();
  const categories = await queryClient.fetchQuery(apiQueryOptions({
    queryKey: queryKeys.catalog.tree,
    service: getCategoryTree,
  }));
  const categoryKey = route.slug.startsWith("slug=") ? route.slug.slice("slug=".length) : route.slug;
  const category = findCategory(categories, categoryKey);
  if (!category) notFound();
  return <CategoryListing category={category} categories={categories} page={parsePage(query.page)} />;
}
