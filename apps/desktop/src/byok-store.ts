import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { safeStorage } from "electron";
import { getDevByokKey, listDevByokProviders } from "./dev-vars.ts";

/**
 * Bring-your-own-key storage for non-Claude providers.
 *
 * Keys are encrypted via Electron `safeStorage` (OS keychain — Keychain on
 * macOS, DPAPI on Windows, libsecret on Linux) and persisted to a small JSON
 * file under `~/.prosodeus/`. Only the encrypted bytes touch disk.
 */

export type Provider = "google" | "groq" | "mistral" | "openai" | "moonshot";

interface StoredKeys {
  // base64-encoded encrypted bytes per provider
  [provider: string]: string;
}

const KEYS_PATH = join(homedir(), ".prosodeus", "byok-keys.json");

function readFile(): StoredKeys {
  if (!existsSync(KEYS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(KEYS_PATH, "utf-8")) as StoredKeys;
  } catch {
    return {};
  }
}

function writeFile(keys: StoredKeys) {
  const dir = join(homedir(), ".prosodeus");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), { mode: 0o600 });
}

export class ByokStore {
  /** Store an API key for a provider, encrypted with the OS keychain. */
  set(provider: Provider, apiKey: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Encryption is not available on this system — refusing to store API key in plaintext",
      );
    }
    const encrypted = safeStorage.encryptString(apiKey).toString("base64");
    const keys = readFile();
    keys[provider] = encrypted;
    writeFile(keys);
  }

  /** Retrieve and decrypt an API key. Returns null if no key is stored. */
  get(provider: Provider): string | null {
    const keys = readFile();
    const enc = keys[provider];
    if (enc && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(enc, "base64"));
      } catch {
        /* fall through to dev vars */
      }
    }
    return getDevByokKey(provider);
  }

  /** Forget the key for a provider. */
  remove(provider: Provider): void {
    const keys = readFile();
    delete keys[provider];
    writeFile(keys);
  }

  /** List providers that have a key stored (without exposing the keys themselves). */
  listConfigured(): Provider[] {
    const stored = Object.keys(readFile()) as Provider[];
    const dev = listDevByokProviders();
    return [...new Set([...stored, ...dev])];
  }
}
