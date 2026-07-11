#!/bin/bash
# Creates the SpruVex R databases owned by spruvex_admin and grants runtime
# privileges to spruvex_app. Runs once on first container start.
set -euo pipefail

for db in spruvex_r spruvex_r_test; do
  if ! psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
    createdb -U "$POSTGRES_USER" -O spruvex_admin "$db"
  fi
  psql -U "$POSTGRES_USER" -d "$db" <<SQL
GRANT CONNECT ON DATABASE $db TO spruvex_app;
GRANT USAGE ON SCHEMA public TO spruvex_app;
GRANT ALL ON SCHEMA public TO spruvex_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE spruvex_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spruvex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE spruvex_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO spruvex_app;
SQL
done
