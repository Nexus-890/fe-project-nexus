"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, LockKeyhole } from "lucide-react";
import Logo from "@/components/Logo";
import { Button, buttonVariants } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { useApiMutation } from "@/hooks/useApi";
import { PASSWORD_MAX_LENGTH, RESET_TOKEN_PATTERN, confirmPasswordReset, passwordProblem } from "@/service/passwordService";

const failureMessages: Record<string, string> = {
  USER_PASSWORD_REUSED: "Choose a password that is different from your current one.",
  USER_PASSWORD_REJECTED: "This password does not meet the password rules. Use at least 8 characters.",
};

function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const reset = useApiMutation({ execute: (value: string) => confirmPasswordReset(token, value) });
  const linkInvalid = !RESET_TOKEN_PATTERN.test(token) || reset.error?.code === "USER_PASSWORD_RESET_LINK_INVALID";

  function submit() {
    const found = passwordProblem(password, confirmation);
    setProblem(found);
    if (!found && !reset.isPending) reset.mutate(password);
  }

  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto max-w-[720px] px-6 py-6"><Logo /></header>
    <main className="mx-auto max-w-[480px] space-y-6 px-6 py-10">
      {reset.isSuccess ? <>
        <CircleCheck className="size-12 text-success" aria-hidden="true" />
        <div className="space-y-3">
          <h1 className="text-heading-32">Password updated</h1>
          <p role="status" className="text-sm text-muted-foreground">Your new password is ready. For your safety we signed you out on every device.</p>
        </div>
        <Link href="/sign-in" className={`${buttonVariants()} min-h-11 w-full`}>Continue to sign in</Link>
      </> : linkInvalid ? <>
        <LockKeyhole className="size-12 text-primary" aria-hidden="true" />
        <div className="space-y-3">
          <h1 className="text-heading-32">This link no longer works</h1>
          <p role="alert" className="text-sm text-muted-foreground">The reset link is invalid, already used or expired. Request a new one to continue.</p>
        </div>
        <Link href="/forgot-password" className={`${buttonVariants()} min-h-11 w-full`}>Request a new link</Link>
      </> : <>
        <LockKeyhole className="size-12 text-primary" aria-hidden="true" />
        <div className="space-y-3">
          <h1 className="text-heading-32">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">Use at least 8 characters and do not reuse your current password.</p>
        </div>
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label>
            <Input className="min-h-11" id="new-password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={password} disabled={reset.isPending}
              aria-invalid={Boolean(problem)} aria-describedby={problem ? "reset-problem" : undefined}
              onChange={(event) => { setPassword(event.target.value); setProblem(null); reset.reset(); }} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label>
            <Input className="min-h-11" id="confirm-password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={confirmation} disabled={reset.isPending}
              aria-invalid={Boolean(problem)} aria-describedby={problem ? "reset-problem" : undefined}
              onChange={(event) => { setConfirmation(event.target.value); setProblem(null); reset.reset(); }} /></div>
          {problem && <p id="reset-problem" role="alert" className="text-sm text-danger">{problem}</p>}
          {reset.error && <p role="alert" className="text-sm text-danger">{failureMessages[reset.error.code ?? ""] ?? "Unable to update the password right now. Please try again shortly."}</p>}
          <Button className="min-h-11 w-full" disabled={reset.isPending} type="submit">{reset.isPending ? "Saving…" : "Set new password"}</Button>
        </form>
      </>}
      <p className="text-sm text-muted-foreground"><Link href="/sign-in" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
    </main>
  </div>;
}

export default ResetPasswordPage;
