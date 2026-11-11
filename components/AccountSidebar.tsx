"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAVIGATION } from "@/configs/routes";
import type { UserResponse } from "@/types/authResponseType";
import { cn } from "@/components/componentUtils";
import AvatarCard from "./AvatarCard";

interface AccountSidebarProps {
  user: UserResponse | null;
  loading?: boolean;
}

function AccountSidebar({ user, loading }: AccountSidebarProps) {
  const pathname = usePathname();

  return (
    <aside aria-label="Your account" className="min-w-0 space-y-5">
      <AvatarCard user={user} loading={loading} />
      <nav aria-label="Account navigation">
        <ul className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {ACCOUNT_NAVIGATION.map(({ id, label, icon: Icon, href }) => {
            const active = href === pathname || (href === "/orders" && pathname.startsWith("/orders/")) || (href === "/notifications" && pathname.startsWith("/notifications/"));
            const className = cn(
              "flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm leading-5",
              active ? "bg-primary/5 font-medium text-primary" : "text-gray-900",
            );

            return (
              <li key={id} className="min-w-0">
                {href ? (
                  <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, "hover:bg-muted hover:text-primary")}>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{label}</span>
                  </Link>
                ) : (
                  <span aria-disabled="true" className={cn(className, "text-muted-foreground")}>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{label}<span className="block text-[11px] leading-4">Coming soon</span></span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default AccountSidebar;
