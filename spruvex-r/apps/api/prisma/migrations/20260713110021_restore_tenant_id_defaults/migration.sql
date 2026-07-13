-- The previous migration (platform_admin_lockout) touched these tables only
-- incidentally (Prisma re-diffs the whole schema on every migration), and
-- since the tenant_id auto-default is raw SQL Prisma can't see declaratively,
-- it silently emitted DROP DEFAULT for all of them again. Restore it —
-- same fix as billing_platform_domain's restore step, needed again here
-- because platform_admin_lockout was applied directly (`migrate dev`, not
-- `--create-only`) before this was caught.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ingredients', 'recipe_items', 'stock_levels', 'stock_locations', 'stock_movements',
    'subscriptions', 'subscription_invoices'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid',
      t
    );
  END LOOP;
END
$$;