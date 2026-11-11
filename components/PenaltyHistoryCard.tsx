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
  return (
    <Card id="penalty-history" aria-labelledby="penalty-history-title" className="scroll-mt-6 gap-5 rounded-md">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle id="penalty-history-title">Penalty History</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
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
