import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { confirmPhoneCode, getPhoneVerification, resendVerificationEmail, sendPhoneCode } from "../service/verificationService";

const envelope = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data }));
const delivery = { retryAfterSeconds: 60, expiresInSeconds: 300 };
test("email resend remains public; phone operations use current session and allowlisted payloads", async () => {
  let token = "first";
  const calls: unknown[] = [];
  const context = { getAccessToken: () => token, fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null, bearer: new Headers(init?.headers).get("Authorization") });
    return envelope(path.endsWith("/send") || path.endsWith("/resend") ? delivery : { phone: "0901234567", verified: path.endsWith("/confirm") });
  } };
  await resendVerificationEmail(" buyer@example.com ", { context });
  await getPhoneVerification({ context });
  token = "rotated";
  await sendPhoneCode("0901234567", { context });
  await confirmPhoneCode("0901234567", "123456", { context });
  assert.deepEqual(calls, [
    { path: "/api/v1/auth/verification-email/resend", method: "POST", body: { email: "buyer@example.com" }, bearer: null },
    { path: "/api/v1/users/me/phone-verification", method: "GET", body: null, bearer: "Bearer first" },
    { path: "/api/v1/users/me/phone-verification/send", method: "POST", body: { phone: "0901234567" }, bearer: "Bearer rotated" },
    { path: "/api/v1/users/me/phone-verification/confirm", method: "POST", body: { phone: "0901234567", code: "123456" }, bearer: "Bearer rotated" },
  ]);
});
test("verification never accepts missing or malformed server status and delivery windows", async () => {
  for (const data of [null, {}, { phone: "bad", verified: true }, { phone: "0901234567", verified: "yes" }])
    await assert.rejects(getPhoneVerification({ context: { fetch: async () => envelope(data) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  for (const data of [null, {}, { ...delivery, retryAfterSeconds: -1 }, { ...delivery, expiresInSeconds: 0 }, { ...delivery, retryAfterSeconds: 0.5 }])
    await assert.rejects(sendPhoneCode("0901234567", { context: { fetch: async () => envelope(data) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("verification retains server rate-limit/expiry/ownership failures and cancellation", async () => {
  await assert.rejects(confirmPhoneCode("0901234567", "123456", { context: { fetch: async () => envelope({ phone: "0907654321", verified: true }) } }),
    (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  for (const status of [400, 403, 404, 409, 429, 503]) {
    const options = { context: { fetch: async () => new Response(JSON.stringify({ status, title: "Rejected", code: "VERIFICATION_REJECTED" }), { status }) } };
    await assert.rejects(confirmPhoneCode("0901234567", "123456", options), (error: unknown) => isApiError(error) && error.status === status);
  }
  const controller = new AbortController();
  await assert.rejects(sendPhoneCode("0901234567", { signal: controller.signal, context: { fetch: async (_input, init) => {
    assert.equal(init?.signal?.aborted, false); controller.abort(); return envelope(delivery);
  } } }), { name: "AbortError" });
});
