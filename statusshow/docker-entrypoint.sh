#!/bin/sh
set -e

envsubst '${STATUS_BACKEND_URL} ${STATUS_TOKEN} ${STATUS_NAME}' \
  < /app/config.json.template \
  > /app/config.json

echo "[entrypoint] config.json generated:"
cat /app/config.json

exec serve -s /app -l tcp://0.0.0.0:3000
