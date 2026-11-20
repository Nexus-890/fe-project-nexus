"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { useApiMutation } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { PASSWORD_MAX_LENGTH, changePassword, passwordProblem } from "@/service/passwordService";
import type { ApiError } from "@/types/commonResponseType";

type Feedback = { field: "current" | "new" | null; text: string };

function failure(error: ApiError): Feedback {
  if (error.code === "USER_CURRENT_PASSWORD_INCORRECT") return { field: "current", text: "The current password is incorrect." };
  if (error.code === "USER_PASSWORD_REUSED") return { field: "new", text: "Choose a password that is different from your current one." };
  if (error.code === "USER_PASSWORD_REJECTED") return { field: "new", text: "This password does not meet the password rules. Use at least 8 characters with a number and a symbol." };
  if (error.status === 429) return { field: null, text: "Too many attempts. Please wait a moment and try again." };
  return { field: null, text: "Unable to change your password right now. Please try again shortly." };
}

export function ChangePasswordCard() {
  const { sessionId, requestContext, isSessionCurrent } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const change = useApiMutation({
    execute: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword, { context: requestContext }),
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: () => { setCurrent(""); setNext(""); setConfirmation(""); setDone(true); },
    onError: (error) => { if (error.kind !== "aborted") setProblem(failure(error)); },
  });

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setProblem(null);
    setDone(false);
  }

  function submit() {
    if (change.isPending) return;
    if (!current) return setProblem({ field: "current", text: "Enter your current password." });
    const found = passwordProblem(next, confirmation);
    if (found) return setProblem({ field: "new", text: found });
    if (next === current) return setProblem({ field: "new", text: "Choose a password that is different from your current one." });
    change.mutate({ currentPassword: current, newPassword: next });
  }

  const describedBy = (field: Feedback["field"]) => problem && problem.field === field ? "password-problem" : undefined;

  return (
    <Card id="security" aria-labelledby="security-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="security-title">Change Password</CardTitle>
        <CardDescription>Use at least 8 characters with a number and a symbol. Other devices are signed out after the change; this one stays signed in.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="space-y-2"><Label htmlFor="current-password">Current password</Label>
            <Input className="min-h-11" id="current-password" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH}
              value={current} disabled={change.isPending} aria-invalid={problem?.field === "current"} aria-describedby={describedBy("current")}
              onChange={(event) => edit(setCurrent, event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="new-account-password">New password</Label>
              <Input className="min-h-11" id="new-account-password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH}
                value={next} disabled={change.isPending} aria-invalid={problem?.field === "new"} aria-describedby={describedBy("new")}
                onChange={(event) => edit(setNext, event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-account-password">Confirm new password</Label>
              <Input className="min-h-11" id="confirm-account-password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH}
                value={confirmation} disabled={change.isPending} aria-invalid={problem?.field === "new"} aria-describedby={describedBy("new")}
                onChange={(event) => edit(setConfirmation, event.target.value)} /></div>
          </div>
          {problem && <p id="password-problem" role="alert" className="text-sm text-danger">{problem.text}</p>}
          {done && <p role="status" className="text-sm text-success">Your password has been changed. Other devices have been signed out.</p>}
          <Button type="submit" disabled={change.isPending} className="min-h-11 rounded-md px-4">
            {change.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default ChangePasswordCard;
