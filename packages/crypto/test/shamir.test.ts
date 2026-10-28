import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { split, combine } from "../src/shamir.ts";


const PY = `
import sys, base64, json; sys.path.insert(0, "../../backend")
from core import shamir
cmd, *args = sys.argv[1:]
if cmd == "combine":
    print(base64.b64encode(shamir.combine([base64.b64decode(a) for a in args])).decode())
else:
    s, n, k = base64.b64decode(args[0]), int(args[1]), int(args[2])
    print(json.dumps([base64.b64encode(x).decode() for x in shamir.split(s, n, k)]))
`;
const py = (...a: string[]) => execFileSync("python3", ["-c", PY, ...a], { encoding: "utf8" }).trim();
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

test("ts roundtrip + threshold", () => {
  const s = new Uint8Array(randomBytes(32)), sh = split(s, 5, 3);
  assert.deepEqual(combine(sh.slice(0, 3)), s);
  assert.deepEqual(combine([sh[4], sh[1], sh[2]]), s);
  assert.notDeepEqual(combine(sh.slice(0, 2)), s);
});

test("ts split → py combine", () => {
  const s = new Uint8Array(randomBytes(32)), sh = split(s, 3, 3);
  assert.equal(py("combine", ...sh.map(b64)), b64(s));
});

test("py split → ts combine", () => {
  const s = new Uint8Array(randomBytes(32));
  const sh: string[] = JSON.parse(py("split", b64(s), "4", "2"));
  assert.deepEqual(combine([unb64(sh[3]), unb64(sh[0])]), s);
});
