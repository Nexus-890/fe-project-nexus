"use client";

import { Upload } from "lucide-react";
import type { UserResponse } from "@/types/authResponseType";
import { Avatar, AvatarFallback } from "@/components/avatar";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
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
  if (loading || !user) {
    return (
      <Card aria-label="Loading account" aria-busy="true" className="gap-0 py-5">
        <CardContent className="space-y-4 px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 border border-border" aria-label={`${user.fullName}'s avatar`}>
            <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{user.fullName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Your Nexus account</p>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" disabled aria-describedby="avatar-availability" className="min-h-11 text-xs">
              <Upload className="size-3.5" aria-hidden="true" /> Upload photo
            </Button>
            <Button type="button" variant="ghost" disabled aria-describedby="avatar-availability" className="min-h-11 text-xs">Remove</Button>
          </div>
          <p id="avatar-availability" className="mt-2 text-xs leading-4 text-muted-foreground">Photo updates will be available soon.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AvatarCard;
