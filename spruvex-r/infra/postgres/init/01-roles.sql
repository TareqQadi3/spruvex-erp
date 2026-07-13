-- SpruVex R — database roles
-- spruvex_admin: owns the schema, runs migrations and seeds. BYPASSRLS so DDL/seeding
--                works, but NOT a superuser.
-- spruvex_app:   runtime role used by the API. NOBYPASSRLS — Row-Level Security is
--                always enforced for application queries.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'spruvex_admin') THEN
    CREATE ROLE spruvex_admin LOGIN PASSWORD 'spruvex_admin' NOSUPERUSER CREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'spruvex_app') THEN
    CREATE ROLE spruvex_app LOGIN PASSWORD 'spruvex_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
