import ProductDetailPage from "@/features/catalog/ProductDetailPage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const productId = Array.isArray(query.id) ? query.id[0] : query.id;
  return <ProductDetailPage slug={slug} productId={productId} />;
}
