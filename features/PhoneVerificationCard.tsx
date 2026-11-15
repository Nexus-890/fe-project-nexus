"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { createInvalidResponseError } from "@/configs/api";
import { useApiMutation } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { confirmPhoneCode, sendPhoneCode } from "@/service/verificationService";
import { useVerificationCooldown } from "./useVerificationCooldown";

function PhoneVerificationCard({ initialPhone }: { initialPhone: string }) {
  const { user, sessionId, requestContext, isSessionCurrent, retryProfile, updateProfile } = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [message, setMessage] = useState("");
  const cooldown = useVerificationCooldown();
  const expiry = useVerificationCooldown();
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  const send = useApiMutation({
    execute: async () => {
      const result = await sendPhoneCode({ context: requestContext });
      if (result.phone !== user?.phone) throw createInvalidResponseError("Phone challenge does not match the current profile.");
      return result;
    },
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: (delivery) => { confirm.reset(); setSentTo(delivery.phone); setCode(""); setMessage(""); cooldown.start(60); expiry.startUntil(delivery.expiresAt); },
    onError: (error) => { if (error.status === 429) cooldown.start(15 * 60); },
  });
  const confirm = useApiMutation({
    execute: async (value: { phone: string; code: string }) => {
      const result = await confirmPhoneCode(value.code, { context: requestContext });
      if (result.phone !== value.phone) throw createInvalidResponseError("Verified phone does not match the challenge.");
      return result;
    },
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: async () => {
      setCode(""); setSentTo(""); setMessage("Your phone number has been verified.");
      await retryProfile();
    },
  });
  const save = useApiMutation({ execute: async (value: string) => {
    const result = await updateProfile({ phone: value });
    if (!result.ok) throw result.error;
    return result.data;
  }, isCurrent: () => isSessionCurrent(sessionId) });
  const verified = Boolean(user?.phoneVerifiedAt && user.phone === normalized);
  const changed = normalized !== user?.phone;
  const error = save.error || confirm.error || send.error;
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />Phone verification</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Confirm your phone with a one-time code. A changed phone number needs a new verification.</p>
      <>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!/^\+?\d{7,15}$/.test(normalized)) { setMessage("Enter a valid phone number with 7 to 15 digits and an optional leading +."); return; } if (save.isPending || send.isPending || confirm.isPending) return; if (changed) { save.mutate(normalized); return; } if (!cooldown.remaining) send.mutate(undefined); }}>
            <div className="space-y-2"><Label htmlFor="verification-phone">Phone to verify</Label><Input className="min-h-11" id="verification-phone" type="tel" autoComplete="tel" required maxLength={22} value={phone} disabled={save.isPending || send.isPending || confirm.isPending} onChange={(event) => { setPhone(event.target.value); setMessage(""); send.reset(); confirm.reset(); }} /></div>
            {verified && <p role="status" className="text-sm font-medium text-success">Verified phone number</p>}
            <Button type="submit" variant="outline" className="min-h-11" disabled={Boolean(verified) || save.isPending || send.isPending || confirm.isPending || (!changed && cooldown.remaining > 0)}>
              {save.isPending ? "Saving phone…" : changed ? "Save phone number" : send.isPending ? "Sending code…" : cooldown.remaining > 0 ? `Resend in ${cooldown.remaining}s` : sentTo ? "Resend code" : "Send verification code"}
            </Button>
          </form>
          {sentTo === normalized && !verified && <form className="space-y-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (/^\d{6}$/.test(code) && expiry.remaining > 0 && !confirm.isPending && !send.isPending) confirm.mutate({ phone: sentTo, code }); }}>
            <p className="text-sm text-muted-foreground">Enter the code sent to {sentTo}. {expiry.remaining > 0 ? `It expires in ${expiry.remaining}s.` : "This code has expired. Request a new code."}</p>
            <div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><Input className="min-h-11" id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={code} disabled={confirm.isPending || send.isPending} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div>
            <Button type="submit" className="min-h-11" disabled={confirm.isPending || send.isPending || expiry.remaining === 0}>{confirm.isPending ? "Verifying…" : "Verify phone"}</Button>
          </form>}
        </>
      {error && <p role="alert" className="text-sm text-danger">{save.error ? save.error.code === "USER_PHONE_ALREADY_USED" ? "This phone number is already in use. Choose another number." : save.error.detail || "Unable to save your phone number. Please try again." : error.status === 429 ? "Too many requests or attempts. Please wait before trying again." : error.status === 400 || error.status === 409 ? "The code was rejected. Check the code or request a new one." : "Phone verification is unavailable. Please try again."}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </CardContent>
  </Card>;
}
export default PhoneVerificationCard;
