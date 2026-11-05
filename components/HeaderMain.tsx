import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
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
      <Link
        href="/#categories"
        className="inline-flex min-h-11 lg:min-h-9 shrink-0 items-center gap-1 rounded-sm px-2 text-xs leading-4 text-gray-900 hover:text-primary"
      >
        <span>
          Shop by
          <br />
          category
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </Link>
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
