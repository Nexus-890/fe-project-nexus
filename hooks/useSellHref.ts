"use client";

import { ROUTES } from "@/configs/routes";
import { readBackofficeRoles } from "@/features/backofficeAccess";
import { useAuth } from "@/hooks/useAuth";

export function useSellHref(): string {
  const auth = useAuth();
  return readBackofficeRoles(auth.accessToken).includes("SELLER") ? ROUTES.sellerProducts : ROUTES.becomeSeller;
}
