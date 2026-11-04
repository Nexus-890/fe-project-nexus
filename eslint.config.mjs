import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["postman/mocks/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**", ".next-*/**", ".next-cart-*/**", ".next-profile-*/**", ".next-typecheck/**", ".next-verify-build/**", "types/*GeneratedType.ts", ".next-catalog-*/**", "test-results/**", "playwright-report/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
