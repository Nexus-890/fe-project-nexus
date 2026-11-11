"use client";

import { useEffect, useState } from "react";

/** Presentation-only countdown: no sale or price change is inferred from it. */
function SampleSaleCountdown({ inverse = false }: { inverse?: boolean }) {
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 36);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60];
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs"><span className={inverse ? "text-primary-foreground/90" : "text-muted-foreground"}>Sample sale ends in</span><span className="flex items-center gap-1 font-mono tabular-nums" aria-label={`${parts[0]} hours ${parts[1]} minutes ${parts[2]} seconds`}>{parts.map((part, index) => <span key={index} className={`rounded-sm px-1.5 py-1 ${inverse ? "bg-background/20 text-primary-foreground" : "bg-foreground text-background"}`}>{String(part).padStart(2, "0")}</span>)}</span></span>;
}

export default SampleSaleCountdown;
