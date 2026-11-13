"use client";

import { useEffect, useState } from "react";

export function useVerificationCooldown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const start = (seconds: number) => { setRemaining(seconds); setDeadline(Date.now() + seconds * 1000); };
  return { remaining, start };
}
