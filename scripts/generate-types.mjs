import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let drift = false;
for (const [service, output] of [
  ["user", "userGeneratedType.ts"],
  ["catalog", "catalogGeneratedType.ts"],
  ["commerce", "commerceGeneratedType.ts"],
  ["payment", "paymentGeneratedType.ts"],
]) {
  const spec = new URL(
    `../../be-project-nexus/docs/api/openapi/${service}-service.yaml`,
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
