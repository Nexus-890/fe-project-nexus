import ForgotPasswordPage from "@/features/ForgotPasswordPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <ForgotPasswordPage initialEmail={typeof email === "string" ? email : ""} />;
}
