import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "data/**",
      // Vendored beUI components (copied from beui.dev) are linted upstream.
      "apps/web/src/components/**",
      "apps/web/src/lib/*.ts",
      "apps/web/src/lib/*.tsx",
      "apps/web/src/lib/hooks/**",
      "!apps/web/src/lib/api.ts",
      "!apps/web/src/lib/modes.ts",
      "!apps/web/src/lib/storage.ts",
      "!apps/web/src/lib/locale-pt-br.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["apps/server/**/*.ts", "*.js"],
    languageOptions: { globals: globals.node },
  },
);
