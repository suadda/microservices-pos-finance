#!/bin/sh
# Runs once per `docker compose up` (service `secrets-init`) before anything else starts.
#
# Writes every stack secret to the `secrets` volume so a fresh clone works with a single
# `docker compose up -d --build` and no secret is ever committed:
#   - a non-empty value passed from .env is written as-is (lets you pin your own secrets),
#   - otherwise a missing secret is generated once and then kept across restarts.
# `docker compose down -v` removes this volume together with the databases, so both stay in sync.
set -eu

DIR=${SECRETS_DIR:-/secrets}
mkdir -p "$DIR"
umask 022

rand_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
rand_app_key() { printf 'base64:%s' "$(head -c 32 /dev/urandom | base64 | tr -d '\n')"; }

# put NAME GENERATOR  ->  file $DIR/name (lowercase)
put() {
  name=$1
  file="$DIR/$(printf '%s' "$name" | tr 'A-Z' 'a-z')"
  value=$(printenv "$name" || true)

  if [ -n "$value" ]; then
    printf '%s' "$value" > "$file"
  elif [ ! -s "$file" ]; then
    $2 > "$file"
    echo "[secrets-init] generated $name"
  fi
  # Readable by the mysql user (uid 999) inside the database containers; the volume is only mounted by this stack.
  chmod 0644 "$file"
}

put APP_KEY_AUTH rand_app_key
put APP_KEY_POS rand_app_key
put APP_KEY_FINANCE rand_app_key
put JWT_SECRET "rand_hex 32"
put INTERNAL_API_KEY "rand_hex 24"
put DB_AUTH_ROOT_PASSWORD "rand_hex 24"
put DB_AUTH_PASSWORD "rand_hex 24"
put DB_POS_ROOT_PASSWORD "rand_hex 24"
put DB_POS_PASSWORD "rand_hex 24"
put DB_FINANCE_ROOT_PASSWORD "rand_hex 24"
put DB_FINANCE_PASSWORD "rand_hex 24"

echo "[secrets-init] ready"
