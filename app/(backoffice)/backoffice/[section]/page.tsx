import { notFound, redirect } from "next/navigation";
async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "event-log") redirect("/backoffice/event-logs");
  notFound();
}
export default Page;
