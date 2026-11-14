"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

function AuctionCountdown({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.floor((Date.parse(closesAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [closesAt]);
  const label = remaining === null ? "Live" : remaining === 0 ? "Ended" :
    `${Math.floor(remaining / 3600).toString().padStart(2, "0")}:${Math.floor(remaining % 3600 / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return <span className="inline-flex items-center gap-1 rounded-sm bg-foreground px-2 py-1 font-mono text-xs text-background"><Clock3 size={13} aria-hidden="true" />{label}</span>;
}

export default AuctionCountdown;
