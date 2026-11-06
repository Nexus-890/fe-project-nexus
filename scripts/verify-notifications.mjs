import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Run the actual service/HTTP boundary against a running local Postman simulation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(path.join(tmpdir(), "nexus-notification-http-"));
const origin = process.env.NEXUS_NOTIFICATION_SIM_URL ?? "http://127.0.0.1:3915";
const headers = { "x-mock-slug": "notifications" };
const control = async (route, body) => {
  const response = await fetch(`${origin}/__test/${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, 200, `Simulation control ${route}`);
  return response.json();
};

try {
  const program = ts.createProgram({
    rootNames: [path.join(root, "service/notificationService.ts")],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmitOnError: true,
      types: ["node"],
      rootDir: root,
      outDir: output,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  program.emit();
  symlinkSync(path.join(root, "node_modules"), path.join(output, "node_modules"),
    process.platform === "win32" ? "junction" : "dir");
  const require = createRequire(import.meta.url);
  const { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } =
    require(path.join(output, "service/notificationService.js"));
  const optionsFor = (account) => ({
    context: { baseUrl: origin, getAccessToken: () => account ? `notification-simulation-${account}` : null },
    config: { headers },
  });
  const options = optionsFor("a");
  const inbox = () => getNotifications({}, options);
  const count = () => getUnreadNotificationCount(options);
  const rejectsStatus = (status, code) => (error) =>
    error.kind === "http" && error.status === status && (code === undefined || error.code === code);

  await control("reset", {});
  const [initial, initialCount] = await Promise.all([inbox(), count()]);
  assert.equal(initialCount, 18);
  assert.equal(initial.content.length, 10);
  assert.equal(initial.totalElements, 24);
  assert.equal(initial.content[0].title, "A update 24");
  assert.equal(initial.content[9].title, "A update 15");
  const firstId = initial.content[0].id;
  assert.equal(await markNotificationRead(firstId, options), undefined);
  assert.equal(await count(), 17);
  const afterRead = (await inbox()).content[0];
  assert.ok(afterRead.readAt);
  await markNotificationRead(firstId, options);
  assert.equal(await count(), 17);
  assert.equal((await inbox()).content[0].readAt, afterRead.readAt);
  console.log("PASS: latest ten, bodyless PATCH/204, refetched 18 -> 17 and idempotent read");

  const other = await getNotifications({}, optionsFor("b"));
  await assert.rejects(markNotificationRead(other.content[0].id, options), rejectsStatus(403));
  await assert.rejects(markNotificationRead("68000000-0000-4000-8000-000000000099", options), rejectsStatus(404));
  await assert.rejects(markNotificationRead("id/with?query", options), rejectsStatus(400));
  await assert.rejects(markNotificationRead(firstId, optionsFor(null)), rejectsStatus(401));
  assert.equal(await count(), 17);
  assert.equal(await getUnreadNotificationCount(optionsFor("b")), 18);
  await control("control", { patchStatus: 503 });
  await assert.rejects(markNotificationRead(initial.content[1].id, options), rejectsStatus(503, "SERVICE_UNAVAILABLE"));
  await assert.rejects(markAllNotificationsRead(options), rejectsStatus(503, "SERVICE_UNAVAILABLE"));
  assert.equal(await count(), 17);
  await control("control", {});
  assert.equal(await markAllNotificationsRead(options), undefined);
  assert.equal(await count(), 0);
  assert.ok((await inbox()).content.every((row) => row.readAt !== null));
  assert.equal((await inbox()).content[0].readAt, afterRead.readAt);
  assert.equal((await inbox()).content[3].readAt, initial.content[3].readAt);
  assert.equal(await getUnreadNotificationCount(optionsFor("b")), 18);
  console.log("PASS: 400/401/403/404/503 propagate, failure preserves state, retry read-all clears own inbox only");

  const evidence = await control("requests");
  const writes = evidence.filter((entry) => entry.method === "PATCH");
  assert.equal(writes.length, 9, "No automatic mutation retry");
  assert.ok(writes.every((entry) => !entry.hasBody));
  assert.ok(writes.every((entry) => Object.keys(entry.query).length === 0));
  assert.ok(writes.filter((entry) => entry.account !== null).every((entry) => entry.account === "a"));
  assert.ok(writes.some((entry) => entry.path.endsWith("/id%2Fwith%3Fquery/read")));
  assert.deepEqual(evidence.find((entry) => entry.path === "/api/v1/notifications").query, { page: "0", size: "10" });
  console.log(`PASS: HTTP evidence confirms ${writes.length} bodyless PATCH requests, encoded ID, scoped Bearer and paging`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
