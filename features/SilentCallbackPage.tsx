"use client";

import { useEffect, useRef } from "react";
import { createOidcClient } from "./oidc";

/** This route runs inside the silent authorization iframe, never the sign-in UI. */
export default function SilentCallbackPage() {
  const completion = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (window.parent === window || completion.current) return;
    const url = window.location.href;
    window.history.replaceState(window.history.state, "", "/auth/silent");
    completion.current = createOidcClient().completeSilentSignIn(url).catch(() => {
      // The parent owns the request timeout and safe anonymous fallback.
      // Provider response URLs and tokens must never enter logs or UI errors.
    });
  }, []);

  return <p role="status">Completing session check…</p>;
}
