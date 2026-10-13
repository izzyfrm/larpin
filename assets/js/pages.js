import { api, session, setSession } from './api.js';
import { config, apiConfigured } from './config.js';
import { h, icon, avatar, toast, timeAgo, fmtDate, fmtBytes, onSubmit, prefs, applyTheme } from './ui.js';
import { renderFeed } from './feed.js';

const MB = 1048576;
const MAX_IMAGE = 3 * MB;
const MAX_VIDEO = 40 * MB;
const MAX_VIDEO_SECONDS = 120;

const page = (root, className, ...children) => root.append(h('div', { class: `page ${className}` }, ...children));

function offline(root, title) {
  page(
    root,
    'narrow',
    h('h1', null, title),
    h('p', { class: 'muted' }, 'Accounts and submissions are not switched on yet. The free vault works in the meantime.'),
    h('a', { class: 'btn', href: '#/free' }, 'Browse the vault'),
  );
}

function needsLogin(root, title, text) {
  page(
    root,
    'narrow',
    h('h1', null, title),
    h('p', { class: 'muted' }, text),
    h('div', { class: 'row' }, h('a', { class: 'btn btn-accent', href: '#/login' }, 'Sign in'), h('a', { class: 'btn', href: '#/signup' }, 'Make an account')),
  );
}

const field = (label, input, hint) => {
  input.id ||= `f-${input.name}`;
  return h('div', { class: 'field' }, h('label', { htmlFor: input.id }, label), input, hint && h('p', { class: 'hint' }, hint));
};

/* ---------- sign in / sign up ---------- */

export function renderAuth(root, mode) {
  if (!apiConfigured) return offline(root, mode === 'signup' ? 'Make an account' : 'Sign in');
  if (session.me) return void (location.hash = '#/');
  const signup = mode === 'signup';
  const form = h(
    'form',
    { class: 'card form', noValidate: false },
    field(
      'Username',
      h('input', { name: 'username', required: true, minLength: 3, maxLength: 20, pattern: '[A-Za-z0-9_]{3,20}', autocomplete: 'username', autocapitalize: 'none' }),
      signup && 'Letters, numbers and underscores. This is public and cannot be changed.',
    ),
    field(
      'Password',
      h('input', { name: 'password', type: 'password', required: true, minLength: 8, maxLength: 200, autocomplete: signup ? 'new-password' : 'current-password' }),
      signup && 'At least 8 characters. There is no email on file, so a lost password cannot be recovered.',
    ),
    signup &&
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', name: 'agree', required: true }),
        h('span', null, 'I am 13 or older and I accept the ', h('a', { href: '#/terms', target: '_blank' }, 'Terms'), ' and ', h('a', { href: '#/privacy', target: '_blank' }, 'Privacy Policy'), '.'),
      ),
    h('button', { type: 'submit', class: 'btn btn-accent btn-wide' }, signup ? 'Make account' : 'Sign in'),
  );
  onSubmit(form, async (data) => {
    const body = { username: data.get('username'), password: data.get('password'), agree: data.get('agree') === 'on' };
    const res = await api(`/api/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body });
    setSession(res.token, res.user);
    toast(signup ? `Welcome, @${res.user.username}.` : 'Signed in.', 'ok');
    location.hash = signup ? '#/submit' : '#/';
  });
  page(
    root,
    'narrow',
    h('h1', null, signup ? 'Make an account' : 'Sign in'),
    form,
    h('p', { class: 'muted center' }, signup ? 'Already have one? ' : 'New here? ', h('a', { href: signup ? '#/login' : '#/signup' }, signup ? 'Sign in' : 'Make an account')),
  );
}

/* ---------- submit ---------- */

const once = (target, event) =>
  new Promise((resolve, reject) => {
    target.addEventListener(event, resolve, { once: true });
    target.addEventListener('error', () => reject(new Error('That file could not be read.')), { once: true });
  });

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function draw(source, width, height, maxSide, opaque) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = h('canvas', { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) });
  const ctx = canvas.getContext('2d');
  if (opaque) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Re-encodes in the browser: caps the size and drops metadata such as GPS location. */
async function prepareImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read. Use a JPEG, PNG or WebP.');
  }
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
  for (const [type, quality, side] of [[keepAlpha ? 'image/webp' : 'image/jpeg', 0.9, 2400], ['image/jpeg', 0.85, 2400], ['image/jpeg', 0.75, 1800]]) {
    const canvas = draw(bitmap, bitmap.width, bitmap.height, side, type === 'image/jpeg');
    const blob = await toBlob(canvas, type, quality);
    if (blob && blob.size <= MAX_IMAGE) return { blob, width: canvas.width, height: canvas.height, duration: 0, frames: [] };
  }
  throw new Error('That image is too large even after compression.');
}

/** Reads size and length, and grabs six evenly spaced stills for the safety review. */
async function prepareVideo(file) {
  if (file.size > MAX_VIDEO) throw new Error('Videos must be under 40 MB.');
  const video = h('video', { muted: true, playsInline: true, preload: 'auto' });
  const src = URL.createObjectURL(file);
  try {
    video.src = src;
    await once(video, 'loadedmetadata');
    if (video.duration === Infinity) {
      // Screen recordings often carry no length; seeking past the end makes the browser work it out.
      video.currentTime = 1e9;
      await once(video, 'seeked');
    }
    if (!Number.isFinite(video.duration) || !video.videoWidth) throw new Error('That video could not be read. Use MP4 or WebM.');
    if (video.duration > MAX_VIDEO_SECONDS) throw new Error('Videos can be up to 2 minutes long.');
    const frames = [];
    for (let i = 0; i < 6; i++) {
      video.currentTime = ((i + 0.5) / 6) * video.duration;
      await once(video, 'seeked');
      frames.push(await toBlob(draw(video, video.videoWidth, video.videoHeight, 512, true), 'image/jpeg', 0.8));
    }
    return { blob: file, width: video.videoWidth, height: video.videoHeight, duration: Math.round(video.duration), frames };
  } finally {
    URL.revokeObjectURL(src);
  }
}

function upload(body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${config.apiBase}/api/posts`);
    xhr.setRequestHeader('authorization', `Bearer ${session.token}`);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      xhr.status < 300 ? resolve(data) : reject(new Error(data.error || 'Upload failed.'));
    };
    xhr.send(body);
  });
}

export function renderSubmit(root) {
  if (!apiConfigured) return offline(root, 'Submit a larp');
  if (!session.me) return needsLogin(root, 'Submit a larp', 'You need an account to submit, so each post has an owner who can take it down.');

  let prepared = null;
  let previewUrl = null;
  const input = h('input', { type: 'file', name: 'file', accept: 'image/jpeg,image/png,image/webp,video/mp4,video/webm', class: 'sr-only', id: 'f-file' });
  const preview = h('div', { class: 'drop-preview' });
  const prompt = h(
    'div',
    { class: 'drop-prompt' },
    icon('upload', 28),
    h('p', null, h('strong', null, 'Drop a file'), ' or tap to choose'),
    h('p', { class: 'hint' }, 'JPEG, PNG, WebP up to 3 MB after compression · MP4, WebM up to 40 MB and 2 minutes'),
  );
  const drop = h('label', { class: 'drop', htmlFor: 'f-file' }, input, prompt, preview);
  const bar = h('div', { class: 'progress', hidden: true }, h('div', { class: 'progress-fill' }));
  const title = h('input', { name: 'title', required: true, minLength: 2, maxLength: 80, placeholder: 'e.g. casual tuesday garage', autocomplete: 'off' });
  const button = h('button', { type: 'submit', class: 'btn btn-accent btn-wide', disabled: true }, 'Submit for review');

  async function choose(file) {
    if (!file) return;
    prepared = null;
    button.disabled = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    preview.replaceChildren(h('span', { class: 'spinner' }));
    drop.classList.add('has-file');
    try {
      const isVideo = file.type.startsWith('video/');
      prepared = await (isVideo ? prepareVideo(file) : prepareImage(file));
      previewUrl = URL.createObjectURL(prepared.blob);
      preview.replaceChildren(
        isVideo ? h('video', { src: previewUrl, muted: true, loop: true, autoplay: true, playsInline: true }) : h('img', { src: previewUrl, alt: 'Preview' }),
        h('span', { class: 'drop-facts' }, `${prepared.width}×${prepared.height} · ${fmtBytes(prepared.blob.size)} · tap to change`),
      );
      button.disabled = false;
      if (!title.value) title.focus();
    } catch (error) {
      drop.classList.remove('has-file');
      preview.replaceChildren();
      toast(error.message, 'bad');
    }
  }

  input.addEventListener('change', () => choose(input.files[0]));
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, (e) => (e.preventDefault(), drop.classList.add('over')));
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, (e) => (e.preventDefault(), drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => choose(e.dataTransfer.files[0]));

  const form = h(
    'form',
    { class: 'form' },
    drop,
    field('Title', title, 'Shown under the post. Keep it clean.'),
    h(
      'label',
      { class: 'check' },
      h('input', { type: 'checkbox', name: 'rights', required: true }),
      h('span', null, 'I made this or have the right to share it, and it follows the ', h('a', { href: '#/terms', target: '_blank' }, 'content rules'), '.'),
    ),
    bar,
    button,
  );
  onSubmit(form, async () => {
    if (!prepared) throw new Error('Choose a file first.');
    const body = new FormData();
    const ext = prepared.blob.type.split('/')[1] || 'bin';
    body.append('file', prepared.blob, `upload.${ext}`);
    body.append('title', title.value);
    for (const key of ['width', 'height', 'duration']) body.append(key, prepared[key]);
    prepared.frames.forEach((frame, i) => body.append('frames', frame, `frame-${i}.jpg`));
    bar.hidden = false;
    try {
      await upload(body, (ratio) => (bar.firstChild.style.width = `${Math.round(ratio * 100)}%`));
    } finally {
      bar.hidden = true;
    }
    toast('Submitted. It goes live in about 2 minutes if it passes review.', 'ok');
    location.hash = '#/mine';
  });

  page(
    root,
    'narrow',
    h('h1', null, 'Submit a larp'),
    h('p', { class: 'muted' }, 'Every submission is checked by an automated safety review before anyone else can see it. That takes about two minutes.'),
    form,
    h(
      'ul',
      { class: 'rules' },
      h('li', null, 'No nudity, sexual content or anything 18+. This is an all-ages site.'),
      h('li', null, 'No real people’s private details: faces of strangers, addresses, card numbers, IDs, plates.'),
      h('li', null, 'No fake documents, receipts or payment screenshots made to be passed off as real.'),
      h('li', null, 'Only what you made or are allowed to share.'),
    ),
  );
  return () => previewUrl && URL.revokeObjectURL(previewUrl);
}

/* ---------- my submissions ---------- */

const REJECTIONS = {
  sexual: 'Rejected: adult or sexual content',
  gore: 'Rejected: graphic violence',
  hate: 'Rejected: hateful content',
};

function statusOf(post) {
  switch (post.status) {
    case 'approved':
      return ['live', 'Live'];
    case 'pending': {
      const left = Math.ceil((post.review_at - Date.now()) / 1000);
      return ['wait', left > 0 ? `In review · about ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left` : 'Reviewing now…'];
    }
    case 'flagged':
      return ['wait', 'Waiting for a human check'];
    case 'removed':
      return ['bad', 'Removed by a moderator'];
    default:
      return ['bad', REJECTIONS[post.reason] || 'Rejected: broke the content rules'];
  }
}

export function renderMine(root) {
  if (!apiConfigured) return offline(root, 'Your submissions');
  if (!session.me) return needsLogin(root, 'Your submissions', 'Sign in to see what you have submitted.');

  const list = h('div', { class: 'mine' }, h('span', { class: 'spinner' }));
  const blobs = new Map();
  let posts = [];
  let alive = true;

  // Unreviewed media is private, so it is fetched with the session rather than a plain <img src>.
  async function thumb(post, holder) {
    if (post.kind !== 'image' || !['pending', 'flagged'].includes(post.status)) return;
    try {
      if (!blobs.has(post.id)) {
        const res = await api(`/media/${post.id}`, { raw: true });
        blobs.set(post.id, URL.createObjectURL(await res.blob()));
      }
      holder.replaceChildren(h('img', { src: blobs.get(post.id), alt: '' }));
    } catch {}
  }

  function row(post) {
    const [tone, text] = statusOf(post);
    const holder = h('div', { class: 'mine-thumb' });
    if (post.status === 'approved') {
      holder.append(post.kind === 'video' ? h('video', { src: `${post.url}#t=0.1`, muted: true, preload: 'metadata' }) : h('img', { src: post.url, alt: '', loading: 'lazy' }));
    } else {
      holder.append(icon(post.kind === 'video' ? 'play' : 'upload', 20));
      thumb(post, holder);
    }
    return h(
      'article',
      { class: 'mine-row' },
      post.status === 'approved' ? h('a', { href: `#/p/${post.id}`, 'aria-label': `Open ${post.title}` }, holder) : holder,
      h(
        'div',
        { class: 'mine-body' },
        h('p', { class: 'mine-title' }, post.title),
        h('p', { class: `pill pill-${tone}`, dataset: { status: post.id } }, text),
        h('p', { class: 'hint' }, `Submitted ${timeAgo(post.submitted_at)}`),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-icon',
          'aria-label': `Delete ${post.title}`,
          title: 'Delete',
          onclick: async () => {
            if (!confirm('Delete this submission for good?')) return;
            try {
              await api(`/api/posts/${post.id}`, { method: 'DELETE' });
              load();
            } catch (error) {
              toast(error.message, 'bad');
            }
          },
        },
        icon('trash'),
      ),
    );
  }

  async function load() {
    try {
      posts = (await api('/api/me/posts')).posts;
    } catch (error) {
      if (alive) list.replaceChildren(h('p', { class: 'muted' }, error.message));
      return;
    }
    if (!alive) return;
    list.replaceChildren(
      ...(posts.length
        ? posts.map(row)
        : [h('div', { class: 'empty' }, h('p', null, 'You have not submitted anything yet.'), h('a', { class: 'btn btn-accent', href: '#/submit' }, 'Submit a larp'))]),
    );
  }

  const countdown = setInterval(() => {
    for (const post of posts) {
      if (post.status !== 'pending') continue;
      const el = list.querySelector(`[data-status="${CSS.escape(post.id)}"]`);
      if (el) el.textContent = statusOf(post)[1];
    }
  }, 1000);
  const poll = setInterval(() => posts.some((post) => post.status === 'pending') && load(), 10000);
  load();

  page(root, 'narrow', h('div', { class: 'row spread' }, h('h1', null, 'Your submissions'), h('a', { class: 'btn btn-accent', href: '#/submit' }, icon('plus'), 'New')), list);
  return () => {
    alive = false;
    clearInterval(countdown);
    clearInterval(poll);
    blobs.forEach((url) => URL.revokeObjectURL(url));
  };
}

/* ---------- profile ---------- */

export function renderProfile(root, username) {
  if (!apiConfigured) return offline(root, `@${username}`);
  const head = h('header', { class: 'profile' }, h('span', { class: 'spinner' }));
  const feed = h('div');
  root.append(h('div', { class: 'page' }, head, feed));
  let cleanup = null;
  api(`/api/users/${encodeURIComponent(username)}`)
    .then(({ user }) => {
      head.replaceChildren(
        avatar(user, 88),
        h(
          'div',
          { class: 'profile-body' },
          h('h1', null, user.display_name),
          h('p', { class: 'muted' }, `@${user.username} · ${user.posts} post${user.posts === 1 ? '' : 's'} · joined ${fmtDate(user.created_at)}`),
          user.bio && h('p', { class: 'profile-bio' }, user.bio),
          session.me?.username === user.username && h('a', { class: 'btn', href: '#/settings' }, 'Edit profile'),
        ),
      );
      cleanup = renderFeed(feed, { tab: 'community', username: user.username });
    })
    .catch((error) => head.replaceChildren(h('div', { class: 'empty' }, h('p', null, error.message), h('a', { class: 'btn', href: '#/' }, 'Back to the feed'))));
  return () => cleanup?.();
}

/* ---------- settings ---------- */

async function squareAvatar(file) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image could not be read.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = h('canvas', { width: 256, height: 256 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return toBlob(canvas, 'image/jpeg', 0.88);
}

const section = (title, ...children) => h('section', { class: 'card settings-section' }, h('h2', null, title), ...children);

function segmented(name, options, current, onChange) {
  return h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': name },
    ...options.map(([value, label]) =>
      h(
        'label',
        null,
        h('input', { type: 'radio', name, value, checked: value === current, class: 'sr-only', onchange: () => onChange(value) }),
        h('span', null, label),
      ),
    ),
  );
}

export function renderSettings(root, rerender) {
  const me = session.me;
  const sections = [];

  if (me) {
    const picture = h('div', { class: 'avatar-edit' }, avatar(me, 72));
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'f-avatar' });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      picture.classList.add('busy');
      try {
        const res = await api('/api/me/avatar', { method: 'PUT', body: await squareAvatar(file.files[0]) });
        setSession(session.token, res.user);
        toast('Profile picture updated.', 'ok');
        rerender();
      } catch (error) {
        toast(error.message, 'bad');
      } finally {
        picture.classList.remove('busy');
      }
    });
    const profile = h(
      'form',
      { class: 'form' },
      h(
        'div',
        { class: 'row' },
        picture,
        h(
          'div',
          { class: 'row' },
          h('label', { class: 'btn', htmlFor: 'f-avatar' }, file, 'Change picture'),
          me.avatar_url &&
            h(
              'button',
              {
                type: 'button',
                class: 'btn',
                onclick: async () => {
                  try {
                    setSession(session.token, (await api('/api/me/avatar', { method: 'DELETE' })).user);
                    rerender();
                  } catch (error) {
                    toast(error.message, 'bad');
                  }
                },
              },
              'Remove',
            ),
        ),
      ),
      field('Display name', h('input', { name: 'display_name', maxLength: 32, value: me.display_name, autocomplete: 'nickname' })),
      field('Bio', h('textarea', { name: 'bio', maxLength: 200, rows: 3, value: me.bio }), 'Up to 200 characters. Public.'),
      h('div', { class: 'row spread' }, h('a', { href: `#/u/${me.username}` }, `View @${me.username}`), h('button', { type: 'submit', class: 'btn btn-accent' }, 'Save profile')),
    );
    onSubmit(profile, async (data) => {
      const res = await api('/api/me', { method: 'PATCH', body: { display_name: data.get('display_name'), bio: data.get('bio') } });
      setSession(session.token, res.user);
      toast('Profile saved.', 'ok');
    });
    sections.push(section('Profile', profile));
  } else if (apiConfigured) {
    sections.push(section('Profile', h('p', { class: 'muted' }, 'Sign in to edit your name, bio and picture.'), h('a', { class: 'btn btn-accent', href: '#/login' }, 'Sign in')));
  }

  sections.push(
    section(
      'Appearance',
      h('div', { class: 'setting' }, h('div', null, h('p', null, 'Theme'), h('p', { class: 'hint' }, 'Black is the default.')), segmented('Theme', [['dark', 'Dark'], ['light', 'Light']], prefs.get('theme', 'dark') === 'light' ? 'light' : 'dark', applyTheme)),
      h(
        'div',
        { class: 'setting' },
        h('div', null, h('p', null, 'Autoplay videos'), h('p', { class: 'hint' }, 'Plays muted previews in the feed. Always off when your device asks for reduced motion.')),
        segmented('Autoplay', [['on', 'On'], ['off', 'Off']], prefs.get('autoplay', 'on'), (value) => prefs.set('autoplay', value)),
      ),
    ),
  );

  if (me) {
    const password = h(
      'form',
      { class: 'form' },
      field('Current password', h('input', { name: 'current', type: 'password', required: true, autocomplete: 'current-password' })),
      field('New password', h('input', { name: 'next', type: 'password', required: true, minLength: 8, maxLength: 200, autocomplete: 'new-password' }), 'Changing it signs out every other device.'),
      h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'btn btn-accent' }, 'Change password')),
    );
    onSubmit(password, async (data) => {
      await api('/api/me/password', { method: 'POST', body: { current: data.get('current'), next: data.get('next') } });
      password.reset();
      toast('Password changed.', 'ok');
    });
    const signOut = async (everywhere) => {
      try {
        await api(`/api/auth/logout${everywhere ? '?all=1' : ''}`, { method: 'POST' });
      } catch {}
      setSession(null, null);
      location.hash = '#/';
    };
    sections.push(
      section(
        'Security',
        password,
        h('div', { class: 'setting' }, h('div', null, h('p', null, 'Sessions'), h('p', { class: 'hint' }, 'Sessions end on their own after 30 days.')), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => signOut(false) }, 'Sign out'), h('button', { type: 'button', class: 'btn', onclick: () => signOut(true) }, 'Sign out everywhere'))),
      ),
    );

    const remove = h(
      'form',
      { class: 'form' },
      h('p', { class: 'muted' }, 'Deletes your account, profile, picture and every post you submitted, immediately and for good. Copies other people already downloaded are out of our hands.'),
      field('Password to confirm', h('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password', id: 'f-delete-password' })),
      h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'btn btn-danger' }, 'Delete my account')),
    );
    onSubmit(remove, async (data) => {
      if (!confirm('Delete your account and everything you posted? This cannot be undone.')) return;
      await api('/api/me/delete', { method: 'POST', body: { password: data.get('password') } });
      setSession(null, null);
      toast('Your account is deleted.', 'ok');
      location.hash = '#/';
    });
    sections.push(section('Delete account', remove));
  }

  page(root, 'narrow', h('h1', null, 'Settings'), ...sections);
}

/* ---------- moderation queue ---------- */

export function renderAdmin(root) {
  if (!session.me?.is_admin) return page(root, 'narrow', h('h1', null, 'Not found'), h('a', { class: 'btn', href: '#/' }, 'Back to the feed'));
  const body = h('div', null, h('span', { class: 'spinner' }));
  const blobs = [];

  const act = async (path, payload, message) => {
    try {
      await api(path, { method: 'POST', body: payload });
      toast(message, 'ok');
      load();
    } catch (error) {
      toast(error.message, 'bad');
    }
  };

  function preview(post) {
    const holder = h('div', { class: 'queue-media' });
    if (post.status === 'quarantined') {
      holder.append(h('p', { class: 'hint' }, 'Not viewable. Flagged as possible child sexual abuse material: do not try to open it. Follow the legal steps in the README.'));
    } else if (post.status === 'approved') {
      holder.append(post.kind === 'video' ? h('video', { src: post.url, controls: true, preload: 'metadata' }) : h('img', { src: post.url, alt: '' }));
    } else {
      holder.append(
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: async () => {
              try {
                const url = URL.createObjectURL(await (await api(`/media/${post.id}`, { raw: true })).blob());
                blobs.push(url);
                holder.replaceChildren(post.kind === 'video' ? h('video', { src: url, controls: true }) : h('img', { src: url, alt: '' }));
              } catch (error) {
                toast(error.message, 'bad');
              }
            },
          },
          'Load for review',
        ),
      );
    }
    return holder;
  }

  const card = (post, note, actions) =>
    h(
      'article',
      { class: 'card queue-item' },
      preview(post),
      h('div', { class: 'queue-body' }, h('p', { class: 'mine-title' }, post.title), h('p', { class: 'hint' }, `@${post.author.username} · ${post.status} · ${timeAgo(post.submitted_at)}`), note, h('div', { class: 'row' }, ...actions)),
    );

  async function load() {
    let queue;
    try {
      queue = await api('/api/admin/queue');
    } catch (error) {
      return body.replaceChildren(h('p', { class: 'muted' }, error.message));
    }
    const removeBtn = (post) => h('button', { type: 'button', class: 'btn btn-danger', onclick: () => confirm('Remove this post?') && act(`/api/admin/posts/${post.id}`, { action: 'remove' }, 'Removed.') }, 'Remove');
    const banBtn = (post) => h('button', { type: 'button', class: 'btn', onclick: () => confirm(`Ban @${post.author.username}?`) && act(`/api/admin/users/${post.author.username}/ban`, {}, 'User banned.') }, 'Ban user');
    body.replaceChildren(
      h('h2', null, `Held for review (${queue.held.length})`),
      ...queue.held.map((post) =>
        card(
          post,
          h('p', { class: 'pill pill-wait' }, post.reason === 'review_unavailable' ? 'Automated review failed 3 times' : post.reason),
          post.status === 'quarantined' ? [banBtn(post)] : [h('button', { type: 'button', class: 'btn btn-accent', onclick: () => act(`/api/admin/posts/${post.id}`, { action: 'approve' }, 'Approved.') }, 'Approve'), removeBtn(post), banBtn(post)],
        ),
      ),
      h('h2', null, `Open reports (${queue.reports.length})`),
      ...queue.reports.map((report) =>
        card(report.post, h('p', null, h('span', { class: 'pill pill-bad' }, report.reason.replaceAll('_', ' ')), report.detail && ` ${report.detail}`), [
          h('button', { type: 'button', class: 'btn', onclick: () => act(`/api/admin/reports/${report.id}`, {}, 'Report dismissed.') }, 'Dismiss'),
          removeBtn(report.post),
          banBtn(report.post),
        ]),
      ),
    );
  }
  load();
  page(root, 'narrow', h('h1', null, 'Moderation'), body);
  return () => blobs.forEach((url) => URL.revokeObjectURL(url));
}
