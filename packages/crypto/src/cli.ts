#!/usr/bin/env node
// Called by the Django worker: `cli.js tlock-decrypt <chainHash> <b64 tlock ciphertext>` → b64 key.
import { mainnetClient, timelockDecrypt } from "tlock-js";

const [cmd, _chain, b64ct] = process.argv.slice(2);
if (cmd !== "tlock-decrypt") { console.error("usage: tlock-decrypt <chain> <b64>"); process.exit(2); }
const key = await timelockDecrypt(Buffer.from(b64ct, "base64").toString(), mainnetClient());
process.stdout.write(Buffer.from(key).toString("base64"));
