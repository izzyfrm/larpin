import { api, loadFree, session } from './api.js';
import { apiConfigured } from './config.js';
import { h, icon, avatar, toast, timeAgo, fmtBytes, fmtDuration, onSubmit, prefs } from './ui.js';

// Every item that has been shown, so the viewer can open instantly.
const known = new Map();

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const playObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.isIntersecting && prefs.get('autoplay', 'on') === 'on' && !reducedMotion()) video.play().catch(() => {});
      else video.pause();
    }
  },
  { threshold: 0.6 },
);

function downloadLink(item, className, label) {
  return h(
    'a',
    {
      class: className,
      href: item.free ? item.url : `${item.url}?dl=1`,
      download: item.free ? item.filename : '',
      'aria-label': label ? null : `Download ${item.title}`,
      title: label ? null : 'Download',
      onclick: (event) => event.stopPropagation(),
    },
    icon('download'),
    label,
  );
}

function tile(item) {
  known.set(item.id, item);
  const sized = item.width > 0 && item.height > 0;
  const ratio = sized ? Math.min(2.2, Math.max(0.5, item.width / item.height)) : 0.8;
  const media =
    item.kind === 'video'
      ? h('video', { src: `${item.url}#t=0.1`, muted: true, loop: true, playsInline: true, preload: 'metadata', tabIndex: -1 })
      : h('img', { src: item.url, alt: '', loading: 'lazy', decoding: 'async' });
  const frame = h(
    'a',
    { class: 'tile-media', href: `#/p/${item.id}`, style: `aspect-ratio:${ratio}`, 'aria-label': `Open ${item.title}` },
    media,
    item.kind === 'video' && h('span', { class: 'badge badge-video' }, icon('play', 12), item.duration ? fmtDuration(item.duration) : 'Video'),
    item.free && h('span', { class: 'badge badge-free' }, 'Free'),
  );
  media.addEventListener(item.kind === 'video' ? 'loadeddata' : 'load', () => {
    // Folder items have no stored size, so the tile takes its real shape once loaded.
    const w = media.videoWidth || media.naturalWidth;
    const hgt = media.videoHeight || media.naturalHeight;
    if (!sized && w && hgt) frame.style.aspectRatio = String(Math.min(2.2, Math.max(0.5, w / hgt)));
    frame.classList.add('ready');
  });
  media.addEventListener('error', () => frame.classList.add('ready', 'broken'));
  if (item.kind === 'video') playObserver.observe(media);

  return h(
    'article',
    { class: 'tile', dataset: { id: item.id } },
    frame,
    downloadLink(item, 'tile-dl'),
    h(
      'div',
      { class: 'tile-meta' },
      h('span', { class: 'tile-title' }, item.title),
      item.free
        ? h('span', { class: 'tile-by' }, 'larpin vault')
        : h('a', { class: 'tile-by', href: `#/u/${item.author.username}` }, `@${item.author.username}`),
    ),
  );
}

/** Columns filled shortest-first, so new pages append without reshuffling what is on screen. */
function createMasonry(grid) {
  let columns = [];
  const tiles = [];
  const wanted = () => (grid.clientWidth < 540 ? 2 : Math.min(5, Math.floor(grid.clientWidth / 250)));
  const place = (el) => columns.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a)).append(el);
  const build = () => {
    grid.replaceChildren();
    columns = Array.from({ length: wanted() }, () => grid.appendChild(h('div', { class: 'grid-col' })));
    tiles.filter((el) => el.dataset.gone !== '1').forEach(place);
  };
  const observer = new ResizeObserver(() => wanted() !== columns.length && build());
  observer.observe(grid);
  build();
  return {
    add(el) {
      tiles.push(el);
      place(el);
    },
    clear() {
      tiles.length = 0;
      build();
    },
    destroy: () => observer.disconnect(),
  };
}

/**
 * Renders a feed into `root`.
 * tab: 'all' | 'free' | 'community'. `username` limits it to one person's posts.
 * Returns a cleanup function.
 */
export function renderFeed(root, { tab = 'all', username = null } = {}) {
  let kind = 'all';
  let run = 0;
  let community = [];
  let free = [];
  let cursor = 0;
  let done = false;
  let loading = false;
  let failed = null;
  const shown = new Set();

  const grid = h('div', { class: 'grid' });
  const status = h('div', { class: 'feed-status' });
  const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
  const filters = h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': 'Filter by type' },
    ...[['all', 'All'], ['image', 'Images'], ['video', 'Videos']].map(([value, label]) =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(value === kind), onclick: () => setKind(value) }, label),
    ),
  );
  root.append(filters, grid, status, sentinel);
  const masonry = createMasonry(grid);

  const usesFree = !username && tab !== 'community';
  const usesApi = tab !== 'free';

  function setKind(value) {
    if (value === kind) return;
    kind = value;
    [...filters.children].forEach((chip, i) => chip.setAttribute('aria-pressed', String(['all', 'image', 'video'][i] === kind)));
    reset();
  }

  function flush() {
    // Folder items older than the oldest loaded post wait until more posts arrive.
    const floor = done || !community.length ? -Infinity : community[community.length - 1].created_at;
    const ready = [...community, ...free.filter((item) => item.created_at >= floor)]
      .filter((item) => !shown.has(item.id))
      .sort((a, b) => b.created_at - a.created_at);
    for (const item of ready) {
      shown.add(item.id);
      masonry.add(tile(item));
    }
    status.replaceChildren();
    if (!done) return status.append(h('span', { class: 'spinner', 'aria-label': 'Loading' }));
    if (failed) status.append(h('p', { class: 'muted' }, failed));
    if (!shown.size) status.append(emptyState());
    else if (!failed) status.append(h('p', { class: 'end muted' }, 'End of feed.'));
  }

  function emptyState() {
    if (username) return h('p', { class: 'empty' }, 'Nothing public here yet.');
    if (tab === 'free') {
      return h('div', { class: 'empty' }, h('p', null, 'The vault is empty.'), h('p', { class: 'muted' }, 'Files dropped into the larp-stuff folder show up here on the next deploy.'));
    }
    return h('div', { class: 'empty' }, h('p', null, 'Nothing here yet.'), apiConfigured && h('a', { class: 'btn btn-accent', href: '#/submit' }, 'Submit the first one'));
  }

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    const mine = run;
    try {
      const query = new URLSearchParams({ limit: '24' });
      if (cursor) query.set('before', cursor);
      if (kind !== 'all') query.set('kind', kind);
      if (username) query.set('user', username);
      const page = await api(`/api/posts?${query}`);
      if (mine !== run) return;
      community.push(...page.posts);
      cursor = page.next;
      done = !page.next;
    } catch (error) {
      if (mine !== run) return;
      done = true;
      // An unconfigured backend is expected on a fresh deploy; stay quiet and show the vault.
      failed = apiConfigured ? error.message : null;
    } finally {
      if (mine === run) loading = false;
    }
    flush();
    if (!done && sentinel.getBoundingClientRect().top < innerHeight + 800) loadMore();
  }

  async function reset() {
    const mine = ++run;
    community = [];
    free = [];
    cursor = 0;
    failed = null;
    loading = false;
    done = !usesApi;
    shown.clear();
    masonry.clear();
    status.replaceChildren(h('span', { class: 'spinner', 'aria-label': 'Loading' }));
    if (usesFree) {
      const all = await loadFree();
      if (mine !== run) return;
      free = all.filter((item) => kind === 'all' || item.kind === kind);
    }
    if (usesApi) loadMore();
    else flush();
  }

  const scrollObserver = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '800px' });
  scrollObserver.observe(sentinel);
  reset();

  return () => {
    run++;
    scrollObserver.disconnect();
    masonry.destroy();
    grid.querySelectorAll('video').forEach((video) => playObserver.unobserve(video));
  };
}

/* ---------- viewer ---------- */

const REPORT_REASONS = [
  ['nsfw', 'Nudity or sexual content'],
  ['minor_safety', 'Endangers or sexualises a minor'],
  ['scam_or_fraud', 'Being used to scam or defraud'],
  ['impersonation', 'Impersonates a real person'],
  ['private_info', 'Shows private or personal information'],
  ['copyright', 'It is mine and was posted without permission'],
  ['hate_or_violence', 'Hate, threats or graphic violence'],
  ['other', 'Something else'],
];

async function findItem(id) {
  if (known.has(id)) return known.get(id);
  if (id.startsWith('free~')) return (await loadFree()).find((item) => item.id === id) || null;
  return (await api(`/api/posts/${id}`)).post;
}

function reportForm(item, panel) {
  const form = h(
    'form',
    { class: 'report' },
    h('label', { htmlFor: 'report-reason' }, 'What is wrong with it?'),
    h('select', { id: 'report-reason', name: 'reason', required: true }, ...REPORT_REASONS.map(([value, label]) => h('option', { value }, label))),
    h('label', { htmlFor: 'report-detail' }, 'Anything a moderator should know (optional)'),
    h('textarea', { id: 'report-detail', name: 'detail', maxLength: 500, rows: 3 }),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'submit', class: 'btn btn-accent' }, 'Send report'),
      h('button', { type: 'button', class: 'btn', onclick: () => form.remove() }, 'Cancel'),
    ),
  );
  onSubmit(form, async (data) => {
    await api(`/api/posts/${item.id}/report`, { method: 'POST', body: { reason: data.get('reason'), detail: data.get('detail') } });
    form.remove();
    toast('Report sent. A moderator will look at it.', 'ok');
  });
  panel.append(form);
  form.querySelector('select').focus();
}

export async function openViewer(id) {
  const dialog = document.getElementById('viewer');
  const close = h('button', { class: 'viewer-close', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close', 22));
  dialog.replaceChildren(close, h('div', { class: 'viewer-loading' }, h('span', { class: 'spinner' })));
  if (!dialog.open) dialog.showModal();

  let item;
  try {
    item = await findItem(id);
  } catch (error) {
    item = null;
    dialog.replaceChildren(close, h('div', { class: 'viewer-loading' }, h('p', null, error.message)));
    return;
  }
  if (!item) {
    dialog.replaceChildren(close, h('div', { class: 'viewer-loading' }, h('p', null, 'That one is gone.')));
    return;
  }

  const media =
    item.kind === 'video'
      ? h('video', { src: item.url, controls: true, playsInline: true, loop: true, autoplay: !reducedMotion(), preload: 'metadata' })
      : h('img', { src: item.url, alt: item.title });

  const me = session.me;
  const canDelete = !item.free && me && (me.username === item.author.username || me.is_admin);
  const panel = h('div', { class: 'viewer-panel' });

  async function remove() {
    if (!confirm('Delete this post for good?')) return;
    try {
      if (me.username === item.author.username) await api(`/api/posts/${item.id}`, { method: 'DELETE' });
      else await api(`/api/admin/posts/${item.id}`, { method: 'POST', body: { action: 'remove' } });
      known.delete(item.id);
      const el = document.querySelector(`.tile[data-id="${CSS.escape(item.id)}"]`);
      if (el) (el.dataset.gone = '1'), el.remove();
      toast('Post deleted.', 'ok');
      dialog.close();
    } catch (error) {
      toast(error.message, 'bad');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied.', 'ok');
    } catch {
      toast('Could not copy. The link is in your address bar.', 'bad');
    }
  }

  panel.append(
    h('h2', { class: 'viewer-title' }, item.title),
    item.free
      ? h('p', { class: 'byline' }, h('span', { class: 'badge badge-free' }, 'Free'), 'From the larpin vault')
      : h('a', { class: 'byline', href: `#/u/${item.author.username}` }, avatar(item.author, 28), h('span', null, item.author.display_name), h('span', { class: 'muted' }, `@${item.author.username}`)),
    h(
      'p',
      { class: 'viewer-facts muted' },
      [
        item.created_at && timeAgo(item.created_at),
        item.kind === 'video' ? 'Video' : 'Image',
        item.width && item.height && `${item.width}×${item.height}`,
        fmtBytes(item.size),
        !item.free && `${item.downloads} download${item.downloads === 1 ? '' : 's'}`,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    downloadLink(item, 'btn btn-accent btn-wide', 'Download'),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: copyLink }, icon('link'), 'Copy link'),
      !item.free &&
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: () => {
              if (!me) return toast('Sign in to report a post.');
              if (!panel.querySelector('.report')) reportForm(item, panel);
            },
          },
          icon('flag'),
          'Report',
        ),
      canDelete && h('button', { type: 'button', class: 'btn btn-danger', onclick: remove }, icon('trash'), 'Delete'),
    ),
    h('p', { class: 'fine' }, 'A prop for jokes and roleplay. Using it to deceive someone for money or to pose as a real person breaks the ', h('a', { href: '#/terms' }, 'Terms'), '.'),
  );

  dialog.replaceChildren(close, h('div', { class: 'viewer-stage' }, media), panel);
}

export function closeViewer() {
  const dialog = document.getElementById('viewer');
  if (dialog.open) dialog.close();
  dialog.replaceChildren();
}
