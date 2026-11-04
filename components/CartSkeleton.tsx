import { Card, CardContent } from "@/components/card";
import { Skeleton } from "@/components/skeleton";

export default function CartSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-8 pb-12 sm:px-6 lg:pt-9 lg:pb-16" role="status" aria-label="Loading cart">
      <span className="sr-only">Loading your cart…</span>
      <div className="mb-6 space-y-2" aria-hidden="true"><Skeleton className="h-10 w-24" /><Skeleton className="h-5 w-40" /></div>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8" aria-hidden="true">
        <Card className="rounded-sm"><CardContent className="space-y-5">
          <Skeleton className="h-5 w-44" />
          {[0, 1].map((index) => <div key={index} className="flex gap-4 border-t border-border pt-5"><Skeleton className="size-[72px] shrink-0 sm:size-24" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-9 w-32" /></div></div>)}
        </CardContent></Card>
        <Card className="rounded-sm"><CardContent className="space-y-5"><Skeleton className="h-6 w-36" /><Skeleton className="h-5 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
