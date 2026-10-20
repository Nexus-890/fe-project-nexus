"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ROUTES } from "@/route";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { useAccountProfile } from "./api";
import ProfileSkeleton from "@/ui/components/organisms/Account/ProfileSkeleton";
import PersonalInformationCard from "@/ui/components/organisms/Account/PersonalInformationCard";
import ReputationCard from "@/ui/components/organisms/Account/ReputationCard";
import ChangePasswordCard from "@/ui/components/organisms/Account/ChangePasswordCard";
import PenaltyHistoryCard from "@/ui/components/organisms/Account/PenaltyHistoryCard";

export default function ProfilePage() {
  const router = useRouter();
  const { user, status, accessToken, loadingProfile, profileError, reload, updateProfile } = useAccountProfile();

  useEffect(() => {
    if (status === "anonymous") router.replace(ROUTES.signIn);
  }, [router, status]);

  if (!accessToken || loadingProfile) return <ProfileSkeleton />;
  if (profileError || !user) return (
    <div className="space-y-6 pb-12">
      <h1 className="text-heading-32">Profile</h1>
      <Card><CardContent className="space-y-4" role="alert">
        <AlertCircle className="size-6 text-danger" aria-hidden="true" />
        <h2 className="text-base font-semibold">Unable to load your profile</h2>
        <p className="break-words text-sm text-muted-foreground">{profileError?.detail || "Please try again in a moment."}</p>
        <Button variant="outline" onClick={() => void reload()} className="min-h-11 px-4">Retry profile</Button>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-w-0 space-y-6 pb-12 sm:pb-16">
      <h1 className="text-heading-32">Profile</h1>
      <ReputationCard />
      <PersonalInformationCard key={user.id} user={user} onSave={updateProfile} />
      <ChangePasswordCard />
      <PenaltyHistoryCard />
    </div>
  );
}
