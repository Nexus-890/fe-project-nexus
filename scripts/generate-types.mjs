import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationSpecs = {
  "account-210-snapshot": { path: "../docs/api/account-210.openapi.json", status: "the unmerged #210 snapshot, not develop" },
  "seller-application-210-proposal": { path: "../docs/api/seller-application-210.openapi.json", status: "the proposed #210 seller contract, not a delivered API" },
};
let drift = false;
for (const [name, output] of [
  ["user-service", "userGeneratedType.ts"],
  ["catalog-service", "catalogGeneratedType.ts"],
  ["inventory-service", "inventoryGeneratedType.ts"],
  ["auction-service", "auctionGeneratedType.ts"],
  ["commerce-service", "commerceGeneratedType.ts"],
  ["notification-service", "notificationGeneratedType.ts"],
  // refresh-token cookie endpoints of the gateway (#252)
  ["api-gateway", "gatewayGeneratedType.ts"],
  ["payment-service", "paymentGeneratedType.ts"],
  ["shipment-service", "shipmentGeneratedType.ts"],
  ["rating-service", "ratingGeneratedType.ts"],
  ["account-210-snapshot", "account210GeneratedType.ts"],
  ["seller-application-210-proposal", "sellerApplication210GeneratedType.ts"],
]) {
  const integration = integrationSpecs[name];
  const spec = new URL(
    integration?.path ?? `../../be-project-nexus/docs/api/openapi/${name}.yaml`,
    import.meta.url,
  );
  const source =
    `/** Generated from ${integration?.status ?? "delivered OpenAPI"}. Run npm run generate:types; do not edit. */\n` +
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
