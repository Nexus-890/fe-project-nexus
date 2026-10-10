import { ProductGrid } from "@/ui/components/organisms/ProductGrid";

const products = [
  {
    id: "1",
    name: "Sản phẩm có giá thập phân",
    slug: "decimal-price",
    minPrice: "150000.50",
  },
  {
    id: "2",
    name: "Sản phẩm chưa có giá",
    slug: "no-price",
    minPrice: null,
  },
];

export default function CatalogPreview() {
  return (
    <main className="mx-auto max-w-[1200px] space-y-8 p-4">
      <ProductGrid products={products} />
      <ProductGrid products={[]} loading />
      <ProductGrid products={[]} />
    </main>
  );
}