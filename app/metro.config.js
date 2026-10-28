// Monorepo + native crypto alias.
// On iOS/Android, libsodium-wrappers-sumo (WASM) is swapped for react-native-libsodium (JSI, same API).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules"), path.join(root, "node_modules")];
const orig = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, name, platform) => {
  if (platform !== "web" && name === "libsodium-wrappers-sumo") name = "react-native-libsodium";
  return orig ? orig(ctx, name, platform) : ctx.resolveRequest(ctx, name, platform);
};
module.exports = config;
