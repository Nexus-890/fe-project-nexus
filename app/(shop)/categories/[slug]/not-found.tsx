import Link from "next/link";

export default function NotFound() {
  return <section className="mx-auto w-full max-w-[1248px] space-y-4 px-4 py-12 sm:px-6">
    <h1 className="text-heading-32">Category not found</h1>
    <p>This category does not exist.</p>
    <Link href="/" className="inline-flex min-h-11 min-w-11 items-center rounded-sm bg-primary px-4 text-primary-foreground hover:bg-primary-hover">Browse categories</Link>
  </section>;
}
