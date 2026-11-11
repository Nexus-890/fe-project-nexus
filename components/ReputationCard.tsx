"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";

const reputationLevels = [
  { label: "New", score: 0 },
  { label: "Standard", score: 40 },
  { label: "Trusted", score: 70 },
  { label: "Top Seller", score: 90 },
];

const reputationStats = [
  "Transactions",
  "Successful",
  "Failed",
  "Auctions won",
  "Avg rating",
];

export function ReputationCard() {
  const [sample, setSample] = useState(false);
  return (
    <Card id="reputation" aria-labelledby="reputation-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <CardTitle id="reputation-title">Reputation</CardTitle>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          {sample ? "Sample · Trusted · 78" : "Not available"}
        </span>
      </CardHeader>
      <CardContent className="space-y-5 px-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
          <div className="shrink-0" aria-label={sample ? "Sample reputation score 78" : "Reputation score not available"}>
            <p aria-hidden="true" className="text-5xl font-semibold leading-none tracking-tight">{sample ? "78" : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
          </div>
          <div className="min-w-0 flex-1">
            <div aria-hidden="true" className="h-1.5 rounded-full bg-secondary">{sample && <div className="h-full w-[78%] rounded-full bg-info" />}</div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
              {reputationLevels.map(({ label, score }) => (
                <li key={label} className="sm:last:text-right">
                  {label} <span className="font-mono">{score}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Bidding unlocks at 40. Creating auctions unlocks at 50.
            </p>
          </div>
        </div>
        <p className="text-sm leading-5 text-muted-foreground">
          {sample ? "Sample preview only. These values do not describe your account. The reputation API is not available." : "Your reputation will appear here when it is available."}
        </p>
        <button type="button" onClick={() => setSample(!sample)} className="min-h-11 rounded-sm border border-border px-3 text-xs font-medium hover:bg-muted">{sample ? "Hide sample reputation" : "Show sample reputation"}</button>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-5">
          {reputationStats.map((label, index) => (
            <div key={label} className="flex min-w-0 flex-col">
              <dt className="mt-1 text-xs leading-5 text-muted-foreground">{label}</dt>
              <dd className="-order-1 text-xl font-semibold leading-7" aria-label={`${label} ${sample ? "sample" : "not available"}`}>{sample ? ["42", "40", "2", "9", "4.9"][index] : "—"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export default ReputationCard;
