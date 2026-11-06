import { Card, CardContent, CardHeader } from "@/components/card";
import { Skeleton } from "@/components/skeleton";

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="space-y-6 pb-12">
      <span className="sr-only">Loading your profile…</span>
      <Skeleton className="h-10 w-36" />
      {["reputation", "personal-information", "password", "penalties"].map((card) => (
        <Card key={card} aria-hidden="true">
          <CardHeader><Skeleton className="h-6 w-44" /></CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: card === "personal-information" ? 6 : 2 }, (_, index) => (
              <div key={index} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-11 w-full" /></div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ProfileSkeleton;
