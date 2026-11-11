import { notFound } from "next/navigation";
import BackofficePlaceholderPage from "@/features/BackofficePlaceholderPage";

const titles: Record<string, string> = { users: "Users", categories: "Categories", orders: "Orders", "event-log": "Event log", health: "Health", configuration: "Configuration" };
async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!titles[section]) notFound(); return <BackofficePlaceholderPage title={titles[section]} />; }
export default Page;
