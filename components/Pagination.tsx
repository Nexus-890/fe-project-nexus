import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, totalPages, hrefForPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const style =
    "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-border px-3 hover:bg-muted";
  const visiblePages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav
      aria-label="Product pagination"
      className="flex max-w-full flex-wrap items-center justify-center gap-1 text-sm"
    >
      {page > 1 ? (
        <Link
          className={style}
          href={hrefForPage(page - 1)}
          rel="prev"
          aria-label="Previous"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          aria-label="Previous"
          className={`${style} text-gray-600`}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </span>
      )}
      <span
        aria-current="page"
        className="inline-flex min-h-11 items-center px-3 sm:hidden"
      >
        Page {page} of {totalPages}
      </span>
      {visiblePages.map((value, index) => (
        <span key={value} className="hidden items-center gap-1 sm:inline-flex">
          {index > 0 && value - visiblePages[index - 1] > 1 && (
            <span className="px-1 text-gray-900" aria-hidden="true">
              …
            </span>
          )}
          {value === page ? (
            <span
              aria-label={`Page ${value}`}
              aria-current="page"
              className={`${style} border-primary bg-primary text-primary-foreground hover:bg-primary`}
            >
              {value}
            </span>
          ) : (
            <Link
              className={style}
              href={hrefForPage(value)}
              aria-label={`Page ${value}`}
            >
              {value}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages ? (
        <Link
          className={style}
          href={hrefForPage(page + 1)}
          rel="next"
          aria-label="Next"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          aria-label="Next"
          className={`${style} text-gray-600`}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
