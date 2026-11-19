"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import type { UserResponse } from "@/types/authResponseType";
import type { ApiError } from "@/types/commonResponseType";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/card";
import { Skeleton } from "@/components/skeleton";
import { useApiMutation } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { AVATAR_TYPES, avatarFileError, removeAvatar, uploadAvatar } from "@/service/accountService";

interface AvatarCardProps {
  user: UserResponse | null;
  loading?: boolean;
}

function uploadErrorText(error: ApiError) {
  if (error.status === 413 || error.code === "USER_AVATAR_TOO_LARGE") return "The image must be 2 MB or smaller.";
  if (error.status === 415 || error.code === "USER_AVATAR_INVALID_TYPE") return "Use a JPEG, PNG or WebP image.";
  if (error.status === 503) return "Photo storage is unavailable right now. Please try again later.";
  return error.detail || "Unable to upload your photo. Please try again.";
}

function AvatarCard({ user, loading = false }: AvatarCardProps) {
  const { sessionId, requestContext, isSessionCurrent, retryProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const upload = useApiMutation({
    execute: (file: File) => uploadAvatar(file, { context: requestContext }),
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: async () => {
      await retryProfile();
      setMessage({ kind: "success", text: "Your photo has been updated." });
    },
    onError: (error) => { if (error.kind !== "aborted") setMessage({ kind: "error", text: uploadErrorText(error) }); },
  });
  const remove = useApiMutation({
    execute: () => removeAvatar({ context: requestContext }),
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: async () => {
      await retryProfile();
      setMessage({ kind: "success", text: "Your photo has been removed." });
    },
    onError: (error) => { if (error.kind !== "aborted") setMessage({ kind: "error", text: error.detail || "Unable to remove your photo. Please try again." }); },
  });
  const busy = upload.isPending || remove.isPending;

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

  function choose(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file || busy) return;
    const problem = avatarFileError(file);
    if (problem) { setMessage({ kind: "error", text: problem }); return; }
    setMessage(null);
    upload.mutate(file);
  }

  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar fullName={user.fullName} avatarUrl={user.avatarUrl} className="size-12" label={`${user.fullName}'s avatar`} />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{user.fullName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Your Nexus account</p>
          </div>
        </div>
        <div>
          <input ref={input} id="avatar-file" type="file" accept={AVATAR_TYPES.join(",")} className="sr-only" tabIndex={-1}
            aria-describedby="avatar-help" onChange={(event) => choose(event.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} aria-describedby="avatar-help"
              onClick={() => input.current?.click()} className="min-h-11 text-xs">
              {upload.isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
              {upload.isPending ? "Uploading…" : user.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {user.avatarUrl && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setMessage(null); remove.mutate(undefined); }}
                className="min-h-11 text-xs text-danger hover:text-danger">
                {remove.isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                {remove.isPending ? "Removing…" : "Remove photo"}
              </Button>
            )}
          </div>
          <p id="avatar-help" className="mt-2 text-xs leading-4 text-muted-foreground">JPEG, PNG or WebP, up to 2 MB.</p>
          {message && (
            <p role={message.kind === "error" ? "alert" : "status"}
              className={`mt-2 text-xs leading-4 ${message.kind === "error" ? "text-danger" : "text-success"}`}>{message.text}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AvatarCard;
