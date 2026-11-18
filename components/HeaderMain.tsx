import { Suspense } from "react";
import { CategoryMegaMenu } from "@/components/CategoryMegaMenu";
import Logo from "@/components/Logo";
import SearchBar from "@/components/SearchBar";
import type { CategoryNode } from "@/types/catalogResponseType";

interface HeaderMainProps {
  categories: CategoryNode[];
  categoriesLoading: boolean;
  categoriesError: boolean;
}

function SearchBarFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-12 min-w-0 flex-1 rounded-full border-2 border-neutral-800 bg-white"
    />
  );
}

function HeaderMain(props: HeaderMainProps) {
  return (
    <div className="mx-auto flex max-w-[1248px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:flex-nowrap lg:gap-6 lg:py-2.5">
      <Logo />
      <CategoryMegaMenu
        categories={props.categories}
        loading={props.categoriesLoading}
        error={props.categoriesError}
      />
      <div className="order-3 min-w-0 basis-full lg:order-none lg:flex-1">
        <Suspense fallback={<SearchBarFallback />}>
          <SearchBar
            categories={props.categories}
            categoriesLoading={props.categoriesLoading}
            categoriesError={props.categoriesError}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default HeaderMain;
