import Link from "next/link";
import { Book, Camera, Gamepad, Headphones, Laptop, Shirt, Smartphone, Sofa, Star, Watch } from "lucide-react";
import { categoryHref } from "@/lib/catalog-url";

/** Fixed navigation from the home design; destination pages load real API data. */
const homeCategories = [
  { label: "Phones", slug: "phones", Icon: Smartphone },
  { label: "Laptops", slug: "laptops", Icon: Laptop },
  { label: "Cameras", slug: "cameras", Icon: Camera },
  { label: "Watches", slug: "watches", Icon: Watch },
  { label: "Audio", slug: "audio", Icon: Headphones },
  { label: "Fashion", slug: "fashion", Icon: Shirt },
  { label: "Gaming", slug: "gaming", Icon: Gamepad },
  { label: "Home", slug: "home", Icon: Sofa },
  { label: "Books", slug: "books", Icon: Book },
  { label: "Collectibles", slug: "collectibles", Icon: Star },
];

export function CategoryNavigation() {
  return (
    <section id="categories" aria-label="Categories" className="min-w-0 border-y border-border">
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <ul className="flex min-w-max py-5">
          {homeCategories.map(({ label, slug, Icon }) => (
            <li key={slug} className="min-w-[88px] flex-1">
              <Link href={categoryHref(slug)}
                className="group mx-auto flex min-h-20 w-20 flex-col items-center gap-2 rounded-sm text-center text-xs text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-background transition-colors group-hover:bg-muted">
                  <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="leading-4">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
