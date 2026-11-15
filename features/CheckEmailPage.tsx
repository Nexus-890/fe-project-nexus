"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { useApiMutation } from "@/hooks/useApi";
import { ACCOUNT_EXTENSIONS_ENABLED } from "@/configs/account";
import { resendVerificationEmail } from "@/service/verificationService";
import { useVerificationCooldown } from "./useVerificationCooldown";

function CheckEmailPage({ initialEmail = "", deliveryFailed = false }: { initialEmail?: string; deliveryFailed?: boolean }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const { remaining, start } = useVerificationCooldown(initialEmail ? 60 : 0);
  const resend = useApiMutation({ execute: (value: string) => resendVerificationEmail(value) }, {
    onSuccess: () => { start(60); setSent(true); },
    onError: (error) => { if (error.status === 429) start(60); },
  });
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto max-w-[720px] px-6 py-6"><Logo /></header>
    <main className="mx-auto max-w-[480px] space-y-6 px-6 py-10">
      <MailCheck className="size-12 text-primary" aria-hidden="true" />
      <div className="space-y-3"><h1 className="text-heading-32">{ACCOUNT_EXTENSIONS_ENABLED || deliveryFailed ? "Check your email" : "Email verification"}</h1>
        <p className="text-sm text-muted-foreground">{deliveryFailed ? "Your account was created, but we could not send the verification email. Request another email below; you do not need to register again." : ACCOUNT_EXTENSIONS_ENABLED ? "Open the verification link in your inbox to finish setting up your Nexus account. Check your spam folder too." : "Email verification is not required for this account setup. Continue to sign in."}</p></div>
      {(ACCOUNT_EXTENSIONS_ENABLED || deliveryFailed) && <>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!remaining && !resend.isPending) resend.mutate(email); }}>
        <div className="space-y-2"><Label htmlFor="verification-email">Email address</Label>
          <Input className="min-h-11" id="verification-email" type="email" required maxLength={255} autoComplete="email" value={email} disabled={resend.isPending} onChange={(event) => { setEmail(event.target.value); setSent(false); resend.reset(); }} /></div>
        <Button className="min-h-11 w-full" disabled={remaining > 0 || resend.isPending} type="submit">
          {resend.isPending ? "Sending…" : remaining > 0 ? `Resend in ${remaining}s` : "Resend verification email"}
        </Button>
      </form>
      {sent && <p role="status" className="text-sm text-success">If this account needs verification, a new link has been sent.</p>}
      {resend.error && <p role="alert" className="text-sm text-danger">{resend.error.status === 429 ? "Please wait one minute before requesting another email." : "Unable to send the email. Please try again shortly."}</p>}
      </>}
      <p className="text-sm text-muted-foreground">Already verified? <Link href="/sign-in" className="font-medium text-primary hover:underline">Continue to sign in</Link></p>
    </main>
  </div>;
}
export default CheckEmailPage;
