import { History } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { PENALTY_LABELS, penaltyDate, penaltyImpact, penaltyReference } from "@/features/reputationFormat";
import type { Page } from "@/types/commonResponseType";
import type { Penalty } from "@/types/ratingType";

const penaltyColumns = ["Date", "Violation", "Reference", "Impact"];

interface PenaltyHistoryCardProps {
  penalties?: Page<Penalty>;
  error?: string | null;
  busy: boolean;
  onPage: (page: number) => void;
  onRetry: () => void;
}

function PenaltyHistoryMessage({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-5 text-center">
      <History aria-hidden="true" className="size-5 text-muted-foreground" />
      <p role={alert ? "alert" : "status"} className={`text-sm leading-5 ${alert ? "text-danger" : "text-muted-foreground"}`}>{text}</p>
    </div>
  );
}

export function PenaltyHistoryCard({ penalties, error, busy, onPage, onRetry }: PenaltyHistoryCardProps) {
  const rows = penalties?.content ?? [];
  const message = error ? null : !penalties ? "Loading your penalty history…"
    : rows.length === 0 ? "No penalties. Your score has never been lowered." : null;
  return (
    <Card id="penalty-history" aria-labelledby="penalty-history-title" aria-busy={busy || undefined} className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="penalty-history-title">Penalty History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {error ? (
          <div className="flex flex-col items-center gap-3">
            <PenaltyHistoryMessage text={error} alert />
            <Button variant="outline" onClick={onRetry} className="min-h-11 px-4">Retry penalty history</Button>
          </div>
        ) : message ? <PenaltyHistoryMessage text={message} /> : (
          <>
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
                {rows.map((penalty) => (
                  <tr key={penalty.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-3 pl-0 align-top">{penaltyDate(penalty.changedAt)}</td>
                    <td className="px-2 py-3 align-top">
                      <span className="block font-medium">{PENALTY_LABELS[penalty.changeType]}</span>
                      <span className="block break-words text-xs text-muted-foreground">{penalty.reason}</span>
                    </td>
                    <td className="px-2 py-3 align-top font-mono text-xs">{penaltyReference(penalty)}</td>
                    <td className="px-2 py-3 pr-0 text-right align-top font-mono text-danger">{penaltyImpact(penalty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-3 sm:hidden" aria-label="Penalty history">
              {rows.map((penalty) => (
                <li key={penalty.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{PENALTY_LABELS[penalty.changeType]}</span>
                    <span className="shrink-0 font-mono text-danger">{penaltyImpact(penalty)}</span>
                  </div>
                  <p className="break-words text-xs text-muted-foreground">{penalty.reason}</p>
                  <p className="text-xs text-muted-foreground">{penaltyDate(penalty.changedAt)} · <span className="font-mono">{penaltyReference(penalty)}</span></p>
                </li>
              ))}
            </ul>
            {penalties && penalties.totalPages > 1 && (
              <nav aria-label="Penalty history pages" className="flex items-center justify-between gap-3">
                <Button variant="outline" className="min-h-11 px-4" disabled={busy || penalties.page === 0} onClick={() => onPage(penalties.page - 1)}>Previous</Button>
                <span className="text-xs text-muted-foreground">Page {penalties.page + 1} of {penalties.totalPages}</span>
                <Button variant="outline" className="min-h-11 px-4" disabled={busy || penalties.page + 1 >= penalties.totalPages} onClick={() => onPage(penalties.page + 1)}>Next</Button>
              </nav>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PenaltyHistoryCard;
