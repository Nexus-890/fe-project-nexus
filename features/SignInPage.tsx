"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readBackofficeRoles, resolveRoleLanding } from "./backofficeAccess";
import { Button } from "@/components/button";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const { signIn, status, accessToken } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(resolveRoleLanding(searchParams.get("returnTo"), readBackofficeRoles(accessToken)));
  }, [status, router, searchParams, accessToken]);

  if (status === "restoring" || status === "authenticated") {
    return <main className="mx-auto w-full max-w-[400px] px-6 py-12" role="status">
      {status === "restoring" ? "Restoring your session…" : "Opening your account…"}
    </main>;
  }

  async function submit() {
    setFormError(null);
    setRedirecting(true);
    try {
      const result = await signIn(searchParams.get("returnTo") ?? undefined);
      if (!result.ok) {
        setFormError("Unable to open the sign-in page. Please try again.");
        setRedirecting(false);
      }
    } catch {
      setFormError("Unable to open the sign-in page. Please try again.");
      setRedirecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="mx-auto flex w-full max-w-[400px] justify-start px-6 py-6 sm:px-10">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[400px] flex-col px-6 pb-10 sm:px-10">
        <section aria-labelledby="sign-in-title" className="w-full">
          <h1 id="sign-in-title" className="text-heading-32 text-left">Sign in</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Continue to the secure sign-in page to access your Nexus account.
          </p>

          {formError ? <p role="alert" className="mt-5 rounded-md border border-danger/40 bg-red-100 px-3 py-2 text-sm text-danger">{formError}</p> : null}

          <Button type="button" onClick={() => void submit()} disabled={redirecting} size="lg" className="mt-5 h-11 w-full rounded-md px-4 text-sm font-semibold">
            {redirecting ? "Opening sign-in…" : "Continue to sign in"}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">Don&apos;t have an account? <Link href="/sign-up" className="text-primary hover:underline">Sign Up</Link></p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-[400px] px-6 pb-6 text-xs text-muted-foreground sm:px-10">© 2026 Nexus · Terms · Privacy</footer>
    </div>
  );
}
