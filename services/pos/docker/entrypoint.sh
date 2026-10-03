#!/bin/sh
# Migrate + seed (both idempotent), cache config/routes, then serve on :8000.
set -e

# Secrets arrive as files (docker volume written by secrets-init). Export each *_FILE as the plain
# variable unless that variable was already given directly.
for name in APP_KEY DB_PASSWORD JWT_SECRET INTERNAL_API_KEY; do
  file=$(printenv "${name}_FILE" || true)
  if [ -n "$file" ] && [ -z "$(printenv "$name" || true)" ]; then
    [ -r "$file" ] || { echo "[entrypoint] secret file $file not readable" >&2; exit 1; }
    export "$name=$(cat "$file")"
  fi
done

attempt=0
until php artisan migrate --force --no-interaction; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[entrypoint] database unreachable, giving up" >&2
    exit 1
  fi
  echo "[entrypoint] database not ready, retry ${attempt}/30"
  sleep 3
done

php artisan db:seed --force --no-interaction
php artisan config:cache
php artisan route:cache

exec frankenphp php-server --listen :8000 --root public/
