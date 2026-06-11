"use client";

/**
 * LOCAL VAULT — encrypted note storage, 100% client-side.
 *
 * WebCrypto AES-GCM 256. Key derived from a user passphrase via PBKDF2
 * (SHA-256, 100k iterations, random 16-byte salt). Ciphertext + salt + iv
 * persisted in localStorage under `tek:shadow:vault`. TEK servers never see
 * the passphrase, the key, or the plaintext.
 */

export interface VaultNote {
  id: string;
  text: string;
  at: number;
}

const LS_KEY = "tek:shadow:vault";
const PBKDF2_ITERATIONS = 100_000;

interface VaultBlob {
  v: 1;
  /** base64 random salt for PBKDF2 */
  salt: string;
  /** base64 AES-GCM iv (rotated every save) */
  iv: string;
  /** base64 ciphertext of JSON.stringify(VaultNote[]) */
  ct: string;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

export function hasVault(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt + persist notes under the existing salt. */
export async function persistVault(
  key: CryptoKey,
  saltB64: string,
  notes: VaultNote[]
): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(notes))
  );
  const blob: VaultBlob = { v: 1, salt: saltB64, iv: toB64(iv), ct: toB64(ct) };
  localStorage.setItem(LS_KEY, JSON.stringify(blob));
}

/** Initialize a brand-new vault (random salt, empty notes). */
export async function createVault(
  passphrase: string
): Promise<{ key: CryptoKey; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, saltBytes);
  const salt = toB64(saltBytes);
  await persistVault(key, salt, []);
  return { key, salt };
}

/** Unlock the stored vault. Throws on wrong passphrase or corrupt blob. */
export async function unlockVault(
  passphrase: string
): Promise<{ key: CryptoKey; salt: string; notes: VaultNote[] }> {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) throw new Error("NO VAULT FOUND");
  let blob: VaultBlob;
  try {
    blob = JSON.parse(raw) as VaultBlob;
  } catch {
    throw new Error("VAULT BLOB CORRUPT");
  }
  const key = await deriveKey(passphrase, fromB64(blob.salt));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(blob.iv) },
      key,
      fromB64(blob.ct)
    );
  } catch {
    throw new Error("DECRYPTION FAILED — WRONG PASSPHRASE");
  }
  let notes: VaultNote[];
  try {
    notes = JSON.parse(new TextDecoder().decode(plain)) as VaultNote[];
  } catch {
    notes = [];
  }
  return { key, salt: blob.salt, notes };
}

/** Wipe the vault blob. Irreversible. */
export function destroyVault(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable */
  }
}
