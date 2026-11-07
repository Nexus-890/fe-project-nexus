import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let drift = false;
for (const [name, output] of [
  ["user-service", "userGeneratedType.ts"],
  ["catalog-service", "catalogGeneratedType.ts"],
  ["commerce-service", "commerceGeneratedType.ts"],
  ["notification-service", "notificationGeneratedType.ts"],
  // refresh-token cookie endpoints of the gateway (#252)
  ["api-gateway", "gatewayGeneratedType.ts"],
  ["payment-service", "paymentGeneratedType.ts"],
]) {
  const spec = new URL(
    `../../be-project-nexus/docs/api/openapi/${name}.yaml`,
    import.meta.url,
  );
  const source =
    "/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */\n" +
    astToString(await openapiTS(spec));
  const target = path.join(root, "types", output);
  if (process.argv.includes("--check")) {
    const current = await fs.readFile(target, "utf8").catch(() => "");
    if (current !== source) {
      console.error(`Generated type drift: types/${output}`);
      drift = true;
    }
  } else await fs.writeFile(target, source);
}
if (drift) process.exitCode = 1;
