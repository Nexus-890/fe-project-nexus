import MyBidsPage from "@/features/MyBidsPage";

async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MyBidsPage query={await searchParams} />;
}

export default Page;
