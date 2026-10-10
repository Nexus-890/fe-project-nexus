import Link from "next/link";
import type { CategoryTreeProps } from "@/types/ui/type";
import { categoryHref } from "@/lib/catalog-url";

const categoryIcons: Record<string, string> = {
  phone: "▯",
  phones: "▯",
  laptop: "▱",
  laptops: "▱",
  camera: "◉",
  cameras: "◉",
  watch: "◌",
  watches: "◌",
  audio: "◖",
  fashion: "◇",
  gaming: "▣",
  game: "▣",
  home: "⌂",
  "home-garden": "⌂",
  book: "▤",
  books: "▤",
  collectible: "☆",
  collectibles: "☆",
};

function iconForCategory(slug: string): string {
  return categoryIcons[slug.toLowerCase()] ?? "•";
}

function CategoryIcon({ slug }: { slug: string }) {
  return <span aria-hidden="true" className="text-xl leading-none">{iconForCategory(slug)}</span>;
}

export function CategoryTree({ categories, depth = 0, activeSlug, variant = "tree" }: CategoryTreeProps) {
  if (!categories.length || depth >= 3) return null;
  const tiles = variant === "tiles" && depth === 0;
  return (
    <ul className={tiles ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" : depth === 0 ? "space-y-2" : "ml-4 border-l border-border pl-3"}>
      {categories.map((category) => (
        <li key={category.id} className="min-w-0">
          <Link href={categoryHref(category.slug)} aria-current={activeSlug === category.slug ? "page" : undefined}
            className={`flex min-h-11 min-w-11 items-center rounded-md px-3 py-2 text-sm [overflow-wrap:anywhere] hover:bg-muted ${tiles ? "min-h-24 flex-col justify-center gap-2 border border-border bg-card text-center shadow-sm" : ""} ${depth === 0 ? "font-semibold" : ""} ${activeSlug === category.slug ? "bg-muted text-primary" : ""}`}>
            {tiles ? <CategoryIcon slug={category.slug} /> : null}
            {category.name}
          </Link>
          <CategoryTree categories={category.children} depth={depth + 1} activeSlug={activeSlug} variant={variant} />
        </li>
      ))}
    </ul>
  );
}
