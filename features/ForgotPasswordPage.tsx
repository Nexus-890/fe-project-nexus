"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { useApiMutation } from "@/hooks/useApi";
import { requestPasswordReset } from "@/service/passwordService";
import { useVerificationCooldown } from "./useVerificationCooldown";

function ForgotPasswordPage({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const { remaining, start } = useVerificationCooldown(0);
  const send = useApiMutation({ execute: (value: string) => requestPasswordReset(value) }, {
    onSuccess: () => { start(60); setSent(true); },
  });
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto max-w-[720px] px-6 py-6"><Logo /></header>
    <main className="mx-auto max-w-[480px] space-y-6 px-6 py-10">
      <KeyRound className="size-12 text-primary" aria-hidden="true" />
      <div className="space-y-3">
        <h1 className="text-heading-32">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">Enter the email of your Nexus account. We will send you a link to choose a new password. The link works once and expires after 30 minutes.</p>
      </div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!remaining && !send.isPending) send.mutate(email); }}>
        <div className="space-y-2"><Label htmlFor="reset-email">Email address</Label>
          <Input className="min-h-11" id="reset-email" type="email" required maxLength={255} autoComplete="email" value={email} disabled={send.isPending}
            onChange={(event) => { setEmail(event.target.value); setSent(false); send.reset(); }} /></div>
        <Button className="min-h-11 w-full" disabled={remaining > 0 || send.isPending} type="submit">
          {send.isPending ? "Sending…" : remaining > 0 ? `Send again in ${remaining}s` : sent ? "Send another link" : "Send reset link"}
        </Button>
      </form>
      {sent && <p role="status" className="text-sm text-success">If an account uses this email, we have sent a reset link. Check your inbox and spam folder.</p>}
      {send.error && <p role="alert" className="text-sm text-danger">{send.error.status === 429 ? "Too many requests. Please wait a minute and try again." : "Unable to send the email right now. Please try again shortly."}</p>}
      <p className="text-sm text-muted-foreground">Remembered it? <Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
    </main>
  </div>;
}

export default ForgotPasswordPage;
