import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubStore, GitHubError, encodeBase64Utf8, decodeBase64Utf8 } from '../js/github.js';

test('base64 utf8 round trip', () => {
  const s = 'Jürgen & Eike – Laara';
  assert.equal(decodeBase64Utf8(encodeBase64Utf8(s)), s);
  assert.equal(decodeBase64Utf8(encodeBase64Utf8('Jö').replace(/(.{2})/g, '$1\n')), 'Jö'); // newline-tolerant
});

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

test('get decodes content and returns sha', async () => {
  const fetchFn = mockFetch(() => ({ status: 200, body: { content: encodeBase64Utf8('{"a":1}'), sha: 'abc' } }));
  const store = new GitHubStore({ owner: 'Jyrks', repo: 'r', token: 't', fetchFn });
  const out = await store.get('data/events.json');
  assert.deepEqual(out, { content: '{"a":1}', sha: 'abc' });
  const { url, init } = fetchFn.calls[0];
  assert.equal(url, 'https://api.github.com/repos/Jyrks/r/contents/data/events.json?ref=main');
  assert.equal(init.headers.Authorization, 'Bearer t');
  assert.equal(init.cache, 'no-store');
});

test('get throws GitHubError with status', async () => {
  const fetchFn = mockFetch(() => ({ status: 401, body: {} }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await assert.rejects(store.get('x'), (e) => e instanceof GitHubError && e.status === 401);
});

test('put sends base64 content, sha, branch and returns new sha', async () => {
  const fetchFn = mockFetch(() => ({ status: 200, body: { content: { sha: 'new' } } }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  const sha = await store.put('data/events.json', '{"b":2}', 'eike: test', 'old');
  assert.equal(sha, 'new');
  const { url, init } = fetchFn.calls[0];
  assert.equal(url, 'https://api.github.com/repos/o/r/contents/data/events.json');
  assert.equal(init.method, 'PUT');
  const body = JSON.parse(init.body);
  assert.equal(body.message, 'eike: test');
  assert.equal(body.sha, 'old');
  assert.equal(body.branch, 'main');
  assert.equal(decodeBase64Utf8(body.content), '{"b":2}');
});

test('put without sha omits sha (new file)', async () => {
  const fetchFn = mockFetch(() => ({ status: 201, body: { content: { sha: 'n' } } }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await store.put('config.json', '{}', 'm', null);
  assert.equal('sha' in JSON.parse(fetchFn.calls[0].init.body), false);
});

test('put conflict raises 409', async () => {
  const fetchFn = mockFetch(() => ({ status: 409, body: {} }));
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetchFn });
  await assert.rejects(store.put('p', 'c', 'm', 's'), (e) => e.status === 409);
});
