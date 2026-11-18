// Node `crypto` subset for libraries that fall back to it (tlock-js's age/utils-crypto.js).
// Backed by the getRandomValues polyfill imported first in app/_layout.tsx. If that is missing this throws:
// the app must never get weaker randomness than the platform CSPRNG.
module.exports = {
  randomBytes(n) {
    const out = new Uint8Array(n);
    globalThis.crypto.getRandomValues(out);
    return out;
  },
};
