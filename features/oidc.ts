import {
  ErrorResponse,
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
  type User,
} from "oidc-client-ts";

export interface OidcSession {
  accessToken: string;
  returnTo: string;
  expiresAt: number;
  subject: string;
}

export interface OidcClient {
  signIn(returnTo?: string): Promise<void>;
  completeSignIn(url: string): Promise<OidcSession>;
  restoreSession(): Promise<OidcSession | null>;
  renewSession(): Promise<OidcSession>;
  completeSilentSignIn(url: string): Promise<void>;
  signOut(): Promise<void>;
  clearSession(): Promise<void>;
}

type Manager = Pick<UserManager,
  "signinRedirect" | "signinRedirectCallback" | "signoutRedirect" |
  "removeUser" | "getUser" | "clearStaleState" | "signinSilent" | "signinSilentCallback"
>;

interface BrowserContext {
  origin: string;
  sessionStorage: Storage;
  randomUUID(): string;
}

/** Injection points keep browser navigation and protocol tests outside React. */
export interface OidcClientOptions {
  getBrowser?: () => BrowserContext;
  createManager?: (settings: UserManagerSettings) => Manager;
}

/** Only application paths may be restored after the external sign-in redirect. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://nexus.invalid");
    let pathname = url.pathname;
    // Reject encoded separators too: a router or proxy must not reinterpret the
    // destination as an external URL or route back into the auth flow.
    for (let depth = 0; depth < 3; depth++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    }
    const normalized = new URL(pathname, "https://nexus.invalid");
    if (url.origin !== "https://nexus.invalid" || normalized.origin !== url.origin
      || /[\\\u0000-\u0020\u007f]/.test(pathname)
      || /^\/(?:auth|sign-in|sign-up|login|register)(?:\/|$)/i.test(normalized.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Creating the adapter is SSR-safe; browser state is read only on an action. */
export function createOidcClient(options: OidcClientOptions = {}): OidcClient {
  let manager: Manager | undefined;
  let settings: UserManagerSettings | undefined;
  let browser: BrowserContext | undefined;
  let generation = 0;
  let logoutHint: string | undefined;
  let subject: string | undefined;

  const getManager = () => {
    if (manager) return manager;
    browser = options.getBrowser?.() ?? {
      origin: window.location.origin,
      sessionStorage: window.sessionStorage,
      randomUUID: () => window.crypto.randomUUID(),
    };
    const base = new URL(process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:18080");
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if ((base.protocol !== "https:" && !(base.protocol === "http:" && localHost))
      || base.username || base.password || base.search || base.hash) {
      throw new Error("Invalid Keycloak URL configuration.");
    }
    const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "nexus";
    settings = {
      authority: `${base.href.replace(/\/$/, "")}/realms/${encodeURIComponent(realm)}`,
      client_id: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "nexus-web",
      redirect_uri: `${browser.origin}/auth/callback`,
      silent_redirect_uri: `${browser.origin}/auth/silent`,
      post_logout_redirect_uri: `${browser.origin}/`,
      response_type: "code",
      response_mode: "query",
      scope: "openid profile email",
      disablePKCE: false,
      loadUserInfo: false,
      filterProtocolClaims: false,
      automaticSilentRenew: false,
      validateSubOnSilentRenew: true,
      // The persisted transaction must never contain an ID-token hint.
      includeIdTokenInSilentRenew: false,
      iframeNotifyParentOrigin: browser.origin,
      iframeScriptOrigin: browser.origin,
      monitorSession: false,
      monitorAnonymousSession: false,
      revokeTokensOnSignout: false,
      requestTimeoutInSeconds: 15,
      silentRequestTimeoutInSeconds: 15,
      staleStateAgeInSeconds: 600,
      // Only the short-lived PKCE verifier/state/nonce survives the redirect.
      stateStore: new WebStorageStateStore({ prefix: "nexus.oidc.state.", store: browser.sessionStorage }),
      // Access, refresh and ID tokens never enter localStorage/sessionStorage.
      userStore: new WebStorageStateStore({ prefix: "nexus.oidc.user.", store: new InMemoryWebStorage() }),
    };
    manager = options.createManager?.(settings) ?? new UserManager(settings);
    return manager;
  };

  function readSession(user: User | null): OidcSession {
    const audiences = user && (Array.isArray(user.profile.aud) ? user.profile.aud : [user.profile.aud]);
    const now = Date.now() / 1000;
    if (!user?.access_token || user.token_type?.toLowerCase() !== "bearer" || user.expired
      || typeof user.expires_at !== "number" || !Number.isFinite(user.expires_at) || user.expires_at <= now
      || user.profile.iss !== settings!.authority || !audiences?.includes(settings!.client_id)
      || (audiences.length > 1 && user.profile.azp !== settings!.client_id)
      || typeof user.profile.sub !== "string" || !user.profile.sub
      || typeof user.profile.exp !== "number" || !Number.isFinite(user.profile.exp) || user.profile.exp <= now) {
      throw new Error("The identity provider returned an invalid sign-in response.");
    }
    const state = user.state;
    return {
      accessToken: user.access_token,
      returnTo: safeReturnTo(typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : undefined),
      expiresAt: user.expires_at,
      subject: user.profile.sub,
    };
  }

  async function silentSession(restoring: boolean): Promise<OidcSession | null> {
    const current = getManager();
    const id = generation;
    let returnedUser: User | null = null;
    try {
      await current.clearStaleState();
      if (generation !== id) throw new Error("Session check was canceled.");
      returnedUser = await current.signinSilent({
        prompt: "none", nonce: browser!.randomUUID(),
        // Restoration checks the provider's SSO cookie, not any cached user.
        ...(restoring ? { forceIframeAuth: true } : {}),
      });
      if (generation !== id) throw new Error("Session check was canceled.");
      const session = readSession(returnedUser);
      if (!restoring && subject && session.subject !== subject) throw new Error("The session user changed.");
      subject = session.subject;
      return session;
    } catch (error) {
      if (generation === id) {
        subject = undefined;
        await current.removeUser();
      } else if (returnedUser) {
        // SDK navigation can finish after sign-out. Remove only that stale
        // response, leaving a newer successfully established user untouched.
        const stored = await current.getUser();
        if (stored?.access_token === returnedUser.access_token) await current.removeUser();
      }
      if (generation === id && restoring && error instanceof ErrorResponse
        && ["login_required", "interaction_required", "consent_required", "account_selection_required"].includes(error.error ?? "")) return null;
      throw error;
    }
  }

  return {
    async signIn(returnTo) {
      const current = getManager();
      const id = ++generation;
      logoutHint = undefined;
      subject = undefined;
      await current.removeUser();
      await current.clearStaleState();
      if (generation !== id) throw new Error("Sign-in was canceled.");
      await current.signinRedirect({
        state: { returnTo: safeReturnTo(returnTo) },
        nonce: browser!.randomUUID(),
      });
    },

    async completeSignIn(url) {
      const current = getManager();
      // A callback establishes a new local session and invalidates an older
      // callback or silent check still awaiting the provider.
      const id = ++generation;
      let returnedUser: User | null = null;
      try {
        // The library otherwise consumes matching state regardless of its age.
        // Expire abandoned transactions before allowing any code exchange.
        await current.clearStaleState();
        if (generation !== id) throw new Error("Sign-in was canceled.");
        const user = returnedUser = await current.signinRedirectCallback(url);
        if (generation !== id) throw new Error("Sign-in was canceled.");
        const session = readSession(user);
        subject = session.subject;
        return session;
      } catch (error) {
        if (generation === id) { subject = undefined; await current.removeUser(); }
        else if (returnedUser && (await current.getUser())?.access_token === returnedUser.access_token) await current.removeUser();
        throw error;
      }
    },

    restoreSession: () => silentSession(true),

    async renewSession() {
      if (!subject) throw new Error("There is no active session to renew.");
      const session = await silentSession(false);
      if (!session) throw new Error("The session could not be renewed.");
      return session;
    },

    async completeSilentSignIn(url) {
      // Only relay the response URL. State validation and code exchange happen
      // in the parent, which owns the in-memory token store.
      await getManager().signinSilentCallback(url);
    },

    async signOut() {
      generation += 1;
      subject = undefined;
      const current = getManager();
      const user = await current.getUser();
      // Keep the ID-token hint in a local variable so clearing memory does not
      // prevent Keycloak from identifying the session to terminate.
      logoutHint = user?.id_token ?? logoutHint;
      await current.removeUser();
      await current.clearStaleState();
      await current.signoutRedirect({
        id_token_hint: logoutHint,
        extraQueryParams: { client_id: settings!.client_id },
      });
      logoutHint = undefined;
    },

    async clearSession() {
      generation += 1;
      subject = undefined;
      logoutHint = undefined;
      if (!manager) return;
      await manager.removeUser();
      await manager.clearStaleState();
    },
  };
}
