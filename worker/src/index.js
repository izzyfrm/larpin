import {
  HttpError, KB, MB, SESSION_TTL, cleanText, getUser, hashPassword, ipKey, isAdmin, json, newId,
  rateLimit, readJson, requireUser, sha256, sniff, verifyPassword,
} from './lib.js';
import { classifyImage, tick } from './moderation.js';

const LIMITS = { image: 3 * MB, video: 40 * MB, frame: 500 * KB, avatar: 300 * KB, pending: 5 };
const RESERVED = new Set(['admin', 'larpin', 'support', 'moderator', 'mod', 'staff', 'system', 'official', 'free', 'null', 'undefined', 'me']);
const REPORT_REASONS = ['nsfw', 'minor_safety', 'scam_or_fraud', 'impersonation', 'private_info', 'copyright', 'hate_or_violence', 'other'];
const USERNAME = /^[a-z0-9_]{3,20}$/;

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(req, env, ctx);
    } catch (error) {
      if (error instanceof HttpError) res = json({ error: error.message }, error.status);
      else {
        console.error(error);
        res = json({ error: 'Something went wrong on our side.' }, 500);
      }
    }
    res = new Response(res.body, res);
    for (const [name, value] of Object.entries(cors)) res.headers.set(name, value);
    res.headers.set('x-content-type-options', 'nosniff');
    return res;
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
};

function corsHeaders(req, env) {
  const origin = req.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((entry) => entry.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const on = (method, pattern) => (req.method === method ? pattern.exec(path) : null);
  let m;

  if (path === '/') return json({ service: 'larpin-api', ok: true });
  if ((m = on('GET', /^\/media\/avatar\/(\w{3,20})$/))) return serveAvatar(env, m[1]);
  if ((m = on('GET', /^\/media\/([\w-]{8,32})$/))) return serveMedia(req, env, ctx, url, m[1]);

  if (on('POST', /^\/api\/auth\/signup$/)) return signup(req, env);
  if (on('POST', /^\/api\/auth\/login$/)) return login(req, env);
  if (on('GET', /^\/api\/posts$/)) return listPosts(env, url);
  if ((m = on('GET', /^\/api\/posts\/([\w-]{8,32})$/))) return getPost(env, url, m[1]);
  if ((m = on('GET', /^\/api\/users\/(\w{3,20})$/))) return getProfile(env, url, m[1]);

  if (!path.startsWith('/api/')) throw new HttpError(404, 'Not found.');
  const user = await requireUser(req, env);

  if (on('POST', /^\/api\/auth\/logout$/)) return logout(env, user, url);
  if (on('GET', /^\/api\/me$/)) return json({ user: privateUser(env, url, user) });
  if (on('PATCH', /^\/api\/me$/)) return updateProfile(req, env, url, user);
  if (on('PUT', /^\/api\/me\/avatar$/)) return setAvatar(req, env, url, user);
  if (on('DELETE', /^\/api\/me\/avatar$/)) return removeAvatar(env, url, user);
  if (on('POST', /^\/api\/me\/password$/)) return changePassword(req, env, user);
  if (on('POST', /^\/api\/me\/delete$/)) return deleteAccount(req, env, user);
  if (on('GET', /^\/api\/me\/posts$/)) return myPosts(env, url, user);
  if (on('POST', /^\/api\/posts$/)) return createPost(req, env, url, user);
  if ((m = on('DELETE', /^\/api\/posts\/([\w-]{8,32})$/))) return deletePost(env, user, m[1]);
  if ((m = on('POST', /^\/api\/posts\/([\w-]{8,32})\/report$/))) return reportPost(req, env, user, m[1]);

  if (path.startsWith('/api/admin/')) {
    if (!isAdmin(env, user)) throw new HttpError(403, 'Not allowed.');
    if (on('GET', /^\/api\/admin\/queue$/)) return adminQueue(env, url);
    if ((m = on('POST', /^\/api\/admin\/posts\/([\w-]{8,32})$/))) return adminPost(req, env, m[1]);
    if ((m = on('POST', /^\/api\/admin\/reports\/([\w-]{8,32})$/))) return adminResolve(env, m[1]);
    if ((m = on('POST', /^\/api\/admin\/users\/(\w{3,20})\/ban$/))) return adminBan(env, m[1]);
  }
  throw new HttpError(404, 'Not found.');
}

/* ---------- shapes ---------- */

const avatarUrl = (url, row) => (row.avatar_v ? `${url.origin}/media/avatar/${row.username}?v=${row.avatar_v}` : null);

const publicUser = (url, row) => ({
  username: row.username,
  display_name: row.display_name,
  bio: row.bio,
  avatar_url: avatarUrl(url, row),
  created_at: row.created_at,
});

const privateUser = (env, url, row) => ({ ...publicUser(url, row), is_admin: isAdmin(env, row) });

// Expects a posts row joined with username, display_name and avatar_v.
function postShape(url, row, { owner = false } = {}) {
  const post = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    width: row.width,
    height: row.height,
    duration: row.duration,
    size: row.size,
    downloads: row.downloads,
    url: `${url.origin}/media/${row.id}`,
    created_at: row.published_at || row.created_at,
    author: { username: row.username, display_name: row.display_name, avatar_url: avatarUrl(url, row) },
  };
  if (owner) Object.assign(post, { status: row.status, reason: row.reason, review_at: row.review_at, submitted_at: row.created_at });
  return post;
}

const POST_SELECT = `SELECT p.*, u.username, u.display_name, u.avatar_v FROM posts p JOIN users u ON u.id = p.user_id`;

/* ---------- auth ---------- */

async function startSession(env, userId) {
  const token = newId(32);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_TTL)
    .run();
  return token;
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password needs at least 8 characters.');
  if (password.length > 200) throw new HttpError(400, 'Password is too long.');
}

async function signup(req, env) {
  const body = await readJson(req);
  const username = String(body.username || '').trim().toLowerCase();
  if (!USERNAME.test(username)) throw new HttpError(400, 'Usernames are 3–20 characters: letters, numbers and underscores.');
  if (RESERVED.has(username)) throw new HttpError(400, 'That username is not available.');
  checkPassword(body.password);
  if (body.agree !== true) throw new HttpError(400, 'You need to accept the Terms and confirm your age to sign up.');
  await rateLimit(env, `signup:${await ipKey(req, env)}`, 5, 3600);

  const { hash, salt } = await hashPassword(body.password);
  const id = newId();
  const created = await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (username) DO NOTHING`,
  )
    .bind(id, username, username, hash, salt, Date.now())
    .run();
  if (!created.meta.changes) throw new HttpError(409, 'That username is taken.');
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ token: await startSession(env, id), user: privateUser(env, new URL(req.url), user) }, 201);
}

async function login(req, env) {
  const body = await readJson(req);
  const username = String(body.username || '').trim().toLowerCase();
  await rateLimit(env, `login:${await ipKey(req, env)}:${username.slice(0, 20)}`, 10, 600);
  const user = USERNAME.test(username) ? await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first() : null;
  if (!user || typeof body.password !== 'string' || !(await verifyPassword(body.password.slice(0, 200), user))) {
    throw new HttpError(401, 'Wrong username or password.');
  }
  if (user.is_banned) throw new HttpError(403, 'This account has been suspended for breaking the Terms.');
  return json({ token: await startSession(env, user.id), user: privateUser(env, new URL(req.url), user) });
}

async function logout(env, user, url) {
  const everywhere = url.searchParams.get('all') === '1';
  await (everywhere
    ? env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id)
    : env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.token_hash)
  ).run();
  return json({ ok: true });
}

/* ---------- account ---------- */

async function updateProfile(req, env, url, user) {
  const body = await readJson(req);
  const displayName = cleanText(body.display_name, 32) || user.username;
  const bio = cleanText(body.bio, 200, { multiline: true });
  await env.DB.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').bind(displayName, bio, user.id).run();
  return json({ user: privateUser(env, url, { ...user, display_name: displayName, bio }) });
}

async function setAvatar(req, env, url, user) {
  await rateLimit(env, `avatar:${user.id}`, 10, 3600);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > LIMITS.avatar) throw new HttpError(413, 'Profile pictures must be under 300 KB.');
  const type = sniff(bytes);
  if (type?.kind !== 'image' || type.animated) throw new HttpError(415, 'Use a JPEG, PNG or WebP image.');
  let category;
  try {
    category = await classifyImage(env, bytes, type.mime);
  } catch (error) {
    console.error('avatar review failed', error.message);
    throw new HttpError(503, 'We could not check that picture right now. Try again in a minute.');
  }
  if (category !== 'none') throw new HttpError(422, 'That picture breaks the content rules, so it was not saved.');
  await env.MEDIA.put(`avatars/${user.id}`, bytes, { httpMetadata: { contentType: type.mime } });
  const version = Date.now();
  await env.DB.prepare('UPDATE users SET avatar_v = ? WHERE id = ?').bind(version, user.id).run();
  return json({ user: privateUser(env, url, { ...user, avatar_v: version }) });
}

async function removeAvatar(env, url, user) {
  await env.MEDIA.delete(`avatars/${user.id}`);
  await env.DB.prepare('UPDATE users SET avatar_v = 0 WHERE id = ?').bind(user.id).run();
  return json({ user: privateUser(env, url, { ...user, avatar_v: 0 }) });
}

async function changePassword(req, env, user) {
  const body = await readJson(req);
  await rateLimit(env, `pw:${user.id}`, 5, 3600);
  if (typeof body.current !== 'string' || !(await verifyPassword(body.current.slice(0, 200), user))) {
    throw new HttpError(403, 'Your current password is not right.');
  }
  checkPassword(body.next);
  const { hash, salt } = await hashPassword(body.next);
  // Every other session is signed out; the one making this request stays.
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(hash, salt, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, user.token_hash),
  ]);
  return json({ ok: true });
}

async function purgePostMedia(env, posts) {
  const keys = posts.flatMap((post) => [post.media_key, ...Array.from({ length: post.frames }, (_, i) => `frames/${post.id}/${i}`)]);
  for (let i = 0; i < keys.length; i += 500) await env.MEDIA.delete(keys.slice(i, i + 500));
}

async function deleteAccount(req, env, user) {
  const body = await readJson(req);
  if (typeof body.password !== 'string' || !(await verifyPassword(body.password.slice(0, 200), user))) {
    throw new HttpError(403, 'Password is not right.');
  }
  // Quarantined material is retained for legal reporting even when the account goes.
  const posts = await env.DB.prepare(`SELECT id, media_key, frames FROM posts WHERE user_id = ? AND status != 'quarantined'`).bind(user.id).all();
  await purgePostMedia(env, posts.results);
  await env.MEDIA.delete(`avatars/${user.id}`);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM reports WHERE post_id IN (SELECT id FROM posts WHERE user_id = ? AND status != 'quarantined')`).bind(user.id),
    env.DB.prepare(`DELETE FROM posts WHERE user_id = ? AND status != 'quarantined'`).bind(user.id),
    env.DB.prepare('UPDATE reports SET reporter_id = NULL WHERE reporter_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true });
}

/* ---------- posts ---------- */

async function listPosts(env, url) {
  const q = url.searchParams;
  const limit = Math.max(1, Math.min(48, Number(q.get('limit')) || 24));
  const where = [`p.status = 'approved'`, 'u.is_banned = 0'];
  const args = [];
  const before = Number(q.get('before'));
  if (before > 0) (where.push('p.published_at < ?'), args.push(before));
  if (['image', 'video'].includes(q.get('kind'))) (where.push('p.kind = ?'), args.push(q.get('kind')));
  if (q.get('user')) (where.push('u.username = ?'), args.push(q.get('user').toLowerCase()));
  const rows = await env.DB.prepare(`${POST_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.published_at DESC LIMIT ?`)
    .bind(...args, limit + 1)
    .all();
  const page = rows.results.slice(0, limit);
  return json({
    posts: page.map((row) => postShape(url, row)),
    next: rows.results.length > limit ? page[page.length - 1].published_at : null,
  });
}

async function getPost(env, url, id) {
  const row = await env.DB.prepare(`${POST_SELECT} WHERE p.id = ? AND p.status = 'approved' AND u.is_banned = 0`).bind(id).first();
  if (!row) throw new HttpError(404, 'That post does not exist or is not public.');
  return json({ post: postShape(url, row) });
}

async function getProfile(env, url, username) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE username = ? AND is_banned = 0').bind(username.toLowerCase()).first();
  if (!row) throw new HttpError(404, 'No one here goes by that name.');
  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND status = 'approved'`).bind(row.id).first();
  return json({ user: { ...publicUser(url, row), posts: count.n } });
}

async function myPosts(env, url, user) {
  const rows = await env.DB.prepare(`${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 100`)
    .bind(user.id)
    .all();
  // Quarantined posts read as a plain rejection to their uploader.
  return json({
    posts: rows.results.map((row) =>
      postShape(url, row.status === 'quarantined' ? { ...row, status: 'rejected', reason: 'policy' } : row, { owner: true }),
    ),
  });
}

async function createPost(req, env, url, user) {
  if (Number(req.headers.get('content-length')) > LIMITS.video + 4 * MB) throw new HttpError(413, 'That file is too large.');
  await rateLimit(env, `upload:h:${user.id}`, 10, 3600);
  await rateLimit(env, `upload:d:${user.id}`, 30, 86400);
  const waiting = await env.DB.prepare(`SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND status = 'pending'`).bind(user.id).first();
  if (waiting.n >= LIMITS.pending) throw new HttpError(429, 'You already have 5 submissions in review. Wait for those to finish.');

  let form;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, 'Invalid upload.');
  }
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) throw new HttpError(400, 'Choose a file to submit.');
  const title = cleanText(form.get('title'), 80);
  if (title.length < 2) throw new HttpError(400, 'Give it a title (at least 2 characters).');

  const type = sniff(new Uint8Array(await file.slice(0, 4096).arrayBuffer()));
  if (!type) throw new HttpError(415, 'Unsupported file. Use JPEG, PNG, WebP, MP4 or WebM.');
  if (type.animated) throw new HttpError(415, 'Animated images are not supported. Submit it as a video instead.');
  if (file.size > LIMITS[type.kind]) {
    throw new HttpError(413, type.kind === 'image' ? 'Images must be under 3 MB.' : 'Videos must be under 40 MB.');
  }

  // Videos cannot be decoded here, so they are reviewed through still frames sent alongside.
  let frames = [];
  if (type.kind === 'video') {
    frames = form.getAll('frames').filter((frame) => frame instanceof File);
    if (frames.length < 3 || frames.length > 6) throw new HttpError(400, 'Video review frames are missing. Submit from the site.');
    for (const frame of frames) {
      const head = sniff(new Uint8Array(await frame.slice(0, 16).arrayBuffer()));
      if (head?.mime !== 'image/jpeg' || frame.size > LIMITS.frame) throw new HttpError(400, 'Video review frames are invalid.');
    }
  }

  const int = (name, max) => Math.max(0, Math.min(max, Math.round(Number(form.get(name)) || 0)));
  const id = newId();
  const mediaKey = `posts/${id}.${type.ext}`;
  const now = Date.now();
  await env.MEDIA.put(mediaKey, file.stream(), { httpMetadata: { contentType: type.mime } });
  await Promise.all(frames.map((frame, i) => env.MEDIA.put(`frames/${id}/${i}`, frame.stream(), { httpMetadata: { contentType: 'image/jpeg' } })));
  const delay = Math.max(0, Number(env.REVIEW_DELAY_SECONDS) || 120) * 1000;
  await env.DB.prepare(
    `INSERT INTO posts (id, user_id, kind, media_key, mime, size, width, height, duration, frames, title, review_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, user.id, type.kind, mediaKey, type.mime, file.size, int('width', 20000), int('height', 20000), int('duration', 36000), frames.length, title, now + delay, now)
    .run();
  const row = await env.DB.prepare(`${POST_SELECT} WHERE p.id = ?`).bind(id).first();
  return json({ post: postShape(url, row, { owner: true }) }, 201);
}

async function removePost(env, post) {
  await purgePostMedia(env, [post]);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM reports WHERE post_id = ?').bind(post.id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(post.id),
  ]);
}

async function deletePost(env, user, id) {
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!post) throw new HttpError(404, 'Post not found.');
  // The uploader cannot erase quarantined material.
  if (post.status === 'quarantined') return json({ ok: true });
  await removePost(env, post);
  return json({ ok: true });
}

async function reportPost(req, env, user, id) {
  const body = await readJson(req);
  if (!REPORT_REASONS.includes(body.reason)) throw new HttpError(400, 'Pick a reason for the report.');
  await rateLimit(env, `report:${user.id}`, 20, 3600);
  const post = await env.DB.prepare(`SELECT id FROM posts WHERE id = ? AND status = 'approved'`).bind(id).first();
  if (!post) throw new HttpError(404, 'Post not found.');
  const existing = await env.DB.prepare('SELECT id FROM reports WHERE post_id = ? AND reporter_id = ? AND resolved = 0').bind(id, user.id).first();
  if (!existing) {
    await env.DB.prepare('INSERT INTO reports (id, post_id, reporter_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newId(), id, user.id, body.reason, cleanText(body.detail, 500, { multiline: true }), Date.now())
      .run();
  }
  return json({ ok: true }, 201);
}

/* ---------- media ---------- */

async function serveAvatar(env, username) {
  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND is_banned = 0 AND avatar_v > 0').bind(username.toLowerCase()).first();
  const object = user && (await env.MEDIA.get(`avatars/${user.id}`));
  if (!object) throw new HttpError(404, 'Not found.');
  const headers = new Headers({ 'cache-control': 'public, max-age=86400' });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

async function serveMedia(req, env, ctx, url, id) {
  const post = await env.DB.prepare('SELECT p.*, u.is_banned FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?').bind(id).first();
  if (!post) throw new HttpError(404, 'Not found.');
  const isPublic = post.status === 'approved' && !post.is_banned;
  if (!isPublic) {
    // Unreviewed media is visible to its uploader and to moderators only. Quarantined media is never served.
    const viewer = await getUser(req, env);
    const mayPreview = viewer && ['pending', 'flagged'].includes(post.status) && (viewer.id === post.user_id || isAdmin(env, viewer));
    if (!mayPreview) throw new HttpError(404, 'Not found.');
  }

  const wantsRange = req.headers.has('range');
  const object = await env.MEDIA.get(post.media_key, wantsRange ? { range: req.headers } : undefined);
  if (!object) throw new HttpError(404, 'Not found.');

  const headers = new Headers({
    'accept-ranges': 'bytes',
    'cache-control': isPublic ? 'public, max-age=300' : 'private, no-store',
    etag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  let status = 200;
  if (wantsRange && object.range) {
    const offset = object.range.offset ?? object.size - object.range.suffix;
    const length = object.range.length ?? object.size - offset;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    status = 206;
  } else {
    headers.set('content-length', String(object.size));
  }
  if (url.searchParams.get('dl') === '1') {
    headers.set('content-disposition', `attachment; filename="larpin-${post.id}.${post.media_key.split('.').pop()}"`);
    if (isPublic && !wantsRange) ctx.waitUntil(env.DB.prepare('UPDATE posts SET downloads = downloads + 1 WHERE id = ?').bind(id).run());
  }
  return new Response(object.body, { status, headers });
}

/* ---------- moderation queue ---------- */

async function adminQueue(env, url) {
  const held = await env.DB.prepare(`${POST_SELECT} WHERE p.status IN ('flagged', 'quarantined') ORDER BY p.created_at LIMIT 50`).all();
  const reports = await env.DB.prepare(
    `SELECT r.id AS report_id, r.reason AS report_reason, r.detail, r.created_at AS reported_at, p.*, u.username, u.display_name, u.avatar_v
     FROM reports r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = p.user_id
     WHERE r.resolved = 0 ORDER BY r.created_at LIMIT 50`,
  ).all();
  return json({
    held: held.results.map((row) => postShape(url, row, { owner: true })),
    reports: reports.results.map((row) => ({
      id: row.report_id,
      reason: row.report_reason,
      detail: row.detail,
      created_at: row.reported_at,
      post: postShape(url, row, { owner: true }),
    })),
  });
}

async function adminPost(req, env, id) {
  const { action } = await readJson(req);
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) throw new HttpError(404, 'Post not found.');
  if (action === 'approve') {
    if (post.status !== 'flagged') throw new HttpError(409, 'Only posts held for manual review can be approved.');
    await env.DB.prepare(`UPDATE posts SET status = 'approved', reason = '', published_at = ? WHERE id = ?`).bind(Date.now(), id).run();
    await env.MEDIA.delete(Array.from({ length: post.frames }, (_, i) => `frames/${id}/${i}`));
  } else if (action === 'remove') {
    if (post.status === 'quarantined') throw new HttpError(409, 'Quarantined material must be handled through the legal process in the README, not deleted here.');
    await purgePostMedia(env, [post]);
    await env.DB.batch([
      env.DB.prepare(`UPDATE posts SET status = 'removed', reason = 'moderator' WHERE id = ?`).bind(id),
      env.DB.prepare('UPDATE reports SET resolved = 1 WHERE post_id = ?').bind(id),
    ]);
  } else {
    throw new HttpError(400, 'Unknown action.');
  }
  return json({ ok: true });
}

async function adminResolve(env, id) {
  await env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function adminBan(env, username) {
  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username.toLowerCase()).first();
  if (!user) throw new HttpError(404, 'User not found.');
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ]);
  return json({ ok: true });
}
