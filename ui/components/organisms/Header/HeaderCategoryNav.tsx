import Link from "next/link";
import type { CategoryNode } from "@/types/catalog/response/type";
import { categoryHref } from "@/lib/catalog-url";

type HeaderNavItem = { label: string; href: string; active?: boolean };

const shortcuts: HeaderNavItem[] = [
  { label: "Nexus Live", href: "/#nexus-live", active: true },
  { label: "Saved", href: "/#saved" },
  { label: "Deals", href: "/#deals" },
  { label: "Refurbished", href: "/#refurbished" },
];

interface HeaderCategoryNavProps {
  categories: CategoryNode[];
}

export default function HeaderCategoryNav({
  categories,
}: HeaderCategoryNavProps) {
  const navigation: HeaderNavItem[] = [
    ...shortcuts.slice(0, 2),
    ...categories.map((category) => ({ label: category.name, href: categoryHref(category.slug) })),
    ...shortcuts.slice(2),
  ];

  return (
    <div className="border-t border-border">
      <nav aria-label="Shop categories" className="mx-auto flex max-w-[1248px] flex-wrap items-center justify-center gap-x-1 gap-y-1 px-4 py-1 lg:py-0 text-xs text-gray-900 sm:gap-x-2 sm:px-6 md:gap-x-3 lg:gap-x-5">
        {navigation.map(({ label, href, active = false }) => (
          <Link
            key={href}
            href={href}
            className={`inline-flex min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 py-1 hover:text-primary ${active ? "font-semibold" : ""}`}
          >
            {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
