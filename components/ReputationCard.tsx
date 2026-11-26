import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { REPUTATION_LEVELS, TRUST_LEVEL_LABELS, averageRatingText } from "@/features/reputationFormat";
import type { MyReputation } from "@/types/ratingType";

interface ReputationCardProps {
  reputation?: MyReputation;
  error?: string | null;
  onRetry: () => void;
}

export function ReputationCard({ reputation, error, onRetry }: ReputationCardProps) {
  const stats = reputation ? [
    { label: "Transactions", value: String(reputation.totalTransaction) },
    { label: "Successful", value: String(reputation.successfulTransaction) },
    { label: "Failed", value: String(reputation.failedTransaction) },
    { label: "Auctions won", value: String(reputation.successfulAuctions) },
    { label: "Avg rating", value: averageRatingText(reputation.averageRating) },
  ] : [];
  return (
    <Card id="reputation" aria-labelledby="reputation-title" aria-busy={!reputation && !error ? true : undefined} className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <CardTitle id="reputation-title">Reputation</CardTitle>
        {reputation && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {TRUST_LEVEL_LABELS[reputation.trustLevel]}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-5 px-4 sm:px-6">
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm leading-5 text-danger">{error}</p>
            <Button variant="outline" onClick={onRetry} className="min-h-11 px-4">Retry reputation</Button>
          </div>
        ) : !reputation ? (
          <p role="status" className="text-sm leading-5 text-muted-foreground">Loading your reputation…</p>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
              <div className="shrink-0">
                <p className="text-5xl font-semibold leading-none tracking-tight" aria-label={`Reputation score ${reputation.score} out of 100`}>{reputation.score}</p>
                <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
              </div>
              <div className="min-w-0 flex-1">
                <div role="meter" aria-label="Reputation score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reputation.score}
                  className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${reputation.score}%` }} />
                </div>
                <ul aria-label="Reputation thresholds" className="relative mt-1 h-9 text-xs text-muted-foreground lg:h-4">
                  {REPUTATION_LEVELS.map(({ label, score }) => (
                    <li key={label} style={{ left: `${score}%` }}
                      className="absolute top-0 -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:top-5 lg:last:top-0">
                      {label} <span className="font-mono">{score}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Bidding unlocks at 40. Creating auctions unlocks at 50.
                  {reputation.trustLevel === "NEW" && " You stay New until your first transaction or rating."}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-5">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex min-w-0 flex-col">
                  <dt className="mt-1 text-xs leading-5 text-muted-foreground">{label}</dt>
                  <dd className="-order-1 text-xl font-semibold leading-7">{value}</dd>
                </div>
              ))}
            </dl>
            {reputation.penaltyCount > 0 && (
              <p className="text-sm leading-5 text-muted-foreground">
                {reputation.penaltyCount === 1 ? "1 entry lowered your score." : `${reputation.penaltyCount} entries lowered your score.`}{" "}
                <a href="#penalty-history" className="text-primary underline-offset-4 hover:underline">See penalty history</a>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ReputationCard;
