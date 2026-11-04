import { redirect } from "next/navigation";

/** Backwards-compatible singular route; the canonical URL is /categories/[slug]. */
async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/categories/${encodeURIComponent(slug)}`);
}

export default Page;
