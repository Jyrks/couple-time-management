export const KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 };

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

function b64(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function normalizeUser(u) {
  return String(u).trim().normalize('NFC').toLowerCase();
}

async function deriveKey(password, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(password, secret, iterations = KDF.iterations) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
  return { salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) };
}

export async function decryptSecret(password, entry, iterations = KDF.iterations) {
  const key = await deriveKey(password, unb64(entry.salt), iterations);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) }, key, unb64(entry.ciphertext));
  return dec.decode(pt);
}

export async function buildConfig(secret, passwordsByUser, iterations = KDF.iterations) {
  const users = {};
  for (const [user, pw] of Object.entries(passwordsByUser)) {
    users[normalizeUser(user)] = await encryptSecret(pw, secret, iterations);
  }
  return { version: 1, kdf: { ...KDF, iterations }, users };
}

export async function unlock(config, username, password) {
  const entry = config?.users?.[normalizeUser(username)];
  if (!entry) throw new Error('unknown user');
  return decryptSecret(password, entry, config.kdf?.iterations ?? KDF.iterations);
}
