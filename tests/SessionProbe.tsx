"use client";

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { isApiError, requestApi } from "../configs/api";

/** Served only by the explicit development test flag; never enabled in production. */
export default function SessionProbe() {
  const { status, user, requestContext, signOut } = useAuth();
  const [results, setResults] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  async function run(keys: string[]) {
    setBusy(true);
    try {
      const responses = await Promise.all(keys.map(async (key) => {
        try {
          await requestApi("GET", "/api/v1/test/protected", undefined, {
            context: requestContext, params: { key },
          });
          return 200;
        } catch (error) {
          return isApiError(error) ? error.status : 0;
        }
      }));
      setResults(responses);
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
