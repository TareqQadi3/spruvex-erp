import base from "@spruvex-r/config/eslint.base.mjs";

export default [
  ...base,
  {
    rules: {
      // Next.js server/client components use empty arrow returns and
      // implicit any in a few framework-required spots (generateStaticParams etc).
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
