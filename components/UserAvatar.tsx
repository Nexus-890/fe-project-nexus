"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { cn } from "@/components/componentUtils";

export function userAvatarInitials(fullName: string) {
  const names = fullName.trim().split(/\s+/).filter(Boolean);
  return names.slice(-2).map((name) => name[0]).join("").toLocaleUpperCase() || "N";
}

interface UserAvatarProps {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  label?: string;
}

function UserAvatar({ fullName, avatarUrl, className, fallbackClassName, label }: UserAvatarProps) {
  return (
    <Avatar className={cn("border border-border", className)} aria-label={label} aria-hidden={label ? undefined : true}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className={fallbackClassName}>{userAvatarInitials(fullName)}</AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
