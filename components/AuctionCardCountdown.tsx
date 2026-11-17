"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatAuctionCountdown } from "../features/auctionRoomUtils";

function AuctionCardCountdown({ closesAt }: { closesAt: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((Date.parse(closesAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [closesAt]);
  return <span className="inline-flex items-center gap-1 rounded-sm bg-foreground px-2 py-1 font-mono text-xs text-background"><Clock3 size={13} aria-hidden="true" />{seconds === null ? "Live" : seconds === 0 ? "Ended" : formatAuctionCountdown(seconds)}</span>;
}

export default AuctionCardCountdown;
