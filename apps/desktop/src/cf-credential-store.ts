import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { safeStorage } from "electron";
import { getDevCfCredentials } from "./dev-vars.ts";

/** Cloudflare Workers AI credentials (Account ID + API token). */
export interface CfCredentials {
  accountId: string;
  apiToken: string;
}

interface StoredCf {
  accountId: string;
  // base64-encoded encrypted API token
  apiTokenEnc: string;
}

const CF_PATH = join(homedir(), ".prosodeus", "cf-credentials.json");

function readFile(): StoredCf | null {
  if (!existsSync(CF_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CF_PATH, "utf-8")) as StoredCf;
  } catch {
    return null;
  }
}

function writeFile(data: StoredCf | null) {
  const dir = join(homedir(), ".prosodeus");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!data) {
    if (existsSync(CF_PATH)) writeFileSync(CF_PATH, "{}", { mode: 0o600 });
    return;
  }
  writeFileSync(CF_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export class CfCredentialStore {
  set(creds: CfCredentials): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Encryption is not available on this system — refusing to store CF token in plaintext",
      );
    }
    const apiTokenEnc = safeStorage.encryptString(creds.apiToken).toString("base64");
    writeFile({ accountId: creds.accountId.trim(), apiTokenEnc });
  }

  get(): CfCredentials | null {
    const stored = readFile();
    if (stored?.accountId && stored.apiTokenEnc && safeStorage.isEncryptionAvailable()) {
      try {
        const apiToken = safeStorage.decryptString(Buffer.from(stored.apiTokenEnc, "base64"));
        return { accountId: stored.accountId, apiToken };
      } catch {
        /* fall through to dev vars */
      }
    }
    return getDevCfCredentials();
  }

  remove(): void {
    writeFile(null);
  }

  isConfigured(): boolean {
    return this.get() !== null;
  }
}
