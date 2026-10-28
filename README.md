# Ante Mortem - PreAlpha

*Still here.*

> **Unaudited.** Reviewed by the author only. Don't trust it with anything you can't lose. See [SECURITY.md](SECURITY.md).

A dead man's switch with an end-to-end encrypted vault and last words that nobody — not the server, not your contacts — can read until you're gone. Then they're published, and people can gather round.

## Layout

```
backend/           Django + DRF + Celery. Stores ciphertext, runs the switch, renders the cemetery.
app/               Expo (iOS + Android) — Expo Router + Jotai. The only client that touches keys.
packages/core/     App logic: API client, atoms, owner flows (seal/unlock/re-seal), contact flows (attest/open vault).
packages/crypto/   Shared TS: Argon2id, XChaCha20-Poly1305, Shamir (GF(2^8)), drand tlock.
docker-compose.yml      Local dev stack.
docker-compose.prod.yml Caddy (TLS on the box), GHCR image, Celery, Postgres, Redis.
scripts/                deploy.sh (server), server-bootstrap.sh, provision-hetzner.sh, smoke.
Makefile                Local driver: build/push image, trigger deploy, ops.
```

## Threat model

Assume the server, its database, its backups and its operator are all hostile. Assume a court can order the operator to hand over anything it holds. The design must still prevent early disclosure.

| Asset | Who can read it before death | Who can read it after |
|---|---|---|
| Vault entries | Owner (passphrase → Argon2id → key). Server holds ciphertext only. | Contacts with the vault passphrase the owner gave them offline. |
| Public note | Nobody. Body is under a random key K. K exists only as (a) a tlock ciphertext to a future drand round and (b) a k-of-k Shamir split across contacts. **The server holds no share.** | Anyone — it's published to the cemetery. |

Release of the public note has two independent paths:

- **Attestation (fast).** Every contact confirms the death in the app and submits their decrypted Shamir share. Server opens a 14-day cooling-off; the owner is emailed and can veto by logging in. After cooling-off the server combines the contacts' shares and publishes.
- **Timelock (backstop).** On every save/login the client re-encrypts K to a drand round `horizon_days` ahead (default 540). If the round arrives — contacts dead, estranged, nonexistent — the key materialises on its own and the worker publishes. Invariant enforced by the API: `horizon ≥ 2 × check-in interval`, so a single missed check-in can never trip it.

Known trade-off: collusion of *every* contact could reconstruct K early. Threshold is k-of-k deliberately to make that the worst case. The server cannot participate: it holds ciphertext, emails, timestamps and nothing that decrypts, so a disclosure order against the operator yields nothing readable and a technical-capability notice has no capability to add.

### Why there is no web client

A web page runs whatever JavaScript the server sent *this time* and cannot verify it. Anyone who controls the origin — the operator, a compromised box, a TLS-terminating CDN — can ship a bundle that posts the passphrase home, once, to one user, undetectably. So nothing that touches a key runs in a browser. The app binary is store-signed; swapping it requires the signing key, not the server. The web is read-only: cemetery, memorial pages, condolences, the one-click check-in link (a token, not a key), and `/c/<token>` handoff pages that deep-link contacts into the app.

The remaining trust is in the published build. Reproducible builds with hashes pinned in the git tag close that; it's on the list. Desktop (Tauri) follows the same rule when it ships: a signed installer, never a URL.

## Check-in loop

Daily Celery Beat sweep. Overdue → status `lapsed`, nags at +0/+7/+14 days, contacts asked at +30. Nothing publishes from lapsing alone. One-click check-in link in every email.

## Running

**Local**

```sh
docker compose up            # Postgres, Redis, Django (auto-migrate), worker+beat
cd backend && pip install -r requirements.txt && python manage.py test
cd packages/crypto && npm i && npm test   # Node ≥ 22.6; includes TS↔Python Shamir cross-check
```

**Mobile**

```sh
make setup-mobile                          # or: cd app && npm run setup
cd app && npx expo start                   # iOS/Android; the API is the only web surface
make setup-mobile UPGRADE=1                # move to the newest Expo SDK and realign every package
```

`app/package.json` pins nothing Expo owns. `scripts/setup-mobile.sh` installs `expo@latest` (or the pinned SDK), then runs `npx expo install` over the full list so every Expo and React Native package lands at the version that SDK supports, then `expo install --fix` and `expo-doctor`. Re-run it after any SDK bump instead of editing versions by hand.

Flow: sign in → unlock (Argon2id over the vault passphrase, key held in memory only) → tabs. The owner keeps an editable copy of the public note under the vault key; on each unlock, if the drand round is past half the horizon, the client re-seals with a fresh key, fresh round and fresh k-of-k split, and pushes new shares to every contact. Adding or removing a contact also re-seals. Contact share passphrases are derived from the vault key (`blake2b(vaultKey, "contact:<id>")`) so they stay stable across re-seals; the owner reveals each once and hands it over offline.

All of that logic lives in `packages/core`; `app/` is UI only. Contacts open `antemortem://c/<token>` (or the https universal link) and attest or read the vault in the same app without an account. On native, `metro.config.js` swaps `libsodium-wrappers-sumo` for `react-native-libsodium`; `tlock-js` needs the `buffer` polyfill, loaded in the root layout.

**Production** — image built locally, pushed to GHCR, pulled by `./deploy.sh` on a Hetzner box. Caddy terminates TLS on the box with Let's Encrypt; 80/443 public, SSH locked to your jump IP. No tunnel, no CDN. Caddy's CSP is `script-src 'none'` — the server pages carry no JavaScript at all.

```sh
cp .deploy.env.example .deploy.env       # PROD_HOST, keys, PROD_API
cp .hetzner.env.example .hetzner.env     # JUMP_IP, ENV_FILE
cp .env.production.example secrets/.env.prod   # fill in
./scripts/provision-hetzner.sh           # creates + hardens the box, first deploy
make deploy-backend                      # thereafter
make superuser SU_USER=… SU_EMAIL=… SU_PASSWORD=…
```

Layout on the box: `/opt/antemortem/{docker-compose.prod.yml,Caddyfile,deploy.sh,post-deploy-smoke.sh,.env,backups/}`. `make sync` pushes the first four; `make` with no target lists everything else. Set `DOMAIN` in `.env` and point its A record at the box before the first deploy; Caddy fetches the cert on first request. Nightly `deploy.sh backup-offsite` runs from a systemd timer: pg_dump → age-encrypt → rclone to R2. Keep the age private key off the box.

The prod image is multi-stage: `packages/crypto` is compiled in and Node is installed so the worker can run the tlock unwrap CLI for the timelock release path.

Universal/app links need `IOS_APP_ID` and `ANDROID_CERT_FINGERPRINTS` in `.env`; the backend serves `/.well-known/apple-app-site-association` and `assetlinks.json` from them.

## Name

Ante Mortem: the legal term for a statement made before death. The check-in button is "Still here". Memorial pages live under `/cemetery/<handle>`. A future paid persona tier would be "the Ghost".

## License

AGPL server, MIT crypto/core/app. See [LICENSING.md](LICENSING.md). The name is trademarked: [TRADEMARK.md](TRADEMARK.md).

## Not legal advice

A note in the vault is not a will. Market it as "information for your people", not as a will store.
