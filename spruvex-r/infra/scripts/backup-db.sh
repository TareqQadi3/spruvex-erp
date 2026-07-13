#!/bin/bash
# Daily backup for the SpruVex R production database.
#
# Usage (cron, run on the Docker host):
#   0 3 * * * BACKUP_DIR=/var/backups/spruvex-r /path/to/backup-db.sh >> /var/log/spruvex-backup.log 2>&1
#
# Requires: the `postgres` service from docker-compose.prod.yml running,
# and this script run from the directory containing docker-compose.prod.yml
# (or pass COMPOSE_FILE to point at it explicitly).
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_NAME="${DB_NAME:-spruvex_r}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d-%H%M%S)"
out_file="$BACKUP_DIR/spruvex-r-$timestamp.dump"

echo "[backup-db] dumping $DB_NAME -> $out_file"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U spruvex_admin --format=custom "$DB_NAME" > "$out_file"

# Fail loudly on an empty/truncated dump rather than silently keeping a
# useless backup file around.
if [ ! -s "$out_file" ]; then
  echo "[backup-db] ERROR: $out_file is empty — dump likely failed" >&2
  rm -f "$out_file"
  exit 1
fi
echo "[backup-db] OK: $(du -h "$out_file" | cut -f1)"

echo "[backup-db] pruning dumps older than $RETENTION_DAYS days in $BACKUP_DIR"
find "$BACKUP_DIR" -name 'spruvex-r-*.dump' -mtime "+$RETENTION_DAYS" -print -delete

echo "[backup-db] done. Remember: copy $BACKUP_DIR off this host (S3 or similar) —"
echo "[backup-db] a backup that lives only on the machine it protects against isn't one."
