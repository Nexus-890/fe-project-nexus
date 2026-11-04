import SearchPage from "@/features/SearchPage";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function Page({ searchParams }: SearchPageProps) {
  return <SearchPage query={await searchParams} />;
}

export default Page;
