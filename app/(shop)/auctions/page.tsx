import AuctionsPage from "@/features/AuctionsPage";

async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuctionsPage query={await searchParams} />;
}

export default Page;
