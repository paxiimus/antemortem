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

# Packages whose versions Expo owns. Never hand-pin these; `expo install` picks them.
EXPO_MANAGED=(
  expo expo-router expo-constants expo-linking expo-status-bar expo-secure-store expo-crypto
  expo-splash-screen expo-system-ui expo-font
  react react-native react-native-safe-area-context react-native-screens
  react-native-get-random-values react-native-gesture-handler react-native-reanimated
)
# Native libs not in Expo's compatibility table — installed plainly.
PLAIN=(react-native-libsodium)
DEV=(@babel/core)

# 1. Shared workspace packages first so file: links resolve.
info "Shared packages"
( cd ../packages/crypto && npm install --silent )
( cd ../packages/core   && npm install --silent )

# 2. Expo core. --upgrade moves to the newest SDK; otherwise honour what's there.
if [ "${1:-}" = "--upgrade" ] || ! grep -q '"expo":' package.json; then
  info "Installing latest Expo SDK"
  npm install --silent expo@latest
fi

# 3. Let expo pick every version it owns, then add the rest.
info "Resolving Expo-compatible package versions"
npx expo install "${EXPO_MANAGED[@]}"
npm install --silent "${PLAIN[@]}"
npm install --silent -D "${DEV[@]}"

# 4. Fix anything that drifted (e.g. a transitive pin), then report.
info "Checking compatibility"
npx expo install --fix
npx expo-doctor || true

# 5. EAS project link (needs `eas login`); skip silently if not logged in.
if command -v eas >/dev/null && eas whoami >/dev/null 2>&1; then
  grep -q '"projectId"' app.json || { info "Linking EAS project"; eas init --non-interactive || true; }
else
  info "EAS not logged in — run 'npm i -g eas-cli && eas login && eas init' when you want store builds"
fi

info "Done. SDK $(node -p "require('expo/package.json').version"). Start with: npx expo start"
