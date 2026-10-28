#!/bin/bash
# Ante Mortem — server bootstrap (Ubuntu 24.04). Idempotent. Run as root.
#   JUMP_IP=203.0.113.4 sudo -E bash server-bootstrap.sh
set -euo pipefail
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
info() { echo -e "${G}[+]${N} $1"; }; warn() { echo -e "${Y}[!]${N} $1"; }; die() { echo -e "${R}[✗]${N} $1"; exit 1; }
[[ $EUID -ne 0 ]] && die "run as root"

APP=antemortem; APP_DIR="/opt/$APP"; DEPLOY_USER=deploy; JUMP_IP="${JUMP_IP:-}"

info "System packages"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades age rclone curl

if ! command -v docker &>/dev/null; then
  info "Docker"; curl -fsSL https://get.docker.com | sh; systemctl enable --now docker
fi
docker compose version &>/dev/null || apt-get install -y -qq docker-compose-plugin

if ! id "$DEPLOY_USER" &>/dev/null; then
  info "Deploy user"; useradd -m -s /bin/bash -G docker "$DEPLOY_USER"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
else
  usermod -aG docker "$DEPLOY_USER" || true
fi
mkdir -p "$APP_DIR/backups"; chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

info "Firewall (SSH from jump IP; 80/443 open for Caddy)"
ufw default deny incoming; ufw default allow outgoing
ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 443/udp
if [ -n "$JUMP_IP" ]; then ufw allow from "$JUMP_IP" to any port 22 proto tcp; ufw delete allow ssh 2>/dev/null || true
else ufw allow ssh; warn "SSH open to all — set JUMP_IP to restrict"; fi
ufw --force enable

AUTHKEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
if [ -s "$AUTHKEYS" ]; then
  info "SSH hardening (key-only)"
  cat > /etc/ssh/sshd_config.d/10-$APP.conf <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
  sshd -t && (systemctl reload ssh || systemctl reload sshd) || { rm -f /etc/ssh/sshd_config.d/10-$APP.conf; warn "sshd test failed, hardening skipped"; }
else
  warn "No $AUTHKEYS yet — SSH not hardened. Add the key, re-run."
fi

if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 4096 ] && [ ! -f /swapfile ]; then
  info "2G swap"; fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab; echo 'vm.swappiness=10' >> /etc/sysctl.conf; sysctl -p >/dev/null
fi

printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\nAPT::Periodic::AutocleanInterval "7";\n' > /etc/apt/apt.conf.d/20auto-upgrades
systemctl enable --now fail2ban

mkdir -p /etc/docker
printf '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}\n' > /etc/docker/daemon.json
systemctl restart docker

info "Nightly off-site DB backup timer"
cat > /etc/systemd/system/$APP-backup.service <<EOF
[Unit]
Description=Ante Mortem encrypted DB backup to R2
After=docker.service
[Service]
Type=oneshot
User=$DEPLOY_USER
Group=docker
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/deploy.sh backup-offsite
EOF
printf '[Unit]\nDescription=Nightly Ante Mortem backup\n[Timer]\nOnCalendar=*-*-* 03:15:00\nPersistent=true\n[Install]\nWantedBy=timers.target\n' > /etc/systemd/system/$APP-backup.timer

systemctl daemon-reload
systemctl enable --now $APP-backup.timer

cat > "/home/$DEPLOY_USER/.$APP-aliases" <<EOF
alias dn='cd $APP_DIR'
alias dncompose='docker compose -f $APP_DIR/docker-compose.prod.yml'
alias dnstatus='cd $APP_DIR && ./deploy.sh status'
EOF
grep -q ".$APP-aliases" "/home/$DEPLOY_USER/.bashrc" || echo "[ -f ~/.$APP-aliases ] && source ~/.$APP-aliases" >> "/home/$DEPLOY_USER/.bashrc"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.$APP-aliases"

info "Bootstrap done. Next: point DNS A record at this box, copy compose/Caddyfile/scripts/.env into $APP_DIR, docker login ghcr.io, rclone config (remote 'r2'), first deploy."
