"use client";

import { CategoryNavigation } from "@/components/CategoryNavigation";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { getCategoryTree } from "@/service/catalogService";

function HomePage() {
  const tree = useApiQuery({
    queryKey: queryKeys.catalog.tree,
    service: (signal) => getCategoryTree({ signal }),
  });

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6">
      <CategoryNavigation
        categories={tree.data ?? []}
        loading={tree.isPending}
        error={tree.isError}
        retrying={tree.isFetching}
        onRetry={() => void tree.refetch()}
      />
    </div>
  );
}

export default HomePage;
