#!/usr/bin/env bash
# Ante Mortem — mobile (Expo) setup. Pulls the latest Expo SDK and lets `expo install`
# resolve every Expo/React Native package to the version that SDK supports.
# Idempotent: re-run after an SDK bump to realign (`--upgrade` bumps the SDK first).
#
#   ./scripts/setup-mobile.sh            # install at the SDK pinned in package.json (or latest if none)
#   ./scripts/setup-mobile.sh --upgrade  # move to the newest SDK, then realign everything
set -euo pipefail
cd "$(dirname "$0")/../app"
info() { echo "▸ $1"; }
die()  { echo "✗ $1" >&2; exit 1; }

# Expo SDK 58 supports Node 22.13+, 24.3+ or 26+ (no odd-numbered releases). OS upgrades change this silently.
node -e '
  const [M, m] = process.versions.node.split(".").map(Number);
  const ok = (M === 22 && m >= 13) || (M === 24 && m >= 3) || (M >= 26 && M % 2 === 0);
  process.exit(ok ? 0 : 1)' || die "Node $(node -v) is not supported by Expo SDK 58. Use Node 22.13+ or 24.3+ (e.g. nvm install 24)."

# Packages whose versions Expo owns. Never hand-pin these; `expo install` picks them.
EXPO_MANAGED=(
  expo expo-router expo-constants expo-linking expo-status-bar expo-secure-store
  expo-splash-screen expo-system-ui expo-font expo-dev-client
  react react-dom react-native react-native-safe-area-context react-native-screens
  react-native-get-random-values
)
# Native libs not in Expo's compatibility table — installed plainly.
PLAIN=(react-native-libsodium)
DEV=(@babel/core @types/react typescript)

# 1. Shared workspace packages first so file: links resolve.
info "Shared packages"
( cd ../packages/crypto && npm install )
( cd ../packages/core   && npm install )

# 2. Restore whatever package.json already lists, then make sure Expo itself is installed.
#    Checks node_modules, not package.json: a listed-but-missing expo is the case that breaks `expo install`.
info "Installing app dependencies"
npm install
has_expo() { node -e "require.resolve('expo/package.json')" 2>/dev/null; }
if [ "${1:-}" = "--upgrade" ] || ! has_expo; then
  info "Installing latest Expo SDK"
  npm install expo@latest
fi
has_expo || { echo "expo did not install into app/node_modules; see npm output above" >&2; exit 1; }

# 3. Let expo pick every version it owns, then add the rest.
info "Resolving Expo-compatible package versions"
npx expo install "${EXPO_MANAGED[@]}"
npm install "${PLAIN[@]}"
npx expo install "${DEV[@]}" -- --save-dev   # SDK-pinned versions straight away (never latest-then-downgrade)

# 4. Fix anything that drifted (e.g. a transitive pin), then report.
info "Checking compatibility"
npx expo install --fix
npx expo-doctor || true

# EAS builds from a clean copy and only installs app/'s dependencies. The shared packages need theirs
# too (tlock-js lives in packages/crypto/node_modules), so EAS runs this after its own install.
npm pkg set scripts.eas-build-post-install="cd ../packages/crypto && npm ci --ignore-scripts && cd ../core && npm ci --ignore-scripts"

# 5. EAS project link. Needs `eas login`; with several accounts, name yours via EAS_ACCOUNT.
if command -v eas >/dev/null && eas whoami >/dev/null 2>&1; then
  if ! grep -q '"projectId"' app.json; then
    if [ -n "${EAS_ACCOUNT:-}" ]; then info "Linking EAS project"; eas init --account "$EAS_ACCOUNT" --non-interactive || true
    else info "Link EAS yourself: eas init --account <username>   (or re-run with EAS_ACCOUNT=<username>)"; fi
  fi
else
  info "EAS not logged in. Run 'npm i -g eas-cli && eas login && eas init --account <username>' when you want store builds"
fi

info "Done. SDK $(node -p "require('expo/package.json').version")."
info "Commit app/package.json and app/package-lock.json now: EAS builds install exactly what they list."
