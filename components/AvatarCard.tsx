"use client";

import type { UserResponse } from "@/types/authResponseType";
import { Avatar, AvatarFallback } from "@/components/avatar";
import { Skeleton } from "@/components/skeleton";

interface AvatarCardProps {
  user: UserResponse | null;
  loading?: boolean;
}

function initials(fullName: string) {
  const names = fullName.trim().split(/\s+/).filter(Boolean);
  return names.slice(-2).map((name) => name[0]).join("").toLocaleUpperCase() || "N";
}

function AvatarCard({ user, loading = false }: AvatarCardProps) {
  if (loading) return <div aria-label="Loading account" aria-busy="true" className="flex min-w-0 items-center gap-3 px-3 py-2"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-20" /></div></div>;
  return <div aria-label="Account summary" className="flex min-w-0 items-center gap-3 px-3 py-2">
    <Avatar className="size-10 shrink-0 border border-border" aria-label={user ? `${user.fullName}'s avatar` : "Guest avatar"}><AvatarFallback>{user ? initials(user.fullName) : "N"}</AvatarFallback></Avatar>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{user?.fullName ?? "Guest account"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{user ? "Your Nexus account" : "Sign in to manage your account"}</p></div>
  </div>;
}

export default AvatarCard;
