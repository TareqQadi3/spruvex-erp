import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint flat-config base for all SpruVex R packages.
 * Consumers spread this array and add package-specific overrides.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "generated/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
);
