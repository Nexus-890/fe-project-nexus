"use client";

import { useState } from "react";
import { useAuth } from "../hooks/auth/useAuth";

/** Served only by the explicit development test flag; never enabled in production. */
export default function SessionProbe() {
  const { status, user, api, signOut } = useAuth();
  const [results, setResults] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  async function run(keys: string[]) {
    setBusy(true);
    try {
      const responses = await Promise.all(keys.map((key) => api.client.get(`/api/v1/test/protected?key=${key}`)));
      setResults(responses.map((response) => response.ok ? 200 : response.error.status));
    } finally { setBusy(false); }
  }
  return <main>
    <p data-testid="session-status">{status}</p>
    <p data-testid="session-user">{user?.id ?? "anonymous"}</p>
    <output data-testid="request-results">{JSON.stringify(results)}</output>
    <button disabled={busy || status !== "authenticated"} onClick={() => void run(["a", "b", "c"])}>Run three protected requests</button>
    <button disabled={busy || status !== "authenticated"} onClick={() => void run(["rejected"])}>Run rejected request</button>
    <button onClick={() => void signOut()}>Sign out</button>
  </main>;
}
