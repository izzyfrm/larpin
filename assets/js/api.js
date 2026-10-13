import { config, apiConfigured } from './config.js';

const TOKEN_KEY = 'larpin.token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const session = {
  me: null,
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set token(value) {
    try {
      value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export async function api(path, { method = 'GET', body, raw } = {}) {
  if (!apiConfigured) throw new ApiError(0, 'Accounts and submissions are not switched on yet.');
  const headers = {};
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  let payload = body;
  if (body && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(config.apiBase + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Could not reach larpin. Check your connection and try again.');
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token && !path.startsWith('/api/auth/')) {
      session.token = null;
      session.me = null;
      window.dispatchEvent(new Event('larpin:session'));
    }
    throw new ApiError(res.status, data.error || 'Something went wrong.');
  }
  return data;
}

export async function loadSession() {
  if (!apiConfigured || !session.token) return;
  try {
    session.me = (await api('/api/me')).user;
  } catch {
    session.me = null;
  }
}

export function setSession(token, user) {
  session.token = token;
  session.me = user;
  window.dispatchEvent(new Event('larpin:session'));
}

/* ---------- free larp (the larp-stuff folder) ---------- */

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

const titleFromFile = (name) =>
  name
    .replace(/^.*\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

function freeItem(entry) {
  const kind = VIDEO.test(entry.file) ? 'video' : IMAGE.test(entry.file) ? 'image' : null;
  if (!kind) return null;
  return {
    id: `free~${encodeURIComponent(entry.file)}`,
    free: true,
    kind,
    title: titleFromFile(entry.file) || 'untitled',
    url: `larp-stuff/${entry.file.split('/').map(encodeURIComponent).join('/')}`,
    filename: entry.file.replace(/^.*\//, ''),
    size: entry.size || 0,
    width: entry.width || 0,
    height: entry.height || 0,
    created_at: entry.added || 0,
  };
}

let freePromise;

/** Lists larp-stuff. Uses the manifest built on deploy, falling back to the GitHub API. */
export function loadFree() {
  freePromise ??= (async () => {
    let entries = [];
    try {
      const res = await fetch('larp-stuff/manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error();
      entries = (await res.json()).items;
    } catch {
      try {
        const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/larp-stuff`);
        if (res.ok) entries = (await res.json()).filter((f) => f.type === 'file').map((f) => ({ file: f.name, size: f.size }));
      } catch {}
    }
    return entries
      .map(freeItem)
      .filter(Boolean)
      .sort((a, b) => b.created_at - a.created_at || a.title.localeCompare(b.title));
  })();
  return freePromise;
}
