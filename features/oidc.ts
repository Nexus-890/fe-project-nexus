import {
  InMemoryWebStorage,
  SigninState,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts";
import type { SessionRequest } from "../types/authRequestType";
import type { SessionResponse } from "../types/authResponseType";

export interface OidcSession {
  accessToken: string;
  returnTo: string;
}

export interface OidcClient {
  signIn(returnTo?: string): Promise<void>;
  completeSignIn(url: string): Promise<OidcSession>;
  /** Lấy lại phiên sau khi tải lại trang bằng cookie HttpOnly. Ném lỗi nếu không còn phiên. */
  restore(): Promise<OidcSession>;
  signOut(): Promise<void>;
  clearSession(): Promise<void>;
}

type Manager = Pick<UserManager,
  "signinRedirect" | "signoutRedirect" | "removeUser" | "clearStaleState"
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
  // Ba hàm dưới đây gọi gateway (service/authService.ts). Provider truyền vào để file này không phụ thuộc HTTP.
  /** Đưa mã đăng nhập + PKCE verifier cho gateway. Gateway giữ refresh token trong cookie, chỉ trả access token. */
  exchangeCode?: (grant: SessionRequest) => Promise<SessionResponse>;
  /** null: không có cookie phiên (khách chưa đăng nhập). */
  refreshSession?: () => Promise<SessionResponse | null>;
  endSession?: () => Promise<void>;
}

const INVALID_RESPONSE = "The identity provider returned an invalid sign-in response.";
const NO_STATE = "No matching state found in storage";

/** Only application paths may be restored after the external sign-in redirect. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000- \u007f]/.test(value)) return "/";
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
      || /[\\\u0000- \u007f]/.test(pathname)
      || /^\/(?:auth|sign-in|sign-up|login|register)(?:\/|$)/i.test(normalized.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

const decodeClaims = (idToken: string): Record<string, unknown> => {
  try {
    const payload = idToken.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims: unknown = JSON.parse(json);
    if (typeof claims === "object" && claims !== null && !Array.isArray(claims))
      return claims as Record<string, unknown>;
  } catch {
    // rơi xuống lỗi chung bên dưới
  }
  throw new Error(INVALID_RESPONSE);
};

// Hai tab làm mới cùng lúc sẽ gửi chung một refresh token, tab đến sau bị Keycloak từ chối vì mỗi token chỉ dùng một lần.
// Khóa theo origin để tab đến sau chờ, rồi gửi đi cookie mới nhất (trình duyệt đính cookie tại lúc gửi).
const withSessionLock = async <T,>(task: () => Promise<T>): Promise<T> => {
  if (typeof navigator === "undefined" || !navigator.locks) return task();
  return navigator.locks.request("nexus-session-refresh", task).then((result) => result);
};

/** Creating the adapter is SSR-safe; browser state is read only on an action. */
export function createOidcClient(options: OidcClientOptions = {}): OidcClient {
  let manager: Manager | undefined;
  let settings: UserManagerSettings | undefined;
  let browser: BrowserContext | undefined;
  let generation = 0;
  let logoutHint: string | undefined;
  let restoring: Promise<OidcSession> | undefined;

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
      post_logout_redirect_uri: `${browser.origin}/`,
      response_type: "code",
      response_mode: "query",
      scope: "openid profile email",
      disablePKCE: false,
      loadUserInfo: false,
      filterProtocolClaims: false,
      automaticSilentRenew: false,
      monitorSession: false,
      monitorAnonymousSession: false,
      revokeTokensOnSignout: false,
      requestTimeoutInSeconds: 15,
      staleStateAgeInSeconds: 600,
      // Only the short-lived PKCE verifier/state/nonce survives the redirect.
      stateStore: new WebStorageStateStore({ prefix: "nexus.oidc.state.", store: browser.sessionStorage }),
      // Thư viện chỉ dựng request đăng nhập, không còn đổi mã nên không có user nào được lưu ở đây
      userStore: new WebStorageStateStore({ prefix: "nexus.oidc.user.", store: new InMemoryWebStorage() }),
    };
    manager = options.createManager?.(settings) ?? new UserManager(settings);
    return manager;
  };

  /**
   * Đọc state đã lưu lúc redirect đi (PKCE verifier, nonce, returnTo) và gỡ nó ngay để mã không dùng lại được.
   * Việc đổi mã trước đây do thư viện làm trực tiếp với Keycloak, nay do gateway làm nên phải tự đọc state.
   */
  const readCallback = async (url: string) => {
    const params = new URL(url).searchParams;
    const error = params.get("error");
    if (error) throw new Error(`The identity provider refused the sign-in: ${error}`);
    const code = params.get("code");
    const stateId = params.get("state")?.split(";")[0];
    if (!code || !stateId) throw new Error(NO_STATE);
    const stored = await settings!.stateStore!.remove(stateId);
    if (!stored) throw new Error(NO_STATE);
    const state = await SigninState.fromStorageString(stored);
    // state phải đúng là của lần đăng nhập này, tránh dùng nhầm state của client hay realm khác
    if (state.request_type !== "si:r" || !state.code_verifier || !state.nonce
      || state.client_id !== settings!.client_id || state.authority !== settings!.authority
      || state.redirect_uri !== settings!.redirect_uri) throw new Error(NO_STATE);
    const data: unknown = state.data;
    const returnTo = typeof data === "object" && data !== null && "returnTo" in data ? data.returnTo : undefined;
    return {
      grant: { code, codeVerifier: state.code_verifier, redirectUri: state.redirect_uri },
      nonce: state.nonce,
      returnTo: safeReturnTo(returnTo),
    };
  };

  /** Kiểm tra token gateway trả về; nonce chỉ có ở lần đăng nhập, lúc khôi phục phiên thì không kiểm. */
  const verify = (tokens: SessionResponse, nonce?: string): string => {
    if (!tokens.accessToken || !Number.isFinite(tokens.expiresIn) || tokens.expiresIn <= 0)
      throw new Error(INVALID_RESPONSE);
    const claims = decodeClaims(tokens.idToken);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== settings!.authority || !audiences.includes(settings!.client_id)
      || (audiences.length > 1 && claims.azp !== settings!.client_id)
      || typeof claims.exp !== "number" || !Number.isFinite(claims.exp)
      || claims.exp <= Date.now() / 1000) throw new Error(INVALID_RESPONSE);
    if (nonce !== undefined && claims.nonce !== nonce)
      throw new Error("The sign-in response nonce does not match this sign-in.");
    return tokens.accessToken;
  };

  return {
    async signIn(returnTo) {
      const current = getManager();
      const id = ++generation;
      logoutHint = undefined;
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
      const id = generation;
      try {
        // The library otherwise consumes matching state regardless of its age.
        // Expire abandoned transactions before allowing any code exchange.
        await current.clearStaleState();
        const callback = await readCallback(url);
        if (!options.exchangeCode) throw new Error("No session exchange is configured.");
        const tokens = await options.exchangeCode(callback.grant);
        if (generation !== id) throw new Error("Sign-in was canceled.");
        const accessToken = verify(tokens, callback.nonce);
        logoutHint = tokens.idToken;
        return { accessToken, returnTo: callback.returnTo };
      } catch (error) {
        await current.removeUser();
        throw error;
      }
    },

    restore() {
      // StrictMode chạy effect hai lần: dùng chung lần gọi đang chạy để refresh token không bị xoay hai lần
      restoring ??= (async () => {
        const current = getManager();
        const id = generation;
        if (!options.refreshSession) throw new Error("No session refresh is configured.");
        const tokens = await withSessionLock(options.refreshSession);
        if (!tokens) throw new Error("There is no session to restore.");
        // đăng nhập hay đăng xuất khác đã chạy trong lúc chờ thì bỏ kết quả này
        if (generation !== id) throw new Error("Session restore was superseded.");
        const accessToken = verify(tokens);
        await current.clearStaleState();
        logoutHint = tokens.idToken;
        return { accessToken, returnTo: "/" };
      })().finally(() => { restoring = undefined; });
      return restoring;
    },

    async signOut() {
      generation += 1;
      const current = getManager();
      // Gateway xóa cookie và kết thúc phiên Keycloak bằng refresh token. Lỗi ở đây không được chặn việc đăng xuất.
      await options.endSession?.().catch(() => {});
      await current.removeUser();
      await current.clearStaleState();
      // Giữ ID-token hint trong biến cục bộ: xóa token trong bộ nhớ không làm Keycloak mất khả năng nhận ra phiên.
      await current.signoutRedirect({
        id_token_hint: logoutHint,
        extraQueryParams: { client_id: settings!.client_id },
      });
      logoutHint = undefined;
    },

    async clearSession() {
      generation += 1;
      logoutHint = undefined;
      if (!manager) return;
      await manager.removeUser();
      await manager.clearStaleState();
    },
  };
}
