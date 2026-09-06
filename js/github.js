export class GitHubError extends Error {
  constructor(status, message) {
    super(message || `GitHub ${status}`);
    this.status = status;
  }
}

export function encodeBase64Utf8(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export class GitHubStore {
  constructor({ owner, repo, token, branch = 'main', fetchFn = globalThis.fetch.bind(globalThis) }) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.branch = branch;
    this.fetchFn = fetchFn;
  }

  url(path) {
    return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async get(path) {
    const res = await this.fetchFn(`${this.url(path)}?ref=${encodeURIComponent(this.branch)}`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!res.ok) throw new GitHubError(res.status);
    const json = await res.json();
    return { content: decodeBase64Utf8(json.content), sha: json.sha };
  }

  async put(path, content, message, sha) {
    const body = { message, content: encodeBase64Utf8(content), branch: this.branch };
    if (sha) body.sha = sha;
    const res = await this.fetchFn(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new GitHubError(res.status);
    const json = await res.json();
    return json.content.sha;
  }
}
