import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Cast discipline: forbid (supabase as any) outside the centralized untypedTable wrapper
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression[expression.name='supabase'][typeAnnotation.typeName.name='any']",
          message: "Do not use (supabase as any). Use untypedTable() from src/lib/untypedTable.ts or add a '// TEMP TYPE ESCAPE — reason' comment.",
        },
      ],
    },
  },
  // Phase E: Soft architectural guidance (warnings only) for presentation layer.
  // Encourage data-layer hooks in src/data/* or src/hooks/* instead of direct
  // supabase calls / `as any` casts in components and pages.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "Prefer a data hook (src/hooks/* or src/data/*) over importing supabase directly in components/pages. See src/data/README.md.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name='any']",
          message:
            "Avoid `as any` in components/pages. Use supabaseRow<T>() / supabaseRows<T>() from src/lib/supabaseRow.ts, or move the query into a typed data hook.",
        },
      ],
    },
  },
);
