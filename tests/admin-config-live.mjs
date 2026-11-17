// Opt-in FE -> real config-service HTTP check. Only Keycloak and owner refresh are controlled dependencies.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { createWriteStream, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jar = path.resolve(root, "../be-project-nexus/config-service/target/config-service-0.0.1-SNAPSHOT.jar");
assert.ok(existsSync(jar), "Build config-service first: .\\mvnw.cmd verify");
const output = mkdtempSync(path.join(tmpdir(), "nexus-config-live-"));
const logs = path.join(root, "test-results/config-live");
await mkdir(logs, { recursive: true });
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "config-live-test", use: "sig", alg: "RS256" };
let refreshes = 0;
const dependency = createServer((req, res) => {
  const json = (data) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
  if (req.url === "/jwks") return json({ keys: [jwk] });
  if (req.url === "/realms/nexus/protocol/openid-connect/token") return json({ access_token: "test-service-account" });
  if (req.url === "/admin/realms/nexus") return json({ bruteForceProtected: true, failureFactor: 7, passwordPolicy: "length(12)", ssoSessionIdleTimeout: 1800, accessTokenLifespan: 300 });
  if (req.url === "/actuator/refresh" && req.method === "POST") { refreshes++; return json([]); }
  res.writeHead(404); res.end();
});
const listen = async (server) => { server.listen(0, "127.0.0.1"); await once(server, "listening"); return server.address().port; };
let application;
const log = createWriteStream(path.join(logs, "config-service.log"));
try {
  const program = ts.createProgram({ rootNames: [path.join(root, "service/adminConfigService.ts")], options: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    jsx: ts.JsxEmit.ReactJSX, strict: true, esModuleInterop: true, skipLibCheck: true, noEmitOnError: true,
    types: ["node"], rootDir: root, outDir: output,
  } });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file, getCurrentDirectory: () => root, getNewLine: () => "\n",
  }));
  program.emit();
  symlinkSync(path.join(root, "node_modules"), path.join(output, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const require = createRequire(import.meta.url);
  const { getSystemConfigs, updateSystemConfig } = require(path.join(output, "service/adminConfigService.js"));
  const { isApiError } = require(path.join(output, "configs/api.js"));
  const dependencyOrigin = `http://127.0.0.1:${await listen(dependency)}`;
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const java = process.env.NEXUS_TEST_JAVA ?? (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java");
  application = spawn(java, ["-Duser.timezone=UTC", "-jar", jar,
    `--server.port=${port}`, "--server.address=127.0.0.1", "--spring.cloud.compatibility-verifier.enabled=false",
    `--nexus.security.jwt.issuer=${dependencyOrigin}`, `--nexus.security.jwt.jwk-set-uri=${dependencyOrigin}/jwks`,
    `--nexus.system-config.keycloak.server-url=${dependencyOrigin}`, "--nexus.system-config.keycloak.client-secret=test-only",
    `--nexus.system-config.notification-url=${dependencyOrigin}`, `--nexus.system-config.commerce-url=${dependencyOrigin}`,
    `--nexus.system-config.state-file=${path.join(output, "state.json")}`, "--nexus.system-config.audit.enabled=false",
  ], { cwd: output, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  application.stdout.pipe(log); application.stderr.pipe(log, { end: false });
  let launchError;
  application.on("error", (error) => { launchError = error; });
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    assert.equal(application.exitCode, null, "config-service exited before readiness; see test-results/config-live/config-service.log");
    try { ready = (await fetch(`${origin}/actuator/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Startup is still in progress. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "config-service readiness timed out");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "RS256", kid: jwk.kid, typ: "JWT" })}.${encode({
    iss: dependencyOrigin, aud: "nexus-services", sub: "68000000-0000-4000-8000-000000000001", iat: now, exp: now + 600,
    roles: ["ADMIN"], privileges: ["SYSTEM.CONFIG.VIEW", "SYSTEM.CONFIG.UPDATE"],
  })}`;
  const token = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
  const options = { context: { baseUrl: origin, getAccessToken: () => token } };
  const rows = await getSystemConfigs(options);
  assert.equal(rows.length, 57);
  const realm = rows.find((row) => row.key === "MAX_LOGIN_ATTEMPTS");
  assert.equal(realm.applyMode, "KEYCLOAK_MANAGED"); assert.equal(realm.value, 7); assert.equal(realm.configuredValue, 5);
  const initial = rows.find((row) => row.key === "NOTIFICATION_RETRY_LIMIT").value;
  const accepted = Number(initial) + 1;
  assert.deepEqual(await updateSystemConfig("NOTIFICATION_RETRY_LIMIT", accepted, options), { key: "NOTIFICATION_RETRY_LIMIT", value: accepted });
  assert.ok(refreshes > 0);
  assert.equal((await getSystemConfigs(options)).find((row) => row.key === "NOTIFICATION_RETRY_LIMIT").value, accepted);
  await assert.rejects(updateSystemConfig("NOTIFICATION_RETRY_LIMIT", "wrong-type", options), (error) => isApiError(error) && error.status === 400 && error.code === "CONFIG_VALUE_INVALID");
  await assert.rejects(updateSystemConfig("MAX_LOGIN_ATTEMPTS", 4, options), (error) => isApiError(error) && error.status === 400 && error.code === "CONFIG_KEY_EXTERNALLY_MANAGED");
  assert.equal((await getSystemConfigs(options)).find((row) => row.key === "NOTIFICATION_RETRY_LIMIT").value, accepted);
  process.stdout.write("PASS: FE services parsed 57 real config-service GET rows, accepted short PUT 200, reread persisted value and preserved both backend 400 codes. Keycloak and refresh are controlled dependencies; no gateway/deployed realm is exercised.\n");
} finally {
  if (application && application.exitCode === null) {
    const exited = once(application, "exit"); application.kill(); await exited;
  }
  dependency.closeAllConnections();
  if (dependency.listening) await new Promise((resolve) => dependency.close(resolve));
  log.end();
  rmSync(output, { recursive: true, force: true });
}
