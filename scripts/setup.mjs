#!/usr/bin/env node
// One-time setup from the terminal. Alternative to setup.html.
// Usage: GITHUB_TOKEN=github_pat_... node scripts/setup.mjs '<jürgen password>' '<eike password>'
// Writes config.json (token encrypted with each password). Commit and push it afterwards.
import { writeFileSync } from 'node:fs';
import { buildConfig, unlock } from '../js/crypto.js';

const token = process.env.GITHUB_TOKEN;
const [pj, pe] = process.argv.slice(2);
if (!token || !pj || !pe) {
  console.error('Usage: GITHUB_TOKEN=... node scripts/setup.mjs <jürgen password> <eike password>');
  process.exit(1);
}

const res = await fetch('https://api.github.com/repos/Jyrks/couple-time-management/contents/data/events.json', {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
});
if (!res.ok) {
  console.error(`Token check failed: GitHub ${res.status}`);
  process.exit(1);
}

const cfg = await buildConfig(token, { 'jürgen': pj, 'eike': pe });
if ((await unlock(cfg, 'jürgen', pj)) !== token || (await unlock(cfg, 'eike', pe)) !== token) {
  console.error('Self-check failed');
  process.exit(1);
}
writeFileSync(new URL('../config.json', import.meta.url), JSON.stringify(cfg, null, 2) + '\n');
console.log('config.json written for users:', Object.keys(cfg.users).join(', '));
