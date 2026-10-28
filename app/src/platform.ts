import * as SecureStore from "expo-secure-store";
import { configure } from "@antemortem/core";

const KEY = "dn_token";
export const tokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (t: string) => SecureStore.setItemAsync(KEY, t),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
configure({ apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000" });
