# Deploying Ante Mortem

Local dev, then production on one Hetzner box. Everything here is driven by the `Makefile`; run `make help` for the target list.

```
your machine ── make push-backend ──▶ GHCR image (antemortem-backend:main-<sha>)
      │                                      │
      └── make deploy-backend ── ssh ──▶ box: ./deploy.sh pulls, backs up, migrates, restarts, health-checks
                                         caddy (TLS) → backend (gunicorn) + celery + celery-beat + postgres + redis
```

Keys only ever touch the mobile app. The server stores ciphertext, emails and timestamps.

## 0. Tools

Docker (with Compose v2), Python 3.12, Node 22, `git`, `make`. For production add `hcloud`, `ssh`, `age` (`age-keygen`), and an Expo account with `eas-cli` for store builds.

## 1. One-time repo prep (do this first)

The repo ships without two generated artifacts. Without them the image won't build and the database will have no tables.

```bash
# Lockfiles (the Dockerfile uses `npm ci`, which refuses to run without one)
(cd packages/crypto && npm install)
(cd packages/core && npm install)

# Migrations
pip install -r backend/requirements.txt
(cd backend && python manage.py makemigrations core)

git add -A && git commit -m "Add lockfiles and initial migrations"
```

Check: `ls backend/core/migrations/0001_initial.py packages/crypto/package-lock.json`.

## 2. Local dev

### Backend

```bash
make dev                      # Postgres, Redis, Django on :8000, Celery worker + beat; auto-migrates
curl localhost:8000/api/health/ready/
docker compose exec api python manage.py createsuperuser     # admin at /admin/
```

- With no `POSTMARK_TOKEN`, emails are printed to the `api`/`worker` logs instead of sent: `docker compose logs -f worker`.
- Code is bind-mounted, so Django reloads on save. The image's built tlock CLI stays available at `/app/crypto`.
- The public cemetery is at `http://localhost:8000/cemetery/`.

### Tests

```bash
make test        # Django tests (SQLite fallback) + crypto tests incl. TS↔Python Shamir cross-check
```

Needs `pip install -r backend/requirements.txt` and `npm install` in `packages/crypto` first.

### Mobile

```bash
make setup-mobile             # Expo at the latest SDK, every package resolved by `expo install`
                              # (make setup-mobile UPGRADE=1 bumps the SDK later)
cd app
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000 npx expo start
```

- `react-native-libsodium` is a native module, so **Expo Go won't work**. Use a development build: `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`.
- Use your LAN IP, not `localhost`, so a phone can reach the API.
- Universal links need the real domain and don't work locally. To test the contact flow, open the scheme directly with a token from the admin: `npx uri-scheme open antemortem://c/<token> --ios` (or `--android`).

## 3. Production, first deploy

### 3.1 Accounts and keys

| What | How |
|---|---|
| Hetzner project + API token (read/write) | `hcloud context create antemortem` |
| Two SSH keys | `ssh-keygen -t ed25519 -f ~/.ssh/antemortem_deploy` and `... -f ~/.ssh/antemortem_admin` |
| GHCR token | GitHub PAT with `write:packages`; `echo $PAT \| docker login ghcr.io -u <user> --password-stdin` |
| Postmark | A server with a stream named `antemortem`; verify the domain (SPF + DKIM), or release emails will land in spam |
| Backups | An R2 bucket `antemortem-backups` plus an API token; `age-keygen -o backup.key` and **keep `backup.key` off the box** |
| Domain | `antemortem.fyi`, auto-renew on, registrar lock on |

Make the GHCR package public after the first push (GitHub → Packages → antemortem-backend → settings). The code is open source, so the box then needs no registry login.

### 3.2 Config files

```bash
cp .hetzner.env.example .hetzner.env && chmod 600 .hetzner.env     # JUMP_IP = your static IP
mkdir -p secrets && cp .env.production.example secrets/.env.prod && chmod 600 secrets/.env.prod
cp .deploy.env.example .deploy.env
```

Fill `secrets/.env.prod`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"   # DB_PASSWORD
```

Also set `POSTMARK_TOKEN`, `BACKUP_AGE_RECIPIENT` (the `age1…` public key from `backup.key`), and `GHCR_OWNER`. Leave `IOS_APP_ID` and `ANDROID_CERT_FINGERPRINTS` until the app is in the stores (section 5). Delete the unused `app.antemortem.fyi` CORS/CSRF entries if you like; there is no web client.

`.deploy.env` gets `PROD_HOST` once you know the IP.

### 3.3 Provision the box

Run from the machine whose IP is `JUMP_IP`. This creates the firewall, SSH key and server, bootstraps it (ufw, fail2ban, key-only SSH, swap, auto-updates, backup timer), and uploads compose, Caddyfile, scripts and `.env`.

```bash
RUN_DEPLOY=0 ./scripts/provision-hetzner.sh
```

If `hcloud` rejects the server type, run `hcloud server-type list` and set `DN_SERVER_TYPE`. The script prints the IP; put it in `.deploy.env` as `PROD_HOST`.

### 3.4 DNS

Add an **A record** `api.antemortem.fyi → <server IP>` now. Caddy needs it, and port 80 reachable, to get the certificate on the first request.

### 3.5 First deploy

```bash
make deploy-backend NO_CACHE=1 FORCE=1
```

This builds the image locally, pushes it, then the box takes a pre-deploy backup, pulls, migrates, restarts and checks health. `FORCE=1` skips the clean-tree check, which needs a git upstream; drop it once the repo is on GitHub. The last step, `make health`, fails until DNS resolves. If that happens, the deploy itself still succeeded: fix DNS and run `make health`.

### 3.6 Finish setup

```bash
make superuser SU_USER=you SU_EMAIL=you@example.com SU_PASSWORD='…'   # lands in shell history; clear it
make smoke                                                            # black-box check of the public URL
make env-check                                                        # required vars present, values hidden
make ssh                                                              # then, ON the box, as the deploy user:
  rclone config                                                       #   create a remote named r2 (S3 API → R2)
  ./deploy.sh backup-offsite                                          #   test a real off-site backup
  systemctl list-timers | grep antemortem                             #   confirm the nightly 03:15 timer
```

The timer runs as `deploy`, so `rclone config` must be done as that user.

Restore test: download an `.age` file from R2, decrypt it with `age -d -i backup.key`, and restore it on a scratch box. A backup you've never restored is a guess.

## 4. Day to day

| Task | Command |
|---|---|
| Ship a change | `make deploy-backend` (tree must be clean and pushed) |
| Status / logs | `make status`, `make logs SVC=celery` (backend, celery, celery-beat, caddy, db) |
| Undo a bad deploy | `make rollback` (previous image; the deploy also fails loudly on a bad health check) |
| Changed `.env` on the box | edit it, then `make restart-hard` |
| Changed compose or Caddyfile | `make sync && make restart-hard` |
| Migration drift check | `make migrate-check` |
| One-off Django command | `make manage ARGS='showmigrations'` (non-interactive), `make shell`, `make dbshell` |
| Backup now | `make backup` (dump kept on the box) / `make backup-offsite` (age-encrypted to R2) |
| Restore a dump | on the box: `./deploy.sh restore backups/<file>.sql.gz` (takes a safety backup, recreates the DB, loads the dump) |
| Wipe pre-launch data | `make db-reset I_UNDERSTAND=destroy-production-data` (asks you to retype the host) |

`make deploy-backend NO_CACHE=1` forces a fresh image build if you suspect a stale layer.

## 5. Mobile release

1. `cd app && eas login && eas init`, then `make deploy-mobile` for an Android preview build (`PLATFORM=ios` for iOS). EAS builds use free-tier minutes.
2. Get the iOS Team ID (Apple developer account) and the Android signing-cert SHA-256 (EAS credentials or Play Console → App signing).
3. On the box, set in `.env`: `IOS_APP_ID=<TeamID>.com.paxiimus.antemortem`, `ANDROID_CERT_FINGERPRINTS=<sha256,…>`, `IOS_URL`, `ANDROID_URL`; then `make restart-hard`.
4. Verify the link files the stores check:
   `curl https://api.antemortem.fyi/.well-known/apple-app-site-association` and `.../assetlinks.json`.
5. Submit to the stores. Review notes: the app is a vault and a dead man's switch; it is not a will or legal service.

## 6. If you're not around

- SSH is locked to `JUMP_IP` in both the Hetzner firewall and `ufw`. A successor on another network can't connect until they edit the Hetzner firewall rule from the Hetzner web console and, on the box, `ufw allow from <their IP> to any port 22`. Write this in the runbook.
- What a successor needs: Hetzner login, domain registrar, GHCR, Postmark, R2, the age private key, the two SSH keys, and `secrets/.env.prod`. Keep them in a password manager with emergency access.
- The box runs unattended: Docker restart policies, automatic security updates, Caddy cert renewal, and the nightly backup timer.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `docker build` fails at `npm ci` | No `package-lock.json` in `packages/crypto`: section 1 |
| Deploy "healthy" but pages 500, or `relation … does not exist` | No migrations committed: section 1, then redeploy |
| `make health` fails right after first deploy | DNS not pointing yet; Caddy gets the cert on the first request after it does |
| 400 Bad Request on every call | `ALLOWED_HOSTS` doesn't include the host you're calling |
| Backend exits with "CORS_ALLOWED_ORIGINS must be set" | Set it in `.env` (non-debug requires it) |
| `deploy.sh deploy` says health HTTP 000 | `make logs SVC=backend`; if it's a bad release, `make rollback` |
| `backup-offsite` fails | `age`/`rclone` missing, no `r2` remote for the deploy user, or `BACKUP_AGE_RECIPIENT` unset |
| Emails not arriving | Postmark domain not verified, wrong stream name, or `POSTMARK_TOKEN` empty (it only logs) |
| Locked out of SSH | Your IP changed; edit the Hetzner firewall and use the web console |

## 8. Make targets

`dev` `test` `setup-mobile` · `push-backend` `deploy-backend` `deploy-mobile` · `status` `logs` `rollback` `restart` `restart-hard` `ssh` `root-ssh` `shell` `dbshell` `manage` · `backup` `backup-offsite` `migrate` `migrate-check` `superuser` · `health` `smoke` `env-check` · `sync` · `db-reset`. `make help` prints one-line descriptions.

## Not covered yet

- The end-to-end release flow (seal → miss check-ins → cooling-off → attest → open) on the drand testnet. Run it before real users.
- The successor runbook (`RUNBOOK.md`) with the actual account details.
