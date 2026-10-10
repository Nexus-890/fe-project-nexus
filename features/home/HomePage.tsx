"use client";
import { CategoryNavigation } from "@/ui/components/organisms/CategoryNavigation";
import { useCategoryTree } from "@/hooks/catalog/useCategoryTree";

export default function HomePage() {
  const tree = useCategoryTree();

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6">
      <CategoryNavigation categories={tree.data ?? []} loading={tree.isPending} error={tree.isError}
        retrying={tree.isFetching} onRetry={() => void tree.refetch()} />
    </div>
  );
}
