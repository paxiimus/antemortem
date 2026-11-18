// Must be the first import of the app. A module's imports all run before its own code, so a
// polyfill assigned in _layout.tsx's body would arrive after tlock-js had already loaded without it.
import "react-native-get-random-values";   // crypto.getRandomValues for libsodium, tlock-js, shamir
import { Buffer } from "buffer";
(globalThis as any).Buffer ??= Buffer;     // tlock-js expects Node's Buffer
