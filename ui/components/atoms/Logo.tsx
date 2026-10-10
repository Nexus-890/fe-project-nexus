import Link from "next/link";

export default function Logo() {
  return (
    <Link
      href="/"
      aria-label="Nexus home"
      className="inline-flex min-h-11 lg:min-h-9 shrink-0 items-center gap-2 rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span aria-hidden="true" className="relative inline-flex h-6 w-5 items-center justify-center">
        <span className="absolute left-0 h-6 w-1.5 -skew-y-12 rounded-sm bg-primary" />
        <span className="absolute left-2.5 h-4 w-1.5 skew-y-12 rounded-sm bg-gray-1000" />
      </span>
      <span className="text-2xl font-bold leading-none tracking-tight text-gray-1000">nexus</span>
    </Link>
  );
}
