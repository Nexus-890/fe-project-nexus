"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ROUTES } from "@/configs/routes";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
import { useAuth } from "@/hooks/useAuth";
import type { ApiError } from "@/types/commonResponseType";
import ProfileSkeleton from "@/components/ProfileSkeleton";
import PersonalInformationCard from "@/components/PersonalInformationCard";
import ReputationCard from "@/components/ReputationCard";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import PenaltyHistoryCard from "@/components/PenaltyHistoryCard";

function ProfilePage() {
  const router = useRouter();
  const { user, status, accessToken, retryProfile, updateProfile } = useAuth();
  const [load, setLoad] = useState<{ pending: boolean; error: ApiError | null }>({ pending: true, error: null });

  // Revalidate the provider's shared /me query on entry; the header and form
  // continue to read one profile cache rather than separate account data.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void retryProfile().then((result) => {
      if (active) setLoad({ pending: false, error: result.ok ? null : result.error });
    });
    return () => { active = false; };
  }, [accessToken, retryProfile]);

  const reload = useCallback(async () => {
    setLoad({ pending: true, error: null });
    const result = await retryProfile();
    setLoad({ pending: false, error: result.ok ? null : result.error });
  }, [retryProfile]);
  const loadingProfile = load.pending;
  const profileError = load.error;

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

export default ProfilePage;
