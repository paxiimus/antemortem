#!/bin/bash
# Ante Mortem — server-side deploy helper. Lives at /opt/antemortem/deploy.sh.
#
#   ./deploy.sh status | deploy <tag> | rollback | logs [svc] | restart [svc] | restart-hard
#   ./deploy.sh run [flags] <svc> <cmd…> one-shot in a throwaway container at the deployed tag
#   ./deploy.sh backup | backup-offsite | restore <file.sql.gz> | reset-db
#   ./deploy.sh shell | dbshell | smoke [url] | env-check | prune
set -euo pipefail
COMPOSE="docker compose -f docker-compose.prod.yml"
cd "$(dirname "$0")"

read_env() { [ -f .env ] || return 0; grep -E "^${1}=" .env | head -1 | cut -d= -f2- | sed -E 's/^"([^"]*)"$/\1/'; }
DB_USER="$(read_env DB_USER)"; DB_USER="${DB_USER:-antemortem}"
DB_NAME="$(read_env DB_NAME)"; DB_NAME="${DB_NAME:-antemortem}"
GHCR_OWNER="$(read_env GHCR_OWNER)"
BACKUP_REMOTE="$(read_env BACKUP_RCLONE_REMOTE)"   # e.g. r2:antemortem-backups

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
info() { echo -e "${G}[+]${N} $1"; }; warn() { echo -e "${Y}[!]${N} $1"; }; err() { echo -e "${R}[✗]${N} $1"; }
health() { $COMPOSE exec -T backend curl -sf -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/ready/ 2>/dev/null || echo 000; }
dump() { mkdir -p backups; $COMPOSE exec -T db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "backups/$1_$(date +%Y%m%d_%H%M%S).sql.gz"; ls -t backups/$1_*.sql.gz | head -1; }
app_up() { $COMPOSE up -d --no-deps "$@"; }
deployed_tag() { cat .current-deploy 2>/dev/null || echo main; }
APP_SVCS="backend celery celery-beat"
REQUIRED_ENV="DJANGO_SECRET_KEY DOMAIN DB_NAME DB_USER DB_PASSWORD GHCR_OWNER ALLOWED_HOSTS CORS_ALLOWED_ORIGINS APP_URL POSTMARK_TOKEN" 

case "${1:-help}" in
  status)
    echo "Current:  $(cat .current-deploy 2>/dev/null || echo unknown)"
    echo "Previous: $(cat .previous-deploy 2>/dev/null || echo none)"; echo
    $COMPOSE ps; echo
    df -h / | tail -1 | awk '{print "Disk:", $3, "/", $2, "("$5")"}'
    $COMPOSE exec -T backend curl -sf http://localhost:8000/api/health/ready/ | python3 -m json.tool || err "backend unreachable" ;;

  deploy)
    TAG="${2:?usage: deploy <tag>}"; [ -n "$GHCR_OWNER" ] || { err "GHCR_OWNER missing from .env"; exit 1; }
    info "Deploying $TAG"
    info "Pre-deploy backup: $(dump pre-deploy)"
    [ -f .current-deploy ] && cp .current-deploy .previous-deploy
    echo "$TAG" > .current-deploy; export DEPLOY_TAG="$TAG"
    $COMPOSE pull backend celery celery-beat caddy
    $COMPOSE run --rm backend python manage.py migrate --noinput
    app_up backend; sleep 8; app_up celery celery-beat caddy; sleep 5
    S=$(health); if [ "$S" = 200 ]; then info "✅ $TAG healthy"; else warn "health HTTP $S — consider ./deploy.sh rollback"; exit 1; fi
    docker image prune -f --filter "until=72h" >/dev/null || true ;;

  rollback)
    PREV=$(cat .previous-deploy 2>/dev/null || true); [ -n "$PREV" ] || { err "no previous tag"; exit 1; }
    warn "Rolling back $(cat .current-deploy) → $PREV"
    export DEPLOY_TAG="$PREV"; app_up backend celery celery-beat; echo "$PREV" > .current-deploy; sleep 8
    S=$(health); [ "$S" = 200 ] && info "✅ rollback healthy" || { err "health HTTP $S"; exit 1; } ;;

  logs)     $COMPOSE logs -f --tail=100 "${2:-backend}" ;;
  backup)   info "Backup: $(dump manual)" ;;

  backup-offsite)
    # Encrypted with age to the public key in .env, pushed with rclone. The ciphertext in the
    # DB is useless without user keys, but the dump still carries emails + schedules — encrypt it.
    [ -n "$BACKUP_REMOTE" ] || { err "BACKUP_RCLONE_REMOTE not set in .env"; exit 1; }
    AGE_PUB="$(read_env BACKUP_AGE_RECIPIENT)"; [ -n "$AGE_PUB" ] || { err "BACKUP_AGE_RECIPIENT not set"; exit 1; }
    command -v age >/dev/null && command -v rclone >/dev/null || { err "need age + rclone on the host"; exit 1; }
    F=$(dump offsite); age -r "$AGE_PUB" -o "$F.age" "$F" && rm -f "$F"
    rclone copy "$F.age" "$BACKUP_REMOTE/db/" && info "Uploaded $(basename "$F.age")"
    ls -t backups/offsite_*.age | tail -n +8 | xargs -r rm -f ;;

  restore)
    F="${2:-}"; [ -f "$F" ] || { err "usage: restore <backup.sql.gz>"; ls -lh backups/*.sql.gz 2>/dev/null | tail; exit 1; }
    warn "DESTRUCTIVE: replaces the DB with $F"; read -rp "Type 'yes': " C; [ "$C" = yes ] || exit 1
    $COMPOSE stop backend celery celery-beat
    info "Safety backup: $(dump pre-restore)"
    $COMPOSE exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid();" \
      -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
    gunzip -c "$F" | $COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
    $COMPOSE start backend celery celery-beat; sleep 8; info "health HTTP $(health)" ;;

  run)
    # Everything after `run` goes to `docker compose run --rm`, so -e/-v flags before the
    # service name work: ./deploy.sh run -e FOO=1 backend python manage.py …
    shift; [ $# -gt 0 ] || { err "usage: run [flags] <service> <cmd…>"; exit 1; }
    DEPLOY_TAG="$(deployed_tag)" $COMPOSE run --rm "$@" ;;

  restart-hard)
    info "Force-recreating $APP_SVCS caddy at $(deployed_tag) (re-reads .env)"
    DEPLOY_TAG="$(deployed_tag)" $COMPOSE up -d --force-recreate $APP_SVCS caddy
    sleep 8; S=$(health); [ "$S" = 200 ] && info "✅ healthy" || { err "health HTTP $S"; exit 1; } ;;

  env-check)
    rc=0
    for v in $REQUIRED_ENV; do
      if grep -qE "^${v}=." .env 2>/dev/null; then echo "  ✓ $v"; else echo "  ✗ $v"; rc=1; fi
    done; exit $rc ;;

  shell)    $COMPOSE exec backend python manage.py shell ;;
  dbshell)  $COMPOSE exec db psql -U "$DB_USER" "$DB_NAME" ;;
  restart)  $COMPOSE restart ${2:-} ;;
  smoke)    ./post-deploy-smoke.sh "${2:-http://localhost:8000}" ;;

  prune)
    warn "Removes stopped containers, dangling images, unused volumes."; read -rp "Type 'yes': " C; [ "$C" = yes ] || exit 1
    docker system prune -af --volumes ;;

  reset-db)
    warn "DESTRUCTIVE: drops '$DB_NAME'. Pre-launch only."; read -rp "Type 'yes': " C; [ "$C" = yes ] || exit 1
    info "Safety backup: $(dump pre-reset)"
    $COMPOSE stop backend celery celery-beat
    $COMPOSE exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid();" \
      -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
    DEPLOY_TAG="$(deployed_tag)" $COMPOSE run --rm backend python manage.py migrate --noinput
    DEPLOY_TAG="$(deployed_tag)" $COMPOSE up -d $APP_SVCS; sleep 8; info "health HTTP $(health)" ;;

  *) sed -n '3,7p' "$0" ;;
esac
