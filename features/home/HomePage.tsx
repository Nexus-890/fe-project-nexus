"use client";
import { CategoryNavigation } from "@/ui/components/organisms/CategoryNavigation";
import { useCategoryTree } from "@/hooks/catalog/useCategoryTree";

export default function HomePage() {
  const tree = useCategoryTree();

  if (tree.isSuccess && tree.data.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6">
      <CategoryNavigation categories={tree.data ?? []} loading={tree.isPending} error={tree.isError}
        retrying={tree.isFetching} onRetry={() => void tree.refetch()} />
    </div>
  );
}
