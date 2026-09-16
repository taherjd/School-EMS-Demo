#!/bin/sh
set -e
# Apply pending migrations on start (idempotent), then optionally seed demo data.
npx prisma migrate deploy
if [ "$SEED_DEMO_DATA" = "true" ]; then
  npx prisma db seed || echo "seed skipped (already seeded?)"
fi
exec "$@"
