import { isApiError } from "../configs/api";
import type { OidcClient, OidcSession } from "./oidc";

interface TokenSessionOptions {
  oidc: OidcClient;
  onRenew(next: OidcSession): void;
  onFailure(): void;
}

/**
 * One in-memory renewal coordinator per AuthProvider, shared by every API
 * client and proactive timer. No credential is written to browser storage.
 */
export function createTokenSession(options: TokenSessionOptions) {
  let session: OidcSession | null = null;
  let generation = 0;
  let inFlight: Promise<string | null> | null = null;
  const lineage = new Set<string>();

  function clear(): void {
    generation++;
    session = null;
    inFlight = null;
    lineage.clear();
  }

  function start(next: OidcSession): void {
    clear();
    session = { ...next };
    lineage.add(next.accessToken);
  }

  function renewAccessToken(failedToken: string): Promise<string | null> {
    const previous = session;
    if (!previous || !lineage.has(failedToken)) return Promise.resolve(null);
    // A late 401 may carry an earlier token from this same session. Reuse the
    // already published replacement rather than starting a second renewal.
    if (failedToken !== previous.accessToken) return Promise.resolve(previous.accessToken);
    if (inFlight) return inFlight;

    const id = generation;
    const result = Promise.resolve().then(async (): Promise<string | null> => {
      let next: OidcSession;
      try {
        next = await options.oidc.renewSession();
        if (next.subject !== previous.subject || !next.accessToken
          || !Number.isFinite(next.expiresAt) || next.expiresAt <= Date.now() / 1000) {
          throw new Error("Invalid renewed session");
        }
      } catch (error) {
        // gateway trả 503/504 hay mất mạng: cookie vẫn còn nên giữ phiên, lần 401 hoặc lần hẹn giờ sau sẽ thử lại
        if (isApiError(error) && (error.kind === "network" || error.status >= 500)) return null;
        if (generation === id) {
          clear();
          options.onFailure();
        }
        return null;
      }
      // A logout or a new interactive sign-in invalidates earlier work. In
      // particular, an old failure must never clear another user's session.
      if (generation !== id) return null;
      session = { ...next };
      lineage.add(next.accessToken);
      options.onRenew({ ...next });
      return next.accessToken;
    });
    inFlight = result;
    void result.finally(() => {
      if (inFlight === result) inFlight = null;
    }).catch(() => {});
    return result;
  }

  return {
    getAccessToken: () => session?.accessToken ?? null,
    getSession: () => session ? { ...session } : null,
    start,
    clear,
    renewAccessToken,
    renew: (): Promise<string | null> => session
      ? renewAccessToken(session.accessToken) : Promise.resolve(null),
  };
}

/** Renew 60s early, or halfway through a shorter remaining lifetime. */
export function renewalDelay(expiresAt: number, nowMs = Date.now()): number {
  if (!Number.isFinite(expiresAt) || !Number.isFinite(nowMs)) return 1_000;
  const remainingMs = expiresAt * 1_000 - nowMs;
  return Math.min(2_147_483_647, Math.max(1_000, remainingMs - Math.min(60_000, remainingMs / 2)));
}
