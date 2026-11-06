/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange the sign-in code for an access token and set the refresh cookie
         * @description Called once from the OIDC callback page with the authorization code and the PKCE verifier. The gateway trades them at Keycloak's token endpoint. The access and ID tokens are returned in the body; the refresh token is returned only as the HttpOnly cookie nexus_rt.
         */
        post: operations["createSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Trade the refresh cookie for a new access token and a new cookie
         * @description Used on page load and before the access token expires. Keycloak rotates the refresh token, so the cookie is replaced on every call; sending an old value again is refused and ends the Keycloak session.
         */
        post: operations["refreshSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * End the Keycloak session and clear the refresh cookie
         * @description Always answers 204 and clears the cookie, even when there was no cookie or Keycloak could not be reached, so the browser can always finish signing out locally.
         */
        post: operations["endSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        SessionRequest: {
            /** @description One-time authorization code from the callback URL */
            code: string;
            /** @description The PKCE verifier the browser kept from the sign-in redirect */
            codeVerifier: string;
            /** @description The redirect_uri used in the authorization request; Keycloak checks it matches */
            redirectUri: string;
        };
        SessionApiResponse: {
            /**
             * @default 0
             * @example 0
             */
            code: number;
            /**
             * @default response success
             * @example response success
             */
            message: string;
            data: components["schemas"]["Session"];
        };
        Session: {
            /** @description Bearer token for the API; keep it in memory only */
            accessToken: string;
            /** @description Used for the sign-out hint and the nonce check */
            idToken: string;
            /** @description Access token lifetime in seconds */
            expiresIn: number;
        };
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
            code?: string;
            traceId?: string;
        };
    };
    responses: {
        /** @description New short-lived tokens in the body and the replaced refresh cookie */
        SignedIn: {
            headers: {
                "Set-Cookie": components["headers"]["SessionCookie"];
                /** @description no-store, because the body holds a bearer token */
                "Cache-Control"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 0,
                 *       "message": "response success",
                 *       "data": {
                 *         "accessToken": "eyJhbGciOiJSUzI1NiJ9.example.access",
                 *         "idToken": "eyJhbGciOiJSUzI1NiJ9.example.id",
                 *         "expiresIn": 3600
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["SessionApiResponse"];
            };
        };
        /** @description The X-Requested-With header is missing or wrong, or the Origin is not an allowed frontend origin */
        NotFromTheApp: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Keycloak did not answer or answered with an error. The cookie is left as it was. */
        KeycloakUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Must be nexus-web. A foreign site cannot add it without passing CORS, which blocks it. */
        AppHeader: "nexus-web";
    };
    requestBodies: never;
    headers: {
        /** @description nexus_rt=<refresh token>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=<seconds>. JavaScript cannot read it and the browser sends it only to /api/v1/auth. */
        SessionCookie: string;
        /** @description nexus_rt=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0 */
        ClearedCookie: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    createSession: {
        parameters: {
            query?: never;
            header: {
                /** @description Must be nexus-web. A foreign site cannot add it without passing CORS, which blocks it. */
                "X-Requested-With": components["parameters"]["AppHeader"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionRequest"];
            };
        };
        responses: {
            200: components["responses"]["SignedIn"];
            /** @description A field is missing or has a wrong length */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Keycloak refused the code (used, expired or not for this verifier) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            403: components["responses"]["NotFromTheApp"];
            503: components["responses"]["KeycloakUnavailable"];
        };
    };
    refreshSession: {
        parameters: {
            query?: never;
            header: {
                /** @description Must be nexus-web. A foreign site cannot add it without passing CORS, which blocks it. */
                "X-Requested-With": components["parameters"]["AppHeader"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["SignedIn"];
            /** @description There is no session cookie, so there is nothing to refresh and Keycloak is not called. The app calls this on every page load, so an anonymous visitor gets 204 rather than an error. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Keycloak refused the cookie (expired, revoked or already used). The cookie is cleared in the same response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            403: components["responses"]["NotFromTheApp"];
            503: components["responses"]["KeycloakUnavailable"];
        };
    };
    endSession: {
        parameters: {
            query?: never;
            header: {
                /** @description Must be nexus-web. A foreign site cannot add it without passing CORS, which blocks it. */
                "X-Requested-With": components["parameters"]["AppHeader"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Session ended; nexus_rt is cleared (Max-Age=0) */
            204: {
                headers: {
                    "Set-Cookie": components["headers"]["ClearedCookie"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["NotFromTheApp"];
        };
    };
}
