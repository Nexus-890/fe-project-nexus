"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { ROUTES } from "@/configs/routes";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
import { useAuth } from "@/hooks/useAuth";
import { useApiQuery } from "@/hooks/useApi";
import { queryKeys } from "@/configs/queryKeys";
import { getMyPenalties, getMyReputation } from "@/service/ratingService";
import type { ApiError } from "@/types/commonResponseType";
import ProfileSkeleton from "@/components/ProfileSkeleton";
import PersonalInformationCard from "@/components/PersonalInformationCard";
import MyReputation from "./MyReputation";
import ReputationCard from "@/components/ReputationCard";
import PenaltyHistoryCard from "@/components/PenaltyHistoryCard";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import PhoneVerificationCard from "@/features/PhoneVerificationCard";
import { ACCOUNT_EXTENSIONS_ENABLED } from "@/configs/account";

function ProfilePage() {
  const router = useRouter();
  const { user, status, accessToken, sessionId, requestContext, isSessionCurrent, retryProfile, updateProfile } = useAuth();
  const profileReady = Boolean(accessToken) && (status === "authenticated" || status === "error");
  const [penaltyPage, setPenaltyPage] = useState(0);
  const reputation = useApiQuery({
    queryKey: queryKeys.account.reputation(sessionId),
    meta: { requiresAuth: true },
    service: (signal) => getMyReputation({ context: requestContext, signal }),
  }, { enabled: profileReady });
  const penalties = useApiQuery({
    queryKey: queryKeys.account.penalties(sessionId, penaltyPage),
    meta: { requiresAuth: true },
    service: (signal) => getMyPenalties(penaltyPage, { context: requestContext, signal }),
  }, { enabled: profileReady, placeholderData: (previous) => previous });
  const [load, setLoad] = useState<{
    sessionId: number;
    pending: boolean;
    error: ApiError | null;
  }>({ sessionId, pending: true, error: null });

  // Revalidate once this session is ready. Token rotation must not refetch the
  // profile and replace an in-progress form if that unrelated read fails.
  useEffect(() => {
    if (!profileReady) return;
    let active = true;
    void retryProfile().then((result) => {
      if (active && isSessionCurrent(sessionId)) {
        setLoad({ sessionId, pending: false, error: result.ok ? null : result.error });
      }
    });
    return () => { active = false; };
  }, [profileReady, sessionId, isSessionCurrent, retryProfile]);

  async function reload() {
    setLoad({ sessionId, pending: true, error: null });
    const result = await retryProfile();
    if (isSessionCurrent(sessionId)) {
      setLoad({ sessionId, pending: false, error: result.ok ? null : result.error });
    }
  }

  useEffect(() => {
    if (status === "anonymous") router.replace(`${ROUTES.signIn}?returnTo=%2Fprofile`);
  }, [router, status]);

  const profileError = load.error;
  if (!profileReady || load.sessionId !== sessionId || load.pending) return <ProfileSkeleton />;
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
      <ReputationCard reputation={reputation.data}
        error={reputation.isError && !reputation.data ? reputation.error.detail || "Unable to load your reputation." : null}
        onRetry={() => void reputation.refetch()} />
      <Link href="/ratings" className="inline-flex min-h-11 items-center text-sm text-primary underline">View ratings received and submit a dispute</Link>
      <PersonalInformationCard key={`${sessionId}:${user.id}`} user={user} onSave={updateProfile} />
      {ACCOUNT_EXTENSIONS_ENABLED && <PhoneVerificationCard key={`phone:${sessionId}:${user.phone}`} initialPhone={user.phone} />}
      <ChangePasswordCard />
      <PenaltyHistoryCard penalties={penalties.data} busy={penalties.isFetching}
        error={penalties.isError ? penalties.error.detail || "Unable to load your penalty history." : null}
        onPage={setPenaltyPage} onRetry={() => void penalties.refetch()} />
      <MyReputation key={`restrictions:${sessionId}:${user.id}`} restrictionsOnly />
    </div>
  );
}

export default ProfilePage;
