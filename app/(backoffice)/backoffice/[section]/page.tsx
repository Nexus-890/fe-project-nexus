import { notFound, redirect } from "next/navigation";
import BackofficePlaceholderPage from "@/features/BackofficePlaceholderPage";

const titles: Record<string, string> = { orders: "Orders" };
async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "event-log") redirect("/backoffice/event-logs");
  if (!titles[section]) notFound();
  return <BackofficePlaceholderPage title={titles[section]} />;
}
export default Page;
