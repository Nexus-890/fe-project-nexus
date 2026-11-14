import { Clock3, Zap } from "lucide-react";
import { formatAuctionCountdown } from "../features/auctionRoomUtils";

function AuctionCountdown({ seconds, status, extensionCount }: { seconds: number; status: string; extensionCount: number }) {
  const scheduled = status === "CREATED" || status === "SCHEDULED";
  const ending = !scheduled && status === "ACTIVE" && seconds <= 300;
  const finished = !scheduled && (status !== "ACTIVE" || seconds <= 0);
  const Icon = ending ? Zap : Clock3;
  return <div className={`flex flex-wrap items-center justify-between gap-3 rounded-sm px-4 py-4 ${ending ? "bg-danger text-white" : "bg-foreground text-background"}`}>
    <div className="flex items-center gap-3"><Icon size={18} aria-hidden="true" /><div>
      <p className="text-sm font-medium">{scheduled ? "Starts in" : finished ? "Bidding closed" : ending ? "Ending soon" : "Auction ends in"}</p>
      <p className="mt-1 text-[11px] leading-4">{extensionCount > 0 ? `End time extended · ${extensionCount} ${extensionCount === 1 ? "extension" : "extensions"}` : "Bids in the final 5 minutes extend the end time."}</p>
    </div></div>
    <span role="timer" aria-label={scheduled ? "Time until auction starts" : "Time remaining"} className="font-mono text-2xl font-semibold tabular-nums">{formatAuctionCountdown(finished ? 0 : seconds)}</span>
  </div>;
}

export default AuctionCountdown;
