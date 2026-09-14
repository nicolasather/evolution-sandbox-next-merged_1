import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js 16 removed `next lint`; this is the flat config its own template uses.
// `npm run lint` runs ESLint directly.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // build output
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vengeance UI components are copied in from their registry and kept close
    // to upstream so they stay easy to diff and update; they are linted there,
    // not here. Everything this project wrote itself is linted.
    "components/vengeance/**",
  ]),
]);

export default eslintConfig;
