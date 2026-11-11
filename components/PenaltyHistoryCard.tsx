"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";

const penaltyColumns = ["Date", "Violation", "Reference", "Impact"];

function PenaltyHistoryEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-5 text-center">
      <History aria-hidden="true" className="size-5 text-muted-foreground" />
      <p className="text-sm leading-5 text-muted-foreground">
        Your penalty history will appear here when it is available.
      </p>
    </div>
  );
}

export function PenaltyHistoryCard() {
  const [sample, setSample] = useState(false);
  return (
    <Card id="penalty-history" aria-labelledby="penalty-history-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="penalty-history-title">Penalty History</CardTitle>
        <button type="button" onClick={() => setSample(!sample)} className="min-h-11 rounded-sm border border-border px-3 text-xs font-medium hover:bg-muted">{sample ? "Hide sample penalty" : "Show sample penalty"}</button>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {sample && <div className="mb-5 rounded-sm border border-border bg-muted p-4 text-sm"><p className="text-xs leading-5 text-muted-foreground">Sample preview. This is not your account history. Penalty history API is not available.</p><dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4"><div><dt className="text-muted-foreground">Date</dt><dd className="mt-1">Aug 12, 2026</dd></div><div><dt className="text-muted-foreground">Violation</dt><dd className="mt-1">Auction payment timeout</dd></div><div><dt className="text-muted-foreground">Reference</dt><dd className="mt-1 break-all font-mono">AUC-SAMPLE-118</dd></div><div><dt className="text-muted-foreground">Impact</dt><dd className="mt-1 font-medium text-danger">−10</dd></div></dl></div>}
        <table className="hidden w-full table-fixed text-left text-sm sm:table">
          <caption className="sr-only">Penalty history</caption>
          <thead>
            <tr className="border-b border-border">
              {penaltyColumns.map((label) => (
                <th key={label} scope="col" className="px-2 pb-3 text-xs font-normal text-muted-foreground first:pl-0 last:pr-0 last:text-right">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={penaltyColumns.length} className="pt-2">
                <PenaltyHistoryEmptyState />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="sm:hidden"><PenaltyHistoryEmptyState /></div>
      </CardContent>
    </Card>
  );
}

export default PenaltyHistoryCard;
