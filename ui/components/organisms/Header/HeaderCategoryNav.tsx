import Link from "next/link";
import { HEADER_CATEGORY_SHORTCUTS } from "@/route";

export default function HeaderCategoryNav() {
  return (
    <div className="min-w-0 border-t border-border">
      <nav aria-label="Shop categories" className="mx-auto flex max-w-[1248px] flex-nowrap items-center gap-3 overflow-x-auto overscroll-x-contain px-4 py-1 text-xs text-gray-900 [scrollbar-width:thin] sm:gap-4 sm:px-6 lg:justify-center lg:gap-5 lg:py-0">
        {HEADER_CATEGORY_SHORTCUTS.map(({ label, href, active = false }) => (
          <Link
            key={href}
            href={href}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-9 ${active ? "font-semibold" : ""}`}
          >
            {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
