import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { confirmPasswordReset, passwordProblem, requestPasswordReset, RESET_TOKEN_PATTERN } from "../service/passwordService";

const token = "Rk9yZ290LXBhc3N3b3JkLWZpeHR1cmUtdG9rZW4tMDE";

test("password reset sends trimmed public requests without a bearer token", async () => {
  const calls: unknown[] = [];
  const context = { getAccessToken: () => "signed-in", fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method, body: JSON.parse(String(init?.body)), bearer: new Headers(init?.headers).get("Authorization") });
    return new Response(null, { status: 204 });
  } };
  assert.equal(await requestPasswordReset(" Lan@Example.com ", { context }), undefined);
  assert.equal(await confirmPasswordReset(token, " keeps spaces ", { context }), undefined);
  assert.deepEqual(calls, [
    { path: "/api/v1/auth/password-reset", method: "POST", body: { email: "Lan@Example.com" }, bearer: null },
    { path: "/api/v1/auth/password-reset/confirm", method: "POST", body: { token, newPassword: " keeps spaces " }, bearer: null },
  ]);
});

test("password reset keeps the backend codes for the page to explain", async () => {
  for (const code of ["USER_PASSWORD_RESET_LINK_INVALID", "USER_PASSWORD_REUSED", "USER_PASSWORD_REJECTED"]) {
    const context = { fetch: async () => new Response(JSON.stringify({ status: 400, code, title: "Bad Request" }), { status: 400 }) };
    await assert.rejects(confirmPasswordReset(token, "a-new-password", { context }), (error: unknown) => isApiError(error) && error.code === code);
  }
});

test("password rules match the realm policy before any request", () => {
  assert.equal(passwordProblem("short", "short"), "Use at least 8 characters.");
  assert.equal(passwordProblem("        ", "        "), "The password cannot be only spaces.");
  assert.equal(passwordProblem("x".repeat(129), "x".repeat(129)), "Use at most 128 characters.");
  assert.equal(passwordProblem("long-enough", "long-enougH"), "The passwords do not match.");
  assert.equal(passwordProblem("long-enough", "long-enough"), null);
  assert.ok(RESET_TOKEN_PATTERN.test(token));
  for (const value of ["", "not-a-token", `${token}x`, `${token.slice(0, 42)}=`]) assert.equal(RESET_TOKEN_PATTERN.test(value), false);
});
