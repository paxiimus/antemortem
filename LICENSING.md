# Licensing

| Path | License |
|---|---|
| `backend/`, `scripts/`, `docker-compose*.yml`, `Caddyfile`, `Makefile` | AGPL-3.0-or-later (`backend/LICENSE`) |
| `packages/crypto/`, `packages/core/` | MIT |
| `app/` | MIT |

Why the split: the crypto and client logic are MIT so anyone can audit, reuse and port them. The server is AGPL so a modified hosted copy must publish its changes. The app is MIT because the App Store's terms don't sit well with copyleft.

The name "Ante Mortem" and any logo are not covered by any of these licenses. See `TRADEMARK.md`.
