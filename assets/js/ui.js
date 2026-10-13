/** Tiny DOM builder. Strings become text nodes, so user content is never parsed as HTML. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el && key !== 'list' && key !== 'form') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return el;
}

const ICONS = {
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  flag: '<path d="M5 21V4m0 0h11l-1.5 4L16 12H5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  up: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 20h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};

export function icon(name, size = 18) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

export function toast(message, tone = 'info') {
  const el = h('div', { class: `toast toast-${tone}` }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, 4200);
}

export function avatar(user, size = 32) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`;
  if (user?.avatar_url) return h('img', { class: 'avatar', src: user.avatar_url, alt: '', style, loading: 'lazy' });
  return h('span', { class: 'avatar avatar-blank', style, 'aria-hidden': 'true' }, (user?.display_name || user?.username || '?')[0].toUpperCase());
}

export function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  const units = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [label, secs] of units) if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  return 'just now';
}

export const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function fmtBytes(n) {
  if (!n) return '';
  return n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Wraps a form submit: disables the button, shows errors inline, re-enables afterwards. */
export function onSubmit(form, handler) {
  const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
  form.append(error);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    error.hidden = true;
    button.disabled = true;
    button.classList.add('busy');
    try {
      await handler(new FormData(form));
    } catch (err) {
      error.textContent = err.message || 'Something went wrong.';
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.classList.remove('busy');
    }
  });
}

export const prefs = {
  get(key, fallback) {
    try {
      return localStorage.getItem(`larpin.${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`larpin.${key}`, value);
    } catch {}
  },
};

export function applyTheme(theme) {
  prefs.set('theme', theme);
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}

export const isDark = () => document.documentElement.dataset.theme !== 'light';
