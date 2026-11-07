import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { initiatePayment } from "../service/paymentService";

const orderGroupId = "a1000000-0000-4000-8000-000000000001";
const instructions = {
  sessionId: "b1000000-0000-4000-8000-000000000001",
  qrImageUrl: "https://vietqr.app/img?acc=0000000002&amount=350000&des=SEVQR%20NX20261105001",
  bankAccount: "0000000002",
  amount: 350000,
  memoCode: "NX20261105001",
  transferContent: "SEVQR NX20261105001",
  expiresAt: "2026-11-05T10:10:00Z",
  serverNow: "2026-11-05T10:00:00Z",
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
};
const isInvalidResponse = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("payment POST uses the exact group body and current auth; repeated reads keep memo with fresh server time", async (t) => {
  const seen: Array<{ method?: string; path?: string; body: string; auth?: string; contentType?: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({
      method: request.method, path: request.url, body: Buffer.concat(chunks).toString(),
      auth: request.headers.authorization, contentType: request.headers["content-type"],
    });
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({
      ...instructions, serverNow: seen.length === 1 ? instructions.serverNow : "2026-11-05T10:00:30Z",
    })));
  });
  let token = "first-buyer-token";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  // A laptop one hour ahead must still show approximately ten minutes.
  t.mock.method(Date, "now", () => Date.parse(instructions.serverNow) + 3_600_000);
  try {
    const startedAt = performance.now();
    const first = await initiatePayment({ orderGroupId }, { context, auth: false });
    const finishedAt = performance.now();
    assert.equal(first.amount, "350000");
    assert.equal(first.bankAccount, "0000000002");
    assert.equal(first.memoCode, instructions.memoCode);
    assert.equal(first.transferContent, "SEVQR NX20261105001");
    assert.equal(new URL(first.qrImageUrl).searchParams.get("des"), first.transferContent);
    assert.ok(first.receivedAt >= startedAt && first.receivedAt <= finishedAt);
    assert.ok(first.remainingMs <= 600_000 && first.remainingMs >= 600_000 - (finishedAt - startedAt) - 1);

    token = "refreshed-buyer-token";
    const refreshed = await initiatePayment({ orderGroupId }, { context });
    assert.equal(refreshed.sessionId, first.sessionId);
    assert.equal(refreshed.qrImageUrl, first.qrImageUrl);
    assert.equal(refreshed.memoCode, first.memoCode);
    assert.equal(refreshed.transferContent, first.transferContent);
    assert.equal(refreshed.amount, first.amount);
    assert.equal(refreshed.expiresAt, first.expiresAt);
    assert.equal(refreshed.serverNow, "2026-11-05T10:00:30Z");
    assert.ok(refreshed.remainingMs <= 570_000 && refreshed.remainingMs > 560_000);
    assert.deepEqual(seen, [
      { method: "POST", path: "/api/v1/payments", body: JSON.stringify({ orderGroupId }), auth: "Bearer first-buyer-token", contentType: "application/json" },
      { method: "POST", path: "/api/v1/payments", body: JSON.stringify({ orderGroupId }), auth: "Bearer refreshed-buyer-token", contentType: "application/json" },
    ]);
  } finally {
    await close(server);
  }
});

test("payment deadline at or before server time is zero, and whole-VND limits retain exact decimal text", async () => {
  let data = { ...instructions };
  const server = createServer((_, response) => {
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(data)));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (const serverNow of [instructions.expiresAt, "2026-11-05T10:11:00Z"]) {
      data = { ...instructions, serverNow };
      assert.equal((await initiatePayment({ orderGroupId }, { context })).remainingMs, 0);
    }
    for (const amount of [1, 9_999_999_999_999]) {
      data = { ...instructions, amount };
      assert.equal((await initiatePayment({ orderGroupId }, { context })).amount, String(amount));
    }
  } finally {
    await close(server);
  }
});

test("payment preserves the complete transfer description separately from its immutable reference", async () => {
  let transferContent = instructions.memoCode;
  const server = createServer((_, response) => {
    const qrImageUrl = new URL(instructions.qrImageUrl);
    qrImageUrl.searchParams.set("des", transferContent);
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({ ...instructions, transferContent, qrImageUrl: qrImageUrl.href })));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (transferContent of [instructions.memoCode, "SEVQR NX20261105001", "NHẬN  NX20261105001  "]) {
      const payment = await initiatePayment({ orderGroupId }, { context });
      assert.equal(payment.memoCode, "NX20261105001");
      assert.equal(payment.transferContent, transferContent);
      assert.equal(new URL(payment.qrImageUrl).searchParams.get("des"), payment.transferContent);
    }
  } finally {
    await close(server);
  }
});

test("payment rejects malformed HTTP data and missing server time instead of inventing payable instructions", async () => {
  let body: unknown = null;
  let status = 201;
  const server = createServer((_, response) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const context = { baseUrl: await listen(server) };
  const invalidData = [
    null,
    { ...instructions, serverNow: undefined },
    { ...instructions, serverNow: "not-a-time" },
    { ...instructions, serverNow: "2026-11-05T10:00:00" },
    { ...instructions, expiresAt: "tomorrow" },
    { ...instructions, qrImageUrl: "javascript:alert(1)" },
    { ...instructions, qrImageUrl: "data:image/svg+xml,unsafe" },
    { ...instructions, qrImageUrl: "https://user:secret@example.com/qr.png" },
    { ...instructions, amount: 1.5 },
    { ...instructions, amount: 10_000_000_000_000 },
    { ...instructions, amount: "350000" },
    { ...instructions, amount: 0 },
    { ...instructions, bankAccount: " " },
    { ...instructions, memoCode: "MEMO WITH SPACES" },
    { ...instructions, transferContent: undefined },
    { ...instructions, transferContent: " " },
    { ...instructions, transferContent: "x".repeat(1025) },
    { ...instructions, transferContent: "SEVQR\nNX20261105001" },
    { ...instructions, sessionId: "not-a-uuid" },
  ];
  try {
    for (const data of invalidData) {
      body = envelope(data);
      await assert.rejects(initiatePayment({ orderGroupId }, { context }), isInvalidResponse);
    }
    for (const invalidEnvelope of [instructions, { code: 0, message: "response success" }, { data: instructions }]) {
      body = invalidEnvelope;
      await assert.rejects(initiatePayment({ orderGroupId }, { context }), isInvalidResponse);
    }
    status = 204;
    await assert.rejects(initiatePayment({ orderGroupId }, { context }), isInvalidResponse);
  } finally {
    await close(server);
  }
});

test("payment preserves Problem Details and field errors without retrying rejected HTTP requests", async () => {
  let status = 400;
  let calls = 0;
  const server = createServer((request, response) => {
    calls++;
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({
      type: "https://nexus/errors/payment-rejected", title: "Payment rejected", status,
      code: status === 409 ? "PAYMENT_SESSION_NOT_PAYABLE" : `PAYMENT_${status}`,
      detail: "Payment cannot be prepared", instance: request.url, traceId: "payment-trace",
      errors: [{ field: "orderGroupId", code: "INVALID", detail: "Check the group reference" }],
    }));
  });
  const context = { baseUrl: await listen(server) };
  const statuses = [400, 401, 403, 404, 409, 503];
  try {
    for (status of statuses) {
      await assert.rejects(initiatePayment({ orderGroupId }, { context }), (error: unknown) => {
        assert.ok(isApiError(error));
        assert.equal(error.kind, "http");
        assert.equal(error.status, status);
        assert.equal(error.code, status === 409 ? "PAYMENT_SESSION_NOT_PAYABLE" : `PAYMENT_${status}`);
        assert.equal(error.detail, "Payment cannot be prepared");
        assert.equal(error.instance, "/api/v1/payments");
        assert.equal(error.traceId, "payment-trace");
        assert.deepEqual(error.fieldErrors, { orderGroupId: ["Check the group reference"] });
        return true;
      });
    }
    assert.equal(calls, statuses.length);
  } finally {
    await close(server);
  }
});

test("payment cancellation aborts the actual HTTP request, stays distinct from failure and never retries", async () => {
  let calls = 0;
  let started: () => void = () => {};
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  const server = createServer(() => { calls++; started(); });
  const context = { baseUrl: await listen(server) };
  const controller = new AbortController();
  try {
    const pending = initiatePayment({ orderGroupId }, { context, signal: controller.signal });
    const rejection = assert.rejects(pending,
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
    await requestStarted;
    controller.abort();
    await rejection;
    await assert.rejects(initiatePayment({ orderGroupId }, { context, signal: controller.signal }),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
    assert.equal(calls, 1);
  } finally {
    await close(server);
  }
});

test("payment rejects an invalid group reference before sending HTTP", async () => {
  let calls = 0;
  const server = createServer((_, response) => { calls++; response.writeHead(500).end(); });
  const context = { baseUrl: await listen(server) };
  try {
    for (const invalidId of ["", " ", "group-1", "../../another-group", `${orderGroupId}?other=1`])
      await assert.rejects(initiatePayment({ orderGroupId: invalidId }, { context }), isInvalidResponse);
    assert.equal(calls, 0);
  } finally {
    await close(server);
  }
});
