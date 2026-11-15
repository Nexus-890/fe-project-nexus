import CheckEmailPage from "@/features/CheckEmailPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string; delivery?: string }> }) {
  const { email, delivery } = await searchParams;
  return <CheckEmailPage initialEmail={typeof email === "string" ? email : ""} deliveryFailed={delivery === "failed"} />;
}
