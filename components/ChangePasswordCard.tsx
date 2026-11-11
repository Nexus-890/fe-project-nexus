import { Button } from "@/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";

const passwordFields = [
  { id: "current-password", label: "Current Password", autoComplete: "current-password" },
  { id: "new-password", label: "New Password", autoComplete: "new-password" },
  { id: "confirm-password", label: "Confirm New Password", autoComplete: "new-password" },
];

export function ChangePasswordCard() {
  return (
    <Card id="security" aria-labelledby="security-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="security-title">Change Password</CardTitle>
        <CardDescription id="password-availability">Password updates are coming soon.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          {passwordFields.map(({ id, label, autoComplete }) => (
            <div key={id} className="min-w-0 space-y-2">
              <Label htmlFor={id} className="text-sm font-normal leading-5 text-muted-foreground">{label}</Label>
              <Input
                id={id}
                name={id}
                type="password"
                autoComplete={autoComplete}
                aria-describedby="password-availability"
                disabled
                className="h-10 rounded-md px-3 text-sm"
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" disabled aria-describedby="password-availability" className="h-10 rounded-md px-4">
          Update Password
        </Button>
      </CardContent>
    </Card>
  );
}

export default ChangePasswordCard;
