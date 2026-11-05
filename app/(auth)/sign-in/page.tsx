import { Suspense } from "react";
import SignInPage from "@/features/SignInPage";

function Page() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm">Loading sign-in…</p>}>
      <SignInPage />
    </Suspense>
  );
}

export default Page;
