"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { confirmPhoneCode, getPhoneVerification, sendPhoneCode } from "@/service/verificationService";
import { useVerificationCooldown } from "./useVerificationCooldown";

function PhoneVerificationCard({ initialPhone }: { initialPhone: string }) {
  const { sessionId, requestContext, isSessionCurrent, retryProfile } = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [message, setMessage] = useState("");
  const cooldown = useVerificationCooldown();
  const expiry = useVerificationCooldown();
  const key = queryKeys.account.phoneVerification(sessionId);
  const verification = useApiQuery({ queryKey: key, service: (signal) => getPhoneVerification({ context: requestContext, signal }), meta: { requiresAuth: true } });
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  const send = useApiMutation({
    execute: (value: string) => sendPhoneCode(value, { context: requestContext }),
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: (delivery, value) => { setSentTo(value); setCode(""); setMessage(""); cooldown.start(delivery.retryAfterSeconds); expiry.start(delivery.expiresInSeconds); },
    onError: (error) => { if (error.status === 429) cooldown.start(15 * 60); },
  });
  const confirm = useApiMutation({
    execute: (value: { phone: string; code: string }) => confirmPhoneCode(value.phone, value.code, { context: requestContext }),
    invalidateKey: [key],
    isCurrent: () => isSessionCurrent(sessionId),
  }, {
    onSuccess: async (result) => {
      if (!result.verified) { setMessage("The phone has not been verified. Request a new code and try again."); return; }
      setCode(""); setSentTo(""); setMessage("Your phone number has been verified.");
      await retryProfile();
    },
  });
  const verified = verification.data?.verified && verification.data.phone === normalized;
  const error = confirm.error || send.error;
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />Phone verification</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Confirm your phone with a one-time code. A changed phone number needs a new verification.</p>
      {verification.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading verification status…</p> : verification.error ?
        <div role="alert" className="space-y-2 text-sm"><p className="text-danger">Unable to load phone verification.</p><Button variant="outline" onClick={() => void verification.refetch()}>Retry verification status</Button></div> : <>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (!/^\+?\d{7,15}$/.test(normalized)) { setMessage("Enter a valid phone number with 7 to 15 digits and an optional leading +."); return; } if (!cooldown.remaining && !send.isPending && !confirm.isPending) send.mutate(normalized); }}>
            <div className="space-y-2"><Label htmlFor="verification-phone">Phone to verify</Label><Input className="min-h-11" id="verification-phone" type="tel" autoComplete="tel" required maxLength={22} value={phone} disabled={send.isPending || confirm.isPending} onChange={(event) => { setPhone(event.target.value); setMessage(""); send.reset(); confirm.reset(); }} /></div>
            {verified && <p role="status" className="text-sm font-medium text-success">Verified phone number</p>}
            <Button type="submit" variant="outline" className="min-h-11" disabled={Boolean(verified) || send.isPending || confirm.isPending || cooldown.remaining > 0}>
              {send.isPending ? "Sending code…" : cooldown.remaining > 0 ? `Resend in ${cooldown.remaining}s` : sentTo ? "Resend code" : "Send verification code"}
            </Button>
          </form>
          {sentTo === normalized && !verified && <form className="space-y-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (/^\d{6}$/.test(code) && expiry.remaining > 0 && !confirm.isPending && !send.isPending) confirm.mutate({ phone: sentTo, code }); }}>
            <p className="text-sm text-muted-foreground">Enter the code sent to {sentTo}. {expiry.remaining > 0 ? `It expires in ${expiry.remaining}s.` : "This code has expired. Request a new code."}</p>
            <div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><Input className="min-h-11" id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={code} disabled={confirm.isPending || send.isPending} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div>
            <Button type="submit" className="min-h-11" disabled={confirm.isPending || send.isPending || expiry.remaining === 0}>{confirm.isPending ? "Verifying…" : "Verify phone"}</Button>
          </form>}
        </>}
      {error && <p role="alert" className="text-sm text-danger">{error.status === 429 ? "Too many requests or attempts. Please wait before trying again." : error.status === 400 || error.status === 409 ? "The code was rejected. Check the code or request a new one." : "Phone verification is unavailable. Please try again."}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </CardContent>
  </Card>;
}
export default PhoneVerificationCard;
