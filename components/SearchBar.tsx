"use client";

import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "./input";
import type { CategoryNode } from "@/types/catalogResponseType";
import { flattenCategories, searchHref } from "@/features/catalogUtils";

export interface SearchBarProps {
  categories: CategoryNode[];
  categoriesLoading: boolean;
  categoriesError: boolean;
}

function SearchBar({
  categories,
  categoriesLoading,
  categoriesError,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const query = draft ?? routeQuery;
  const categoryOptions = flattenCategories(categories);
  const routeCategory = searchParams.get("category") ?? "";
  const routeState = searchParams.toString();
  const [categoryDraft, setCategoryDraft] = useState<{
    routeState: string;
    value: string;
  } | null>(null);
  const category =
    categoryDraft?.routeState === routeState
      ? categoryDraft.value
      : categoryOptions.some((item) => item.slug === routeCategory)
        ? routeCategory
        : "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    setDraft(null);
    setCategoryDraft(null);
    router.push(searchHref({ q: value, category }));
  }

  return (
    <form
      onSubmit={submit}
      className="flex min-w-0 flex-wrap items-center gap-3"
    >
      <div className="flex h-12 min-w-0 flex-1 basis-full items-center rounded-full border-2 border-neutral-800 bg-white sm:basis-auto">
        <div className="flex shrink-0 items-center pl-4">
          <Search
            size={20}
            strokeWidth={1.7}
            className="text-neutral-600"
            aria-hidden="true"
          />
        </div>

        <Input
          type="text"
          name="q"
          value={query}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search for anything"
          aria-label="Search for anything"
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:border-0 focus-visible:ring-0"
        />

        <div className="h-6 w-px shrink-0 bg-neutral-200" aria-hidden="true" />

        <div className="w-[9.5rem] shrink-0 sm:w-[11rem]">
          <Select
            value={category}
            onValueChange={(value) => {
              if (value !== null) setCategoryDraft({ routeState, value });
            }}
          >
            <SelectTrigger
              aria-label="Search category"
              aria-busy={categoriesLoading}
              aria-invalid={categoriesError}
              className="min-w-0 max-w-none overflow-visible rounded-full border-0 bg-transparent px-3 text-neutral-700 shadow-none hover:text-black sm:px-5"
            >
              <SelectValue>
                {categoryOptions.find((item) => item.slug === category)?.name ??
                  "All Categories"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-52" alignItemWithTrigger={false}>
              <SelectItem value="">All Categories</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.id} value={option.slug}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <button
        type="submit"
        className="min-h-12 min-w-11 rounded-full bg-orange-600 px-9 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
      >
        Search
      </button>

      <button
        type="button"
        className="min-h-11 min-w-11 whitespace-nowrap px-2 text-xs text-neutral-600 hover:text-black"
      >
        Advanced
      </button>
    </form>
  );
}

export default SearchBar;
