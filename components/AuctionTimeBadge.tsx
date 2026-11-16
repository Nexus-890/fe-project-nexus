import { Clock3, Zap } from "lucide-react";
import { formatAuctionCountdown } from "../features/auctionRoomUtils";

function AuctionTimeBadge({ startAt, endAt, status, now }: {
  startAt: string;
  endAt: string;
  status: string;
  now: number;
}) {
  const scheduled = status === "SCHEDULED" || status === "CREATED";
  const seconds = Math.max(0, (Date.parse(scheduled ? startAt : endAt) - now) / 1000);
  const closed = !scheduled && (status !== "ACTIVE" || seconds <= 0);
  const urgent = !scheduled && !closed && seconds <= 300;
  const Icon = urgent ? Zap : Clock3;
  return (
    <span
      title={`${scheduled ? "Starts" : "Ends"} ${new Date(scheduled ? startAt : endAt).toLocaleString()}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] leading-4 tabular-nums ${urgent ? "bg-danger text-white" : scheduled ? "border border-border bg-background text-foreground" : "bg-foreground text-background"}`}
    >
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      {closed ? "Bidding closed" : `${scheduled ? "Starts in " : ""}${now ? formatAuctionCountdown(seconds) : scheduled ? "Scheduled" : "Live"}`}
    </span>
  );
}

export default AuctionTimeBadge;
