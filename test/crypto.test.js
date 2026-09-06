import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KDF, normalizeUser, encryptSecret, decryptSecret, buildConfig, unlock } from '../js/crypto.js';

const FAST = 1000; // iterations for tests

test('KDF defaults', () => {
  assert.deepEqual(KDF, { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 });
});

test('normalizeUser', () => {
  assert.equal(normalizeUser('  Jürgen '), 'jürgen');
  assert.equal(normalizeUser('jürgen'), 'jürgen'); // combining diaeresis -> NFC
});

test('encrypt/decrypt round trip with unicode password', async () => {
  const entry = await encryptSecret('armastabjürgenit', 'github_pat_ABC', FAST);
  assert.match(entry.salt, /^[A-Za-z0-9+/=]+$/);
  assert.match(entry.iv, /^[A-Za-z0-9+/=]+$/);
  assert.match(entry.ciphertext, /^[A-Za-z0-9+/=]+$/);
  assert.equal(await decryptSecret('armastabjürgenit', entry, FAST), 'github_pat_ABC');
});

test('wrong password fails', async () => {
  const entry = await encryptSecret('right', 'secret', FAST);
  await assert.rejects(decryptSecret('wrong', entry, FAST));
});

test('buildConfig and unlock for two users', async () => {
  const cfg = await buildConfig('tok', { 'Jürgen': 'armastabeiket', eike: 'armastabjürgenit' }, FAST);
  assert.equal(cfg.version, 1);
  assert.equal(cfg.kdf.iterations, FAST);
  assert.deepEqual(Object.keys(cfg.users).sort(), ['eike', 'jürgen']);
  assert.equal(await unlock(cfg, 'jürgen', 'armastabeiket'), 'tok');
  assert.equal(await unlock(cfg, 'EIKE', 'armastabjürgenit'), 'tok');
  await assert.rejects(unlock(cfg, 'eike', 'armastabeiket'));
  await assert.rejects(unlock(cfg, 'laara', 'x'));
});
