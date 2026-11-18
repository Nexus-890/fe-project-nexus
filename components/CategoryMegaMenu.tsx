"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CategoryNode } from "@/types/catalogResponseType";
import { categoryHref } from "@/features/catalogUtils";

type CategoryMegaMenuProps = {
  categories: CategoryNode[];
  loading: boolean;
  error: boolean;
};

const CHILD_LIMIT = 6;

export function CategoryMegaMenu({ categories, loading, error }: CategoryMegaMenuProps) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenOn(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="category-mega-menu"
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 text-left text-xs leading-4 text-gray-900 hover:text-primary"
      >
        <span>
          Shop by
          <br />
          category
        </span>
        <ChevronDown size={15} aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open ? (
        <div
          id="category-mega-menu"
          className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,880px)] rounded-md border border-border bg-background p-5 shadow-lg"
        >
          {loading ? <p className="text-sm text-muted-foreground">Loading categories...</p> : null}
          {error ? <p className="text-sm text-muted-foreground">Categories are unavailable right now.</p> : null}
          {!loading && !error ? (
            <nav aria-label="Shop by category">
              <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map((category) => (
                  <li key={category.id} className="min-w-0">
                    <Link
                      href={categoryHref(category.slug)}
                      onClick={() => setOpen(false)}
                      className="block py-1 text-sm font-semibold [overflow-wrap:anywhere] hover:text-primary hover:underline"
                    >
                      {category.name}
                    </Link>
                    {category.children.length ? (
                      <ul className="mt-1 space-y-0.5">
                        {category.children.slice(0, CHILD_LIMIT).map((child) => (
                          <li key={child.id}>
                            <Link
                              href={categoryHref(child.slug)}
                              onClick={() => setOpen(false)}
                              className="block py-1 text-sm text-muted-foreground [overflow-wrap:anywhere] hover:text-primary hover:underline"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                        {category.children.length > CHILD_LIMIT ? (
                          <li>
                            <Link
                              href={categoryHref(category.slug)}
                              onClick={() => setOpen(false)}
                              className="block py-1 text-sm text-primary hover:underline"
                            >
                              See all
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
