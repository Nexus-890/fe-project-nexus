import SearchPage from "@/features/search/SearchPage";
import type { SearchPageProps } from "@/types/catalog/type";

export default async function Page({ searchParams }: SearchPageProps) {
  return <SearchPage query={await searchParams} />;
}
