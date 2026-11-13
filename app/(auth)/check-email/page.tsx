import CheckEmailPage from "@/features/CheckEmailPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <CheckEmailPage initialEmail={typeof email === "string" ? email : ""} />;
}
