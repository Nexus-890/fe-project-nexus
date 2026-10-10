import CategoryPage from "@/features/category/CategoryPage";
import type { CategoryPageProps } from "@/types/catalog/request/type";

export default function Page(props: CategoryPageProps) {
  return <CategoryPage {...props} />;
}
