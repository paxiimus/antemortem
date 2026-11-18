// Shared packages + native crypto aliases.
// On iOS/Android, libsodium-wrappers-sumo (WASM) is swapped for react-native-libsodium (JSI, same API).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, "packages")];   // not the repo root: backend/.venv, web/, android/ build output
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules"), path.join(root, "node_modules")];
const orig = config.resolver.resolveRequest;
// The app bundles @antemortem/crypto from its TS source; dist/ is only for the Node tlock CLI.
const cryptoSrc = path.join(root, "packages/crypto/src/index.ts");
const nodeCryptoShim = path.join(__dirname, "src/shims/crypto.js");   // Node `crypto` -> CSPRNG shim on native
config.resolver.resolveRequest = (ctx, name, platform) => {
  if (name === "@antemortem/crypto") return { type: "sourceFile", filePath: cryptoSrc };
  if (platform !== "web" && name === "crypto") return { type: "sourceFile", filePath: nodeCryptoShim };
  if (platform !== "web" && name === "libsodium-wrappers-sumo") name = "react-native-libsodium";
  return orig ? orig(ctx, name, platform) : ctx.resolveRequest(ctx, name, platform);
};
module.exports = config;
