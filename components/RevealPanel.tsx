"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RevealPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }, []);
  return <div ref={ref} tabIndex={-1} className="scroll-mt-4 outline-none">{children}</div>;
}
