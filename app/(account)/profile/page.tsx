import type { Metadata } from "next";
import ProfilePage from "@/features/ProfilePage";

export const metadata: Metadata = { title: "Profile | Nexus" };

export default function Page() {
  return <ProfilePage />;
}
