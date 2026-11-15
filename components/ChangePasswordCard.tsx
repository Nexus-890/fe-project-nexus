"use client";

import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card";
import { createPasswordAccountUrl } from "@/features/oidc";

export function ChangePasswordCard() {
  const [error, setError] = useState(false);

  function changePassword() {
    setError(false);
    try {
      window.location.assign(createPasswordAccountUrl(window.location.origin));
    } catch {
      setError(true);
    }
  }

  return (
    <Card id="security" aria-labelledby="security-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="security-title">Change Password</CardTitle>
        <CardDescription id="password-availability">Manage your password securely with your Nexus account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Open account security, choose Update next to Password, then use Back to Nexus Web to return to your profile.</p>
        </div>
        {error && <p role="alert" className="text-sm text-danger">Unable to open account security. Please try again or contact support.</p>}
        <Button type="button" variant="outline" onClick={changePassword} aria-describedby="password-availability" className="min-h-11 rounded-md px-4">
          Change password <ArrowUpRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default ChangePasswordCard;
