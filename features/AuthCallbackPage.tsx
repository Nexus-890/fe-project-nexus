"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { Button } from "@/components/button";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";

function AuthCallbackPage() {
  const router = useRouter();
  const { completeSignIn, status } = useAuth();
  const { ready: cartReady } = useGuestCart();
  const callbackUrl = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Keep the original callback after the provider removes the code from history.
    callbackUrl.current ??= window.location.href;
    void completeSignIn(callbackUrl.current).then((result) => {
      if (!active) return;
      if (result.ok) setDestination(result.data);
      else setFailed(true);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [completeSignIn, router]);

  useEffect(() => {
    // The globally mounted cart provider shares one merge attempt, including
    // StrictMode replays. Resolve the cart before returning to the shop.
    if (destination && status === "authenticated" && cartReady) router.replace(destination);
  }, [destination, status, cartReady, router]);

  async function retry() {
    if (!callbackUrl.current) return;
    setRetrying(true);
    try {
      const result = await completeSignIn(callbackUrl.current);
      if (result.ok) { setFailed(false); setDestination(result.data); }
    } catch {
      setFailed(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="mx-auto w-full max-w-[400px] px-6 py-6 sm:px-10"><Logo /></header>
      <main className="mx-auto w-full max-w-[400px] px-6 pb-10 sm:px-10">
        <h1 className="text-heading-24">{failed ? "Unable to finish signing in" : "Signing you in"}</h1>
        {failed ? (
          <>
            <p role="alert" className="mt-4 text-sm text-danger">Your sign-in could not be completed. Please try again.</p>
            {status === "error" || retrying ? (
              <Button type="button" onClick={() => void retry()} disabled={retrying} className="mt-5 min-h-11 w-full">
                {retrying ? "Loading account…" : "Retry loading account"}
              </Button>
            ) : null}
            <Link href="/sign-in" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Back to sign in</Link>
          </>
        ) : <p role="status" className="mt-4 text-sm text-muted-foreground">Please wait while we open your account.</p>}
      </main>
    </div>
  );
}

export default AuthCallbackPage;
