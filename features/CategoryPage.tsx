import { notFound } from "next/navigation";
import { getCategoryTree } from "@/service/catalogService";
import { findCategory, parsePage } from "@/features/catalogUtils";
import { CategoryListing } from "./CategoryListing";

export type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  const categories = await getCategoryTree();
  const categoryKey = route.slug.startsWith("slug=")
    ? route.slug.slice("slug=".length)
    : route.slug;
  const category = findCategory(categories, categoryKey);
  if (!category) notFound();
  return (
    <CategoryListing
      category={category}
      categories={categories}
      page={parsePage(query.page)}
    />
  );
}

export default CategoryPage;
