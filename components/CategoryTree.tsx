import Link from "next/link";
import { Smartphone, Laptop, Camera, Watch, Headphones, Shirt, Gamepad2, Sofa, BookOpen, Gem, Shapes } from "lucide-react";
import type { CategoryNode } from "@/types/catalogResponseType";
import { categoryHref, searchHref, type SearchState } from "@/features/catalogUtils";

type CategoryTreeProps = {
  categories: CategoryNode[];
  depth?: number;
  activeSlug?: string;
  variant?: "tree" | "tiles";
  searchState?: SearchState;
};

const categoryIcons = { phone: Smartphone, phones: Smartphone, electronics: Laptop, laptop: Laptop, laptops: Laptop, camera: Camera, cameras: Camera, watch: Watch, watches: Watch, audio: Headphones, headphones: Headphones, fashion: Shirt, gaming: Gamepad2, game: Gamepad2, home: Sofa, "home-garden": Sofa, book: BookOpen, books: BookOpen, collectible: Gem, collectibles: Gem };

function CategoryIcon({ slug }: { slug: string }) {
  const Icon = categoryIcons[slug.toLowerCase() as keyof typeof categoryIcons] ?? Shapes;
  return (
    <span aria-hidden="true" className="grid size-11 place-items-center rounded-sm border border-border bg-card text-muted-foreground">
      <Icon size={22} />
    </span>
  );
}

export function CategoryTree({
  categories,
  depth = 0,
  activeSlug,
  variant = "tree",
  searchState,
}: CategoryTreeProps) {
  if (!categories.length || depth >= 3) return null;
  const tiles = variant === "tiles" && depth === 0;
  return (
    <ul
      className={
        tiles
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8"
          : depth === 0
            ? "space-y-2"
            : "ml-4 border-l border-border pl-3"
      }
    >
      {categories.map((category) => (
        <li key={category.id} className="min-w-0">
          <Link
            href={searchState ? searchHref({ ...searchState, category: category.slug, page: 1 }) : categoryHref(category.slug)}
            aria-current={activeSlug === category.slug ? "page" : undefined}
            className={`flex min-h-11 min-w-11 items-center rounded-md px-3 py-2 text-sm [overflow-wrap:anywhere] hover:bg-muted ${tiles ? "min-h-24 flex-col justify-center gap-2 bg-card text-center" : ""} ${depth === 0 ? "font-medium" : ""} ${activeSlug === category.slug ? "bg-muted text-primary" : ""}`}
          >
            {tiles ? <CategoryIcon slug={category.slug} /> : null}
            {category.name}
          </Link>
          {variant === "tree" ? <CategoryTree
            categories={category.children}
            depth={depth + 1}
            activeSlug={activeSlug}
            searchState={searchState}
          /> : null}
        </li>
      ))}
    </ul>
  );
}
