---
name: PostgreSQL numeric strings
description: pg driver returns numeric/decimal columns as JS strings, not numbers — impacts .toFixed() and arithmetic
---

PostgreSQL `numeric`/`decimal` columns are returned as JavaScript strings by the `pg` Node.js driver. Calling `.toFixed()` on them throws "toFixed is not a function".

**Fix:** Always wrap with `Number()` before display: `Number(value).toFixed(2)`.

**Also applies to:** Any arithmetic that depends on the actual number type (e.g. subtotals in cart — store as `Number(product.sellingPrice)` not raw API value).

**Why:** The pg driver preserves precision by returning numeric as strings. This is documented behavior but easy to miss, especially when TypeScript types say `number`.

**How to apply:** Any time a price/amount from the API is displayed with `.toFixed()` or used in math, wrap it with `Number()` first.
