#!/usr/bin/env bash
# Ante Mortem — one-command Hetzner provisioner. Run from the JUMP_IP host.
#   hcloud → firewall (SSH from JUMP_IP) + ssh key + server with cloud-init that runs server-bootstrap.sh
#   then: push compose/scripts/.env over SSH, GHCR login, first deploy via make.
# Config via .hetzner.env (see .hetzner.env.example) or inline env. Inline wins.
set -euo pipefail
die() { echo "✗ $1" >&2; exit 1; }; info() { echo "▸ $1"; }

ENVF="${HETZNER_ENV:-.hetzner.env}"
if [ -f "$ENVF" ]; then
  info "Loading $ENVF"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"; case "$line" in ''|'#'*) continue;; esac
    line="${line#export }"; key="${line%%=*}"; val="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    val="${val#"${val%%[![:space:]]*}"}"
    case "$val" in '#'*) val="";; \"*) val="${val#\"}"; val="${val%%\"*}";; \'*) val="${val#\'}"; val="${val%%\'*}";;
      *) val="${val%%[[:space:]]#*}"; val="${val%"${val##*[![:space:]]}"}";; esac
    [ -z "${!key:-}" ] && export "$key=$val"
  done < "$ENVF"
fi

APP=antemortem
SERVER_NAME="${DN_SERVER_NAME:-$APP-prod}"
SERVER_TYPE="${DN_SERVER_TYPE:-cx22}"          # 2 vCPU / 4 GB — plenty; this stack idles
LOCATION="${DN_LOCATION:-nbg1}"
IMAGE="${DN_IMAGE:-ubuntu-24.04}"
FW_NAME="${DN_FW_NAME:-$APP-fw}"
SSHKEY_NAME="${DN_SSHKEY_NAME:-$APP-admin}"
: "${JUMP_IP:?set JUMP_IP}"; : "${ENV_FILE:?set ENV_FILE=/path/to/filled .env}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/${APP}_deploy}"; DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-$DEPLOY_KEY.pub}"
ADMIN_PUBKEY="${ADMIN_PUBKEY:-$DEPLOY_PUBKEY}"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"; COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/docker-compose.prod.yml}"
BOOTSTRAP="${BOOTSTRAP:-$REPO_ROOT/scripts/server-bootstrap.sh}"
GHCR_USER="${GHCR_USER:-}"; GHCR_PAT="${GHCR_PAT:-}"; RUN_DEPLOY="${RUN_DEPLOY:-1}"

command -v hcloud >/dev/null || die "hcloud CLI missing"
for f in "$ADMIN_PUBKEY" "$DEPLOY_PUBKEY" "$DEPLOY_KEY" "$ENV_FILE" "$BOOTSTRAP" "$COMPOSE_FILE"; do [ -f "$f" ] || die "missing: $f"; done

if [ "${SKIP_IP_CHECK:-0}" != 1 ]; then
  MYIP="$(curl -fsS4 --max-time 6 https://ifconfig.me 2>/dev/null | tr -d '[:space:]' || true)"
  [ -z "$MYIP" ] || [ "$MYIP" = "$JUMP_IP" ] || die "your IP $MYIP != JUMP_IP $JUMP_IP (SKIP_IP_CHECK=1 to bypass)"
fi
[ "$RUN_DEPLOY" = 1 ] && ! docker info >/dev/null 2>&1 && die "local Docker unreachable (deploy builds here); or RUN_DEPLOY=0"

info "Firewall $FW_NAME: SSH from $JUMP_IP; 80/443 public"
hcloud firewall describe "$FW_NAME" >/dev/null 2>&1 || hcloud firewall create --name "$FW_NAME"
R=$(mktemp); printf '[{"direction":"in","protocol":"tcp","port":"22","source_ips":["%s/32"]},{"direction":"in","protocol":"tcp","port":"80","source_ips":["0.0.0.0/0","::/0"]},{"direction":"in","protocol":"tcp","port":"443","source_ips":["0.0.0.0/0","::/0"]},{"direction":"in","protocol":"udp","port":"443","source_ips":["0.0.0.0/0","::/0"]}]' "$JUMP_IP" > "$R"
hcloud firewall replace-rules "$FW_NAME" --rules-file "$R"; rm -f "$R"

if ! hcloud ssh-key describe "$SSHKEY_NAME" >/dev/null 2>&1 && \
   ! hcloud ssh-key create --name "$SSHKEY_NAME" --public-key-from-file "$ADMIN_PUBKEY" >/dev/null 2>&1; then
  FP="$(ssh-keygen -l -E sha256 -f "$ADMIN_PUBKEY" | awk '{print $2}')"
  SSHKEY_NAME="$(hcloud ssh-key list -o noheader -o columns=name,fingerprint | awk -v f="$FP" '$2==f{print $1;exit}')"
  [ -n "$SSHKEY_NAME" ] || die "ssh-key create failed and no matching key found"
fi

info "cloud-init"
CI=$(mktemp)
cat > "$CI" <<YAML
#cloud-config
users:
  - default
  - name: deploy
    shell: /bin/bash
    ssh_authorized_keys: ["$(cat "$DEPLOY_PUBKEY")"]
write_files:
  - path: /root/server-bootstrap.sh
    permissions: '0700'
    encoding: b64
    content: $(base64 -w0 "$BOOTSTRAP" 2>/dev/null || base64 "$BOOTSTRAP" | tr -d '\n')
runcmd:
  - [ bash, -lc, "JUMP_IP=$JUMP_IP bash /root/server-bootstrap.sh >> /var/log/$APP-bootstrap.log 2>&1" ]
YAML

if hcloud server describe "$SERVER_NAME" >/dev/null 2>&1; then info "Server exists — resuming"
else info "Creating $SERVER_NAME ($SERVER_TYPE, $LOCATION)"
  hcloud server create --name "$SERVER_NAME" --type "$SERVER_TYPE" --image "$IMAGE" --location "$LOCATION" \
    --ssh-key "$SSHKEY_NAME" --firewall "$FW_NAME" --user-data-from-file "$CI"; fi
rm -f "$CI"
IP="$(hcloud server ip "$SERVER_NAME")"; info "IP: $IP"; ssh-keygen -R "$IP" >/dev/null 2>&1 || true

SSHO=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 -i "$DEPLOY_KEY")
info "Waiting for bootstrap…"
for i in $(seq 1 60); do ssh "${SSHO[@]}" "deploy@$IP" true 2>/dev/null && break; sleep 10; [ "$i" = 60 ] && die "SSH timeout"; done
ssh "${SSHO[@]}" "deploy@$IP" 'cloud-init status --wait' || true

info "Uploading compose, scripts, .env"
scp "${SSHO[@]}" "$COMPOSE_FILE" "deploy@$IP:/opt/$APP/docker-compose.prod.yml"
scp "${SSHO[@]}" "$REPO_ROOT/Caddyfile" "deploy@$IP:/opt/$APP/Caddyfile"
scp "${SSHO[@]}" "$REPO_ROOT"/scripts/{deploy.sh,post-deploy-smoke.sh} "deploy@$IP:/opt/$APP/"
scp "${SSHO[@]}" "$ENV_FILE" "deploy@$IP:/opt/$APP/.env"
ssh "${SSHO[@]}" "deploy@$IP" "cd /opt/$APP && cp -f scripts/deploy.sh scripts/post-deploy-smoke.sh ./ && chmod 600 .env && chmod +x *.sh scripts/*.sh"

if [ -n "$GHCR_USER" ] && [ -n "$GHCR_PAT" ]; then
  ssh "${SSHO[@]}" "deploy@$IP" "echo '$GHCR_PAT' | docker login ghcr.io -u '$GHCR_USER' --password-stdin"
else info "skip GHCR login (set GHCR_USER + GHCR_PAT)"; fi

if [ "$RUN_DEPLOY" = 1 ]; then
  ssh "${SSHO[@]}" "deploy@$IP" "cd /opt/$APP && docker compose -f docker-compose.prod.yml up -d db redis"
  ssh "${SSHO[@]}" "deploy@$IP" "cd /opt/$APP && for i in \$(seq 1 40); do docker compose -f docker-compose.prod.yml ps db | grep -qF '(healthy)' && exit 0; sleep 3; done; exit 1" || die "db never healthy"
  ( cd "$REPO_ROOT" && make deploy-backend NO_CACHE=1 FORCE=1 PROD_HOST="$IP" )
fi

cat <<DONE

  $SERVER_NAME up — $IP
  Remaining: A record for DOMAIN → $IP (Caddy fetches the cert on first request);
  rclone config on the box (remote 'r2') for backups; make superuser PROD_HOST=$IP …
DONE
