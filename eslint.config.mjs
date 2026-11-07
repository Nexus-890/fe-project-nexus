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
    ".next-polling-build/**",
    // Default ignores of eslint-config-next:
    ".next/**", ".next-*/**", "types/*GeneratedType.ts", "test-results/**", "playwright-report/**",
    "out/**",
    ".next-profile-*/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
