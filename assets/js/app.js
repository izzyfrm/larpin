import { session, loadSession, setSession, api } from './api.js';
import { apiConfigured } from './config.js';
import { h, icon, avatar, applyTheme, isDark, toast } from './ui.js';
import { renderFeed, openViewer, closeViewer } from './feed.js';
import { renderAuth, renderSubmit, renderMine, renderProfile, renderSettings, renderAdmin } from './pages.js';
import { terms, privacy } from './legal.js';

const view = document.getElementById('view');
const top = document.getElementById('top');
const viewer = document.getElementById('viewer');

let cleanup = null;
let baseHash = null; // The page rendered underneath, which may differ from location.hash while a post is open.

/* ---------- header ---------- */

function renderHeader() {
  const me = session.me;
  const themeButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-icon btn-ghost',
      'aria-label': 'Switch between light and dark',
      title: 'Light / dark',
      onclick: () => {
        applyTheme(isDark() ? 'light' : 'dark');
        renderHeader();
      },
    },
    icon(isDark() ? 'sun' : 'moon'),
  );

  let account;
  if (me) {
    const menu = h(
      'div',
      { class: 'menu', hidden: true },
      h('a', { href: `#/u/${me.username}` }, 'Profile'),
      h('a', { href: '#/mine' }, 'Your submissions'),
      h('a', { href: '#/settings' }, 'Settings'),
      me.is_admin && h('a', { href: '#/admin' }, 'Moderation'),
      h(
        'button',
        {
          type: 'button',
          onclick: async () => {
            try {
              await api('/api/auth/logout', { method: 'POST' });
            } catch {}
            setSession(null, null);
            toast('Signed out.');
            location.hash = '#/';
          },
        },
        'Sign out',
      ),
    );
    const toggle = h('button', { type: 'button', class: 'avatar-btn', 'aria-label': 'Account menu', 'aria-expanded': 'false', onclick: () => setMenu(menu.hidden) }, avatar(me, 34));
    const setMenu = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    account = h('div', { class: 'account' }, toggle, menu);
    account.addEventListener('focusout', (event) => !account.contains(event.relatedTarget) && setMenu(false));
    account.addEventListener('keydown', (event) => event.key === 'Escape' && (setMenu(false), toggle.focus()));
    menu.addEventListener('click', () => setMenu(false));
  } else if (apiConfigured) {
    account = h('a', { class: 'btn btn-ghost', href: '#/login' }, 'Sign in');
  }

  top.replaceChildren(
    h('a', { class: 'logo', href: '#/', 'aria-label': 'larpin home' }, 'larpin'),
    h(
      'div',
      { class: 'top-actions' },
      themeButton,
      apiConfigured && h('a', { class: 'btn btn-accent', href: '#/submit' }, icon('plus'), h('span', { class: 'label' }, 'Submit')),
      account,
    ),
  );
}

/* ---------- pages ---------- */

function renderHome(root, tab) {
  const tabs = [['all', '#/', 'Everything'], ['free', '#/free', 'Free larp'], ['community', '#/community', 'Community']];
  root.append(
    h(
      'section',
      { class: 'hero' },
      h('h1', null, 'Larp images and videos'),
      h('p', { class: 'hero-sub' }, 'Browse, download, or submit your own. Submissions are reviewed before they go live.'),
      h('nav', { class: 'tabs', 'aria-label': 'Feed' }, ...tabs.map(([key, href, label]) => h('a', { href, 'aria-current': key === tab ? 'page' : null }, label))),
    ),
  );
  const feed = h('div', { class: 'page' });
  root.append(feed);
  return renderFeed(feed, { tab });
}

function renderLegal(root, html) {
  const article = h('article', { class: 'page narrow legal' });
  article.innerHTML = html;
  root.append(article);
}

function renderRoute(hash) {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  switch (name) {
    case '':
      return renderHome(view, 'all');
    case 'free':
    case 'community':
      return renderHome(view, name);
    case 'u':
      return renderProfile(view, (arg || '').toLowerCase());
    case 'submit':
      return renderSubmit(view);
    case 'mine':
      return renderMine(view);
    case 'settings':
      return renderSettings(view, () => show(location.hash, true));
    case 'login':
    case 'signup':
      return renderAuth(view, name);
    case 'terms':
      return renderLegal(view, terms);
    case 'privacy':
      return renderLegal(view, privacy);
    case 'admin':
      return renderAdmin(view);
    default:
      view.append(h('div', { class: 'page narrow' }, h('h1', null, 'Nothing here'), h('p', { class: 'muted' }, 'That page does not exist.'), h('a', { class: 'btn', href: '#/' }, 'Back to the feed')));
  }
}

function show(hash, force = false) {
  if (hash === baseHash && !force) return;
  cleanup?.();
  view.replaceChildren();
  baseHash = hash;
  cleanup = renderRoute(hash) || null;
}

function onRoute() {
  const hash = location.hash || '#/';
  const post = /^#\/p\/(.+)$/.exec(hash);
  if (post) {
    // A post opens over whatever page is already there; a direct link gets the feed behind it.
    if (baseHash === null) show('#/');
    openViewer(post[1]);
    return;
  }
  closeViewer();
  const changed = hash !== baseHash;
  show(hash);
  if (changed) {
    scrollTo({ top: 0, behavior: 'instant' });
    view.focus({ preventScroll: true });
  }
}

viewer.addEventListener('close', () => {
  viewer.replaceChildren();
  if (/^#\/p\//.test(location.hash)) location.hash = baseHash || '#/';
});
viewer.addEventListener('click', (event) => event.target === viewer && viewer.close());

/* ---------- back to top ---------- */

const toTop = document.getElementById('to-top');
toTop.append(icon('up', 20));
toTop.addEventListener('click', () => scrollTo({ top: 0 }));
addEventListener('scroll', () => (toTop.hidden = scrollY < 900), { passive: true });

/* ---------- boot ---------- */

addEventListener('hashchange', onRoute);
addEventListener('larpin:session', () => {
  renderHeader();
  // A session that ended elsewhere should not leave a signed-in page on screen.
  if (!session.me && ['#/mine', '#/submit', '#/settings', '#/admin'].includes(baseHash)) show(baseHash, true);
});

renderHeader();
await loadSession();
renderHeader();
onRoute();
