import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Runtime/data dirs — not source, gitignored, shouldn't be linted.
    ".chrome-profile/**",
    "data/**",
    "backups/**",
    "screenshots/**",
    "traces/**",
    "src/db/migrations/**",
  ]),
]);

export default eslintConfig;
