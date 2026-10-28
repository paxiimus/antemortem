#!/bin/sh
# Wait for Postgres, optionally migrate (off by default — deploy.sh runs it as a one-shot), then exec.
set -e
until python -c "import django,os;os.environ.setdefault('DJANGO_SETTINGS_MODULE','antemortem.settings');django.setup();from django.db import connection;connection.ensure_connection()" 2>/dev/null; do
  echo "waiting for db…"; sleep 2
done
[ "${ANTEMORTEM_AUTO_MIGRATE:-0}" = "1" ] && python manage.py migrate --noinput
exec "$@"
