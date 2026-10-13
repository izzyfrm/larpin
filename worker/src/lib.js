import { Buffer } from 'node:buffer';

export const KB = 1024;
export const MB = 1024 * KB;
export const SESSION_TTL = 30 * 24 * 3600 * 1000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export function newId(bytes = 12) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Buffer.from(digest).toString('hex');
}

// PBKDF2-SHA256. 100k iterations is the ceiling Workers allows.
export async function hashPassword(password, salt = newId(16)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
    key,
    256,
  );
  return { hash: Buffer.from(bits).toString('hex'), salt };
}

export async function verifyPassword(password, user) {
  const { hash } = await hashPassword(password, user.pass_salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.pass_hash, 'hex');
  return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

/** Fixed-window counter. Throws 429 once `limit` is exceeded inside `windowSec`. */
export async function rateLimit(env, key, limit, windowSec) {
  const now = Date.now();
  const window = Math.floor(now / (windowSec * 1000));
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window, count, expires) VALUES (?, ?, 1, ?)
     ON CONFLICT (key, window) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(key, window, now + windowSec * 2000)
    .first();
  if (row.count > limit) throw new HttpError(429, 'Slow down a little — try again later.');
}

export async function ipKey(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  return (await sha256(`${env.IP_SALT || 'larpin'}:${ip}`)).slice(0, 32);
}

export async function readJson(req) {
  const text = await req.text();
  if (text.length > 16 * KB) throw new HttpError(413, 'Request is too large.');
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object') return data;
  } catch {}
  throw new HttpError(400, 'Invalid request.');
}

/** Trims, strips control characters and collapses whitespace. */
export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value.replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  text = multiline ? text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : text.replace(/\s+/g, ' ');
  return text.trim().slice(0, max);
}

/** Identifies a file from its first bytes. The client-declared type is never trusted. */
export function sniff(b) {
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') {
    // acTL marks an animated PNG; only the first frame would get reviewed.
    const animated = ascii(0, Math.min(b.length, 4096)).includes('acTL');
    return { kind: 'image', mime: 'image/png', ext: 'png', animated };
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const animated = ascii(12, 16) === 'VP8X' && (b[20] & 0x02) !== 0;
    return { kind: 'image', mime: 'image/webp', ext: 'webp', animated };
  }
  if (ascii(4, 8) === 'ftyp') return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  return null;
}

export const isAdmin = (env, user) =>
  !!user &&
  (env.ADMIN_USERNAMES || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.username.toLowerCase());

export async function getUser(req, env) {
  const match = /^Bearer ([\w-]{20,})$/.exec(req.headers.get('authorization') || '');
  if (!match) return null;
  return env.DB.prepare(
    `SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_banned = 0`,
  )
    .bind(await sha256(match[1]), Date.now())
    .first();
}

export async function requireUser(req, env) {
  const user = await getUser(req, env);
  if (!user) throw new HttpError(401, 'Sign in to do that.');
  return user;
}
