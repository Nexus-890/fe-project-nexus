"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import type { ApiError } from "@/types/common/response/type";

/** Revalidate the shared /me query on entry so the form and header use the same profile. */
export function useAccountProfile() {
  const auth = useAuth();
  const { accessToken, retryProfile } = auth;
  const [load, setLoad] = useState<{ pending: boolean; error: ApiError | null }>({ pending: true, error: null });

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

  return { ...auth, loadingProfile: load.pending, profileError: load.error, reload };
}
