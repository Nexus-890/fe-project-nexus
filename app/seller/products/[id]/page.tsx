import SellerProductEditorPage from "../../../../features/SellerProductEditorPage";

async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return <SellerProductEditorPage productId={id} />;
}
export default Page;
