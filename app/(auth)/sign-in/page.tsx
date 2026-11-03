import { Suspense } from "react";
import SignInPage from "@/features/auth/sign-in/SignInPage";

export default function Page() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm">Loading sign-in…</p>}>
      <SignInPage />
    </Suspense>
  );
}
