import base from "@spruvex-r/config/eslint.base.mjs";

export default [
  ...base,
  {
    rules: {
      // NestJS DI relies on parameter properties and empty constructors.
      "@typescript-eslint/no-empty-function": "off",
    },
  },
];
