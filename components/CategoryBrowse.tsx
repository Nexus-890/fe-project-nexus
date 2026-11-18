import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { CategoryNode } from "@/types/catalogResponseType";

type CategoryBrowseProps = {
  categories: CategoryNode[];
  activeSlug?: string;
  hrefFor: (slug: string) => string;
};

export const categoryPath = (categories: CategoryNode[], slug: string): CategoryNode[] => {
  for (const category of categories) {
    if (category.slug === slug) return [category];
    const below = categoryPath(category.children, slug);
    if (below.length) return [category, ...below];
  }
  return [];
};

const linkClass = "flex min-h-11 items-center rounded-md px-3 py-2 text-sm [overflow-wrap:anywhere] hover:bg-muted";

export function CategoryBrowse({ categories, activeSlug, hrefFor }: CategoryBrowseProps) {
  const path = activeSlug ? categoryPath(categories, activeSlug) : [];
  const current = path.at(-1);
  const children = current ? current.children : categories;
  return (
    <nav aria-label="Browse categories" className="space-y-1">
      {current ? (
        <>
          <Link href={hrefFor("")} className={`${linkClass} gap-1 text-muted-foreground`}>
            <ChevronLeft size={14} aria-hidden="true" />
            All categories
          </Link>
          {path.slice(0, -1).map((ancestor) => (
            <Link key={ancestor.id} href={hrefFor(ancestor.slug)} className={`${linkClass} text-muted-foreground`}>
              {ancestor.name}
            </Link>
          ))}
          <p aria-current="page" className="flex min-h-11 items-center px-3 py-2 text-sm font-semibold text-primary [overflow-wrap:anywhere]">
            {current.name}
          </p>
        </>
      ) : null}
      {children.length ? (
        <ul className={current ? "space-y-1 pl-3" : "space-y-1"}>
          {children.map((category) => (
            <li key={category.id} className="min-w-0">
              <Link href={hrefFor(category.slug)} className={linkClass}>
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
