"""Shamir secret sharing over GF(2^8), AES polynomial 0x11b.
Byte-compatible with packages/crypto/src/shamir.ts. Share format: [x, y0..yn]."""
import secrets

_EXP, _LOG = [0] * 512, [0] * 256
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x ^= (_x << 1) ^ (0x11B if _x & 0x80 else 0)
    _x &= 0xFF
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _mul(a, b):
    return 0 if a == 0 or b == 0 else _EXP[_LOG[a] + _LOG[b]]


def _div(a, b):
    if b == 0:
        raise ZeroDivisionError
    return 0 if a == 0 else _EXP[(_LOG[a] - _LOG[b]) % 255]


def split(secret: bytes, n: int, k: int) -> list[bytes]:
    if not 1 < k <= n <= 255:
        raise ValueError("need 1 < k <= n <= 255")
    coeffs = [[s] + list(secrets.token_bytes(k - 1)) for s in secret]
    out = []
    for x in range(1, n + 1):
        ys = bytearray()
        for poly in coeffs:
            y = 0
            for c in reversed(poly):
                y = _mul(y, x) ^ c
            ys.append(y)
        out.append(bytes([x]) + bytes(ys))
    return out


def combine(shares: list[bytes]) -> bytes:
    xs = [s[0] for s in shares]
    if len(set(xs)) != len(xs):
        raise ValueError("duplicate share x")
    length = len(shares[0]) - 1
    secret = bytearray()
    for i in range(length):
        acc = 0
        for j, sj in enumerate(shares):
            num = den = 1
            for m, sm in enumerate(shares):
                if m != j:
                    num = _mul(num, sm[0])
                    den = _mul(den, sm[0] ^ sj[0])
            acc ^= _mul(sj[1 + i], _div(num, den))
        secret.append(acc)
    return bytes(secret)
