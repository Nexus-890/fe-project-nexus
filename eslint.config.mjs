import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Postman loads mock handlers as CommonJS modules.
    files: ["postman/mocks/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**", ".next-oidc-run/**", ".next-cart-*/**", ".next-typecheck/**", ".next-verify-build/**", "types/*GeneratedType.ts", ".next-catalog-*/**", "test-results/**", "playwright-report/**",
    "out/**",
    ".next-orders-run/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
