#!/usr/bin/env node
// One-time setup from the terminal. Alternative to setup.html.
// Usage: GITHUB_TOKEN=github_pat_... node scripts/setup.mjs '<jürgen password>' '<eike password>'
// Encrypts the token with each password, writes config.json locally AND pushes it to the
// repo through the Contents API using the token itself, which proves the token can write.
import { writeFileSync } from 'node:fs';
import { buildConfig, unlock } from '../js/crypto.js';
import { GitHubStore, GitHubError } from '../js/github.js';

const token = process.env.GITHUB_TOKEN;
const [pj, pe] = process.argv.slice(2);
if (!token || !pj || !pe) {
  console.error('Usage: GITHUB_TOKEN=... node scripts/setup.mjs <jürgen password> <eike password>');
  process.exit(1);
}

const store = new GitHubStore({ owner: 'Jyrks', repo: 'couple-time-management', token });

const cfg = await buildConfig(token, { 'jürgen': pj, 'eike': pe });
if ((await unlock(cfg, 'jürgen', pj)) !== token || (await unlock(cfg, 'eike', pe)) !== token) {
  console.error('Self-check failed');
  process.exit(1);
}
const content = JSON.stringify(cfg, null, 2) + '\n';

let sha = null;
try {
  sha = (await store.get('config.json')).sha;
} catch (err) {
  if (err instanceof GitHubError && err.status === 401) {
    console.error('Token rejected by GitHub (401). Check the token string.');
    process.exit(1);
  }
  if (!(err instanceof GitHubError && err.status === 404)) throw err;
}
try {
  await store.put('config.json', content, 'setup: uuenda config.json', sha);
} catch (err) {
  if (err instanceof GitHubError && err.status === 403) {
    console.error('Token cannot write to the repo. Give it Contents: Read and write on couple-time-management.');
  } else {
    console.error(`GitHub ${err.status ?? ''} ${err.message}`);
  }
  process.exit(1);
}
writeFileSync(new URL('../config.json', import.meta.url), content);
console.log('config.json pushed for users:', Object.keys(cfg.users).join(', '), '- run `git pull` to sync.');
