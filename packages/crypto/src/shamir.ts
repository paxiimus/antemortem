// Shamir over GF(2^8), AES polynomial 0x11b. Byte-compatible with backend/core/shamir.py.
// Share layout: [x, y0..yn]. No dependencies so it runs identically in browser, Hermes and Node.

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i;
  x ^= (x << 1) ^ (x & 0x80 ? 0x11b : 0); x &= 0xff;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const div = (a: number, b: number) => { if (!b) throw new Error("div0"); return a ? EXP[(LOG[a] - LOG[b] + 255) % 255] : 0; };

const defaultRng = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function split(secret: Uint8Array, n: number, k: number, rng = defaultRng): Uint8Array[] {
  if (!(k > 1 && k <= n && n <= 255)) throw new Error("need 1 < k <= n <= 255");
  const coeffs: Uint8Array[] = [];
  for (const s of secret) { const c = new Uint8Array(k); c[0] = s; c.set(rng(k - 1), 1); coeffs.push(c); }
  return Array.from({ length: n }, (_, i) => {
    const x = i + 1, out = new Uint8Array(secret.length + 1); out[0] = x;
    coeffs.forEach((poly, j) => { let y = 0; for (let d = k - 1; d >= 0; d--) y = mul(y, x) ^ poly[d]; out[j + 1] = y; });
    return out;
  });
}

export function combine(shares: Uint8Array[]): Uint8Array {
  const xs = shares.map(s => s[0]);
  if (new Set(xs).size !== xs.length) throw new Error("duplicate share x");
  const out = new Uint8Array(shares[0].length - 1);
  for (let i = 0; i < out.length; i++) {
    let acc = 0;
    shares.forEach((sj, j) => {
      let num = 1, den = 1;
      shares.forEach((sm, m) => { if (m !== j) { num = mul(num, sm[0]); den = mul(den, sm[0] ^ sj[0]); } });
      acc ^= mul(sj[1 + i], div(num, den));
    });
    out[i] = acc;
  }
  return out;
}
