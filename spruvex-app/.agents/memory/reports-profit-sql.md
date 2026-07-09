---
name: Reports profit SQL aliases
description: Drizzle raw sql`` fragments don't have access to table aliases — use column interpolation instead
---

When writing raw SQL fragments in Drizzle's `sql\`\`` template literals inside `.select()` queries that join multiple tables, you cannot use SQL table aliases like `si.quantity` or `p.cost_price` — Drizzle doesn't define those aliases in its generated SQL.

**Fix:** Use Drizzle column interpolation inside the sql template:
```ts
sql`coalesce(sum(${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric), 0)`
```

**Why:** Drizzle generates its own column references and doesn't expose the table alias it uses internally. Raw SQL fragments that reference aliases like `si` or `p` will fail with "column not found" or similar.

**How to apply:** Whenever writing raw SQL in a multi-join query, reference columns via interpolation `${table.column}` rather than raw alias strings.
