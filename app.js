import { API_URL, CONTACT_EMAIL } from "./config.js";
const paths = {
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M16 8l-3 5-5 3 3-5 5-3Z",
  sparkles:
    "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z M20 2v4 M18 4h4",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-2a8 8 0 0 1 16 0v2",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  moon: "M20 14A8 8 0 0 1 10 4a9 9 0 1 0 10 10Z",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  plus: "M12 5v14 M5 12h14",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M15 15l5 5",
  sort: "M4 6h16 M7 12h13 M10 18h10",
  close: "m6 6 12 12 M6 18 18 6",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  download: "M12 3v13 M7 11l5 5 5-5 M4 17v4h16v-4",
  play: "m8 5 11 7-11 7V5Z",
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.sparkles}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeURL = (s) => {
  try {
    const u = new URL(s, location.href);
    return ["https:", "http:", "blob:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
};
const photo = (id, w = 700) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const inspiration = [
  [
    "weekend-offline",
    "Somewhere, offline",
    "photo-1464822759023-7dd9b3a7e7b5",
    "mountains nature escape",
    "Outdoor daydreams",
    240,
  ],
  [
    "city-hours",
    "After hours in the city",
    "photo-1519608487953-e999c86e7455",
    "night city sky mood",
    "Night thoughts",
    186,
  ],
  [
    "slow-morning",
    "The art of doing nothing",
    "photo-1441974231531-c6227db76b6e",
    "forest green quiet nature",
    "Slow living",
    312,
  ],
  [
    "coastal-club",
    "Out of office. Out of reach.",
    "photo-1476514525535-07fb3b4ae5f1",
    "lake mountains travel italy",
    "Elsewhere club",
    204,
  ],
  [
    "golden-state",
    "A softer kind of golden",
    "photo-1500534623283-312aade485b7",
    "sunset field summer nature",
    "Golden state",
    164,
  ],
  [
    "blue-hour",
    "Meet me at blue hour",
    "photo-1518837695005-2083093ee35b",
    "ocean sea waves beach blue",
    "Saltwater soul",
    279,
  ],
  [
    "flowers",
    "Stop and smell the flowers",
    "photo-1490750967868-88aa4486c946",
    "flowers garden pink spring",
    "Little moments",
    121,
  ],
  [
    "wanderer",
    "No plans, just a direction",
    "photo-1470770841072-f978cf4d019e",
    "landscape cabin lake adventure",
    "The wanderer",
    197,
  ],
].map(([id, title, img, tags, author, saves], i) => ({
  id: `sample-${id}`,
  title,
  url: photo(img),
  fallback: `assets/${id}.svg`,
  type: "image",
  tags,
  author,
  saves,
  sample: true,
  createdAt: i,
}));
const state = {
  view: "discover",
  filter: "all",
  query: "",
  sort: "curated",
  items: [],
  own: [],
  user: null,
  saved: new Set(Array.isArray(read("larpin-saved", [])) ? read("larpin-saved", []) : []),
};
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function persist() {
  try {
    localStorage.setItem("larpin-saved", JSON.stringify([...state.saved]));
  } catch {
    toast("Browser storage is unavailable. Saves will last for this visit.");
  }
}
const $ = (s) => document.querySelector(s);
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$("#year").textContent = new Date().getFullYear();
const modal = $("#modal");
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3800);
}
function openModal(title, body) {
  $("#modal-content").innerHTML =
    `<div class="modal-head"><h2>${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon("close")}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
async function api(path, options = {}) {
  if (!API_URL)
    throw new Error(
      "Accounts and uploads are not connected yet. The site owner needs to deploy the Worker and set API_URL.",
    );
  const r = await fetch(`${API_URL.replace(/\/$/, "")}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function updateAccount() {
  document.querySelectorAll(".avatar-button").forEach((b) => {
    b.textContent = state.user
      ? state.user.name.slice(0, 1).toUpperCase()
      : "?";
    if (state.user?.avatar)
      b.innerHTML = `<img src="${esc(safeURL(state.user.avatar))}" alt="">`;
    b.setAttribute(
      "aria-label",
      state.user ? `Account: ${state.user.name}` : "Sign in",
    );
  });
}
async function loadOwn() {
  if (!state.user) {
    state.own = [];
    return;
  }
  try {
    state.own = (await api("/uploads")).items.filter(
      (x) => x.purpose !== "avatar",
    );
    render();
  } catch (e) {
    toast(e.message);
  }
}
async function load() {
  let free = [];
  try {
    const r = await fetch("larp-stuff/manifest.json");
    if (r.ok)
      free = (await r.json()).map((x) => ({
        ...x,
        free: true,
        author: "Larpin studio",
        saves: 0,
      }));
  } catch {}
  state.items = [...free, ...inspiration];
  if (API_URL) {
    try {
      const [feed, me] = await Promise.all([api("/feed"), api("/me")]);
      state.items = [...feed.items, ...free, ...inspiration];
      state.user = me.user;
      updateAccount();
    } catch (e) {
      toast(e.message);
    }
  }
  render();
}
function render() {
  const titles = {
    discover: [
      "Find your next persona",
      "A collection of lives you could be living.",
    ],
    free: [
      "Good vibes. On the house.",
      "Free media from the Larpin studio, ready to make your own.",
    ],
    saved: [
      "Your little collection",
      "All the lives you want to come back to.",
    ],
    profile: [
      "Your corner of the internet",
      "Your persona, your creations, your story.",
    ],
  };
  $("#feed-title").innerHTML =
    `${esc(titles[state.view][0])}<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg></span>`;
  $("#feed-description").textContent = titles[state.view][1];
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.view === state.view),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === state.filter),
    );
  let items = (state.view === "profile" ? state.own : state.items).filter(
    (x) =>
      ((state.view !== "free" && state.filter !== "free") || x.free) &&
      (state.filter === "all" ||
        state.filter === "free" ||
        x.type === state.filter) &&
      (state.view !== "saved" || state.saved.has(x.id)) &&
      (state.view !== "profile" || x.userId === state.user?.id) &&
      `${x.title} ${x.tags || ""} ${x.author}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
  if (state.sort === "newest")
    items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  if (state.sort === "saved")
    items.sort((a, b) => Number(state.saved.has(b.id)) - Number(state.saved.has(a.id)));
  $("#profile-panel").hidden = state.view !== "profile";
  if (state.view === "profile")
    $("#profile-panel").innerHTML = state.user
      ? `<div class="profile-summary"><div class="profile-avatar">${state.user.avatar ? `<img src="${esc(safeURL(state.user.avatar))}" alt="">` : esc(state.user.name.slice(0, 1))}</div><div><h3>${esc(state.user.name)}</h3><p>${esc(state.user.bio || "A new persona, a new possibility.")}</p></div><button class="secondary" data-action="edit-profile">Edit profile</button></div>`
      : `<div class="profile-summary"><div><h3>Make yourself at home.</h3><p>Sign in to create your profile and share your larps.</p></div><button class="primary" data-action="account">Create an account</button></div>`;
  $("#gallery").innerHTML = items
    .map(
      (x, i) =>
        `<article class="media-card" style="animation-delay:${Math.min(i * 35, 250)}ms"><div class="media-cover" data-detail="${esc(x.id)}" tabindex="0" role="button" aria-label="View ${esc(x.title)}">${x.type === "video" ? `<video src="${esc(safeURL(x.displayURL || x.url))}" preload="metadata" muted playsinline${x.poster ? ` poster="${esc(safeURL(x.poster))}"` : ""}></video>` : `<img src="${esc(safeURL(x.displayURL || x.url))}" alt="${esc(x.title)}" loading="lazy">`}<div class="cover-shade"></div>${x.free ? '<span class="media-badge">✳ FREE LARP</span>' : x.sample ? '<span class="media-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg> INSPIRATION</span>' : ""}<button class="save-button ${state.saved.has(x.id) ? "saved" : ""}" data-save="${esc(x.id)}" aria-label="${state.saved.has(x.id) ? "Unsave" : "Save"} ${esc(x.title)}" aria-pressed="${state.saved.has(x.id)}">${icon("bookmark")}</button><div class="cover-bottom"><span class="play-pill">${icon(x.type === "video" ? "play" : "sparkles")}${x.type === "video" ? "Video" : "A whole mood"}</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg></span></div></div><div class="media-title">${esc(x.title)}${x.status && x.status !== "approved" ? `<span class="status-chip">${esc(x.status)}</span>` : ""}</div><div class="media-author"><span class="author-dot">${esc(x.author?.slice(0, 1) || "L")}</span>${esc(x.author || "Larpin")}${x.free ? '<span class="free-label">Free to use <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg></span>' : x.sample ? '<span class="free-label">Editorial pick</span>' : ""}</div></article>`,
    )
    .join("");
  $("#empty-state").hidden = !!items.length;
  $("#empty-state").innerHTML =
    `<h3>${state.query ? "No matches. New possibilities." : state.view === "free" ? "The free collection is growing." : state.view === "saved" ? "Keep a little inspiration." : state.view === "profile" ? "Your next persona starts here." : "A quiet corner, for now."}</h3><p>${state.view === "free" ? "The site owner can add images and videos to larp-stuff and rebuild to publish them." : state.view === "saved" ? "Tap a bookmark on any larp to save it here." : state.query ? "Try another keyword or a different filter." : "Share a larp or explore the image collection."}</p>`;
}
function toggleSave(id) {
  state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
  persist();
  render();
  toast(
    state.saved.has(id)
      ? "Saved to your little collection."
      : "Removed from saved.",
  );
}
function detail(id) {
  const x = [...state.items, ...state.own].find((x) => x.id === id);
  if (!x) return;
  openModal(
    x.title,
    `${x.type === "video" ? `<video class="detail-media" controls playsinline src="${esc(safeURL(x.displayURL || x.url))}"></video>` : `<img class="detail-media" src="${esc(safeURL(x.displayURL || x.url))}" alt="${esc(x.title)}">`}<p>By ${esc(x.author)}${x.sample ? " · Editorial inspiration from Unsplash, with original illustrated fallbacks if photos are unavailable. These are sample picks, not community submissions." : x.free ? " · Free studio media. See the usage terms before redistributing." : ""}</p><div class="detail-actions"><button class="secondary" data-save="${esc(id)}">${icon("bookmark")} ${state.saved.has(id) ? "Saved" : "Save for later"}</button><button class="primary" data-download="${esc(id)}">${icon("download")} Download</button></div>${!x.sample && !x.free ? `<p><button class="secondary" data-report="${esc(id)}">Report this media</button></p>` : ""}`,
  );
}
async function download(id) {
  const x = [...state.items, ...state.own].find((x) => x.id === id);
  try {
    const r = await fetch(safeURL(x.displayURL || x.url), {
      credentials:
        API_URL &&
        safeURL(x.displayURL || x.url).startsWith(
          API_URL.replace(/\/$/, "") + "/",
        )
          ? "include"
          : "omit",
    });
    if (!r.ok) throw Error();
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${x.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${x.type === "video" ? "mp4" : blob.type === "image/svg+xml" ? "svg" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("A little piece of another life, downloaded.");
  } catch {
    toast("Download unavailable. Try again or check your connection.");
  }
}
function account(mode = "login") {
  if (state.user) {
    openModal(
      "Your account",
      `<p>You’re signed in as <b>${esc(state.user.name)}</b>.</p><div class="detail-actions"><button class="primary" data-action="edit-profile">Edit profile</button><button class="secondary" data-action="logout">Sign out</button></div>`,
    );
    return;
  }
  openModal(
    "Make yourself at home.",
    `<p>A little corner of the internet to call your own.</p><div class="account-tabs"><button class="secondary ${mode === "login" ? "active" : ""}" data-account="login">Sign in</button><button class="secondary ${mode === "register" ? "active" : ""}" data-account="register">Create account</button></div>${!API_URL ? '<p class="form-note">Preview mode: browsing and local bookmarks work. Accounts need the Cloudflare backend to be connected.</p>' : ""}<form class="form" id="account-form" data-mode="${mode}">${mode === "register" ? '<label class="field">Display name<input name="name" autocomplete="nickname" required minlength="2" maxlength="40"></label>' : ""}<label class="field">Email<input type="email" name="email" autocomplete="email" required maxlength="254"></label><label class="field">Password<input type="password" name="password" autocomplete="${mode === "register" ? "new-password" : "current-password"}" required minlength="12" maxlength="128"></label>${mode === "register" ? '<label class="checkbox-label"><input type="checkbox" name="acceptedTerms" required>I am at least 13 (or the minimum age in my region), and agree to the Terms and Privacy Policy.</label>' : ""}<div class="form-error" role="alert"></div><button class="primary" type="submit">${mode === "register" ? 'Create my account <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg>' : 'Welcome back <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg>'}</button><span class="form-note">Use a unique password of at least 12 characters. Bookmarks are stored on this browser.</span></form>`,
  );
}
function editProfile() {
  if (!state.user) return account();
  openModal(
    "A little more you.",
    `<p>Your name and bio are public. Your email stays private.</p><form id="profile-form" class="form"><label class="field">Profile photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><span class="form-note">Optional. Photos receive the same safety check and review hold as uploads.</span></label><label class="field">Display name<input name="name" value="${esc(state.user.name)}" required minlength="2" maxlength="40"></label><label class="field">Bio<textarea name="bio" maxlength="240" placeholder="Who are you being today?">${esc(state.user.bio)}</textarea></label><div class="form-error" role="alert"></div><button class="primary">Save profile</button></form><p>Your initial appears until an approved photo is available.</p>`,
  );
}
function upload() {
  if (!state.user) {
    account("register");
    return;
  }
  openModal(
    "Share a little unreality.",
    `<p>Keep it creative. Keep it safe. Every submission is reviewed before it appears in the feed.</p><form class="form" id="upload-form"><label class="dropzone">${icon("upload")}<strong>Drop into a different life</strong><span>Images or videos · up to 20 MB</span><input type="file" name="media" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required></label><label class="field">Give it a name<input name="title" required maxlength="80" placeholder="e.g. Somewhere, offline"></label><label class="field">Tags<input name="tags" maxlength="150" placeholder="nature, quiet, main character"></label><label class="checkbox-label"><input type="checkbox" name="rights" required>I own this media or have permission to share it and allow personal downloads. It contains no sexual content, exploitation, or private information.</label><div class="form-note">Image submissions receive an AI safety check, then a minimum two-minute review hold. Videos are sent to the configured video AI provider; without it, they stay pending for manual review. A timer never overrides a failed or missing safety check.</div><div class="form-error" role="alert"></div><button class="primary">Submit for review <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7 M7 7h10v10"/></svg></button></form>`,
  );
}
function settings() {
  openModal(
    "Your space. Your settings.",
    `<p>Make yourself comfortable.</p><div class="form"><label class="field">Appearance<select id="theme-setting"><option value="light" ${document.documentElement.dataset.theme === "light" ? "selected" : ""}>Light — a fresh start</option><option value="dark" ${document.documentElement.dataset.theme === "dark" ? "selected" : ""}>Dark — after hours</option></select></label><button class="secondary" data-action="clear-saved">Clear bookmarks on this device</button>${state.user ? '<button class="secondary" data-action="export-data">Download my account data</button><button class="secondary" data-action="delete-account">Delete my account and uploads</button>' : '<button class="primary" data-action="account">Sign in to manage your profile</button>'}<span class="form-note">Theme and bookmarks stay on this device. Account settings are stored securely by the backend.</span></div>`,
  );
}
function theme(value) {
  document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem("larpin-theme", value);
  } catch {}
  document.querySelector('[data-action="theme"]').innerHTML = icon(
    value === "dark" ? "sun" : "moon",
  );
}
function legal(kind) {
  const contact = CONTACT_EMAIL
    ? `Contact <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a> for support, rights requests and appeals.`
    : "The operator must publish a real support and privacy contact before opening registration. This preview is not accepting account data.";
  const date = "October 12, 2026";
  const terms = `<p>Effective ${date}. These terms cover browsing, accounts, submissions and downloads on Larpin. ${contact}</p><h3>Who can use Larpin</h3><p>You must be at least 13 and meet your local minimum digital-consent age. Where parental consent is legally required, obtain it before registering. Larpin does not allow adult or sexual content, even between adults. Use an accurate email address, a unique password and a display name that does not impersonate someone else.</p><h3>What you may upload</h3><p>Submit only media you created or are authorized to distribute. No nudity, sexual activity, fetish content, sexualized minors, exploitation, graphic violence, hateful threats, harassment, doxxing, nonconsensual intimate media or deceptive impersonation. Do not use another person’s likeness in a misleading way. Do not upload sensitive personal documents. Fictional personas must not be used to defraud or harm people.</p><h3>Your ownership and our license</h3><p>You keep ownership of your uploads. You grant the site operator a nonexclusive license to store, scan, display, deliver and make them available for personal downloads while you keep them on the service. This permission does not transfer copyright or override a depicted person’s rights. Downloaders may use community submissions for lawful personal purposes; commercial use, resale, deceptive impersonation and redistribution require separate permission from the rights holder. Studio media in larp-stuff must be owned or licensed by the operator; inclusion in that folder does not extinguish third-party rights. Editorial sample images remain subject to their source license.</p><h3>Review is a safeguard, not a guarantee</h3><p>Images are checked by an AI moderation provider and held for at least two minutes after submission. Only submissions that pass the check may be published automatically. Flagged, unsupported or unavailable checks remain unpublished. Videos use the configured complete-video AI check, or stay pending for manual review if that provider is unavailable. No system can guarantee that every violation is detected. Report unsafe or infringing media; the operator may remove content, restrict accounts and preserve evidence when required by law. Do not attempt to bypass these checks.</p><h3>Reports, copyright and appeals</h3><p>Use the report control or the published contact to identify the content, explain the issue and include supporting information. Copyright complaints should identify the protected work, the offending URL, your contact details, and a good-faith statement that you are authorized to act. Submit an appeal with the upload identifier and relevant rights or context. The operator must review reports and appeals; restoration is not guaranteed.</p><h3>Deleting content and accounts</h3><p>You can delete your account and associated uploads in Settings. This removes them from active storage. Copies already downloaded by others cannot be recalled. Limited security and legal records may remain where necessary and lawful. Do not rely on Larpin as the sole archive of your media.</p><h3>Service limits and changes</h3><p>The service is provided as available, without a promise of uninterrupted access or fitness for a particular purpose, subject to rights that cannot lawfully be excluded. You are responsible for your use of downloaded media. The operator is responsible for its own legal obligations; these terms do not waive consumer rights. Material changes must be announced on the site before taking effect. The operator must identify its legal name, location and applicable dispute process before public launch.</p>`;
  const privacy = `<p>Effective ${date}. This notice explains the data used by Larpin’s provided implementation. The deploying operator is the data controller and must identify itself and publish a working contact before launch. ${contact}</p><h3>Data we collect</h3><p>When connected to the backend, registration sends your email, display name and password to the Cloudflare Worker. The server stores your normalized email, name, bio and a salted PBKDF2 password hash; it does not store the original password. A random session identifier is placed in an HttpOnly cookie; the database stores only its hash and expiration. Uploads include your file, title, tags, account identifier, submission time and moderation status. Reports contain the content identifier, reason and reporter identifier.</p><h3>Public and private information</h3><p>Your display name, bio and approved uploads are public. Email addresses, password hashes, session records, reports and pending or rejected files are not exposed through the public feed. Files you submit may still contain identifying metadata; remove location and device metadata before uploading. Never place private files in larp-stuff: that folder is publicly served by GitHub Pages.</p><h3>Why and where data is processed</h3><p>Account data is used to authenticate you, manage your profile, process uploads and address abuse. Cloudflare processes requests and stores the account database in D1 and media in R2. GitHub Pages serves the public site and studio files. Images are sent to the configured AI moderation provider (OpenAI in this implementation) for safety classification before publication. That provider’s retention and international-transfer terms must be reviewed and disclosed by the operator before activation. When the optional Gemini video provider is enabled, the complete submitted video and audio is sent to Google for safety classification. Without that provider, videos remain private for manual review; an image-only check is never used to approve a video. The operator must disclose Google's processing and retention terms before enabling that integration.</p><h3>Local storage, cookies and external requests</h3><p>Theme and bookmarked media IDs are stored in your browser’s local storage. They are not synchronized to your account. The authentication cookie lasts up to seven days and is necessary for signed-in features. This implementation includes no analytics or advertising trackers. Editorial preview images load from Unsplash and fonts are bundled locally; Unsplash receives your IP address and ordinary browser request information under its privacy notice; the bundled fonts make no external requests. The operator can self-host these assets before launch.</p><h3>Retention and deletion</h3><p>Account and upload records remain until you delete your account or the operator removes them. Account deletion removes associated active files, database records, sessions and reports you submitted. Sessions expire after seven days and expired records are cleaned during authentication. Pending and rejected media is deleted after 30 days by the scheduled Worker; operators should review reports promptly. Cloudflare backups or infrastructure logs may have separate retention outside this application’s immediate control, which the operator must document. We cannot erase media downloaded by other people.</p><h3>Your choices and rights</h3><p>You can edit your public profile, export your account data and delete your account in Settings. You can clear bookmarks and change theme without an account. Depending on your jurisdiction, you may have rights to access, correction, deletion, restriction, portability and objection, or to complain to a supervisory authority. Use the published contact for requests not covered by these controls. Identity checks may be needed to protect your data; do not send a password.</p><h3>Security and children</h3><p>Passwords are hashed and sessions are checked server-side. HTTPS, restricted CORS and private pending media reduce exposure, but no service can promise perfect security. This service is not intended for children under 13 or below the applicable local consent age. The operator must remove accounts it learns are ineligible and provide a route for guardians to contact it.</p><h3>Before a public launch</h3><p>The operator must fill in its identity and contact, provider agreements and retention schedule, assess the legal basis for processing and international transfers, and update this notice when the deployed behavior differs. These details are deployment requirements, not facts this preview can invent.</p>`;
  openModal(
    kind === "terms" ? "Terms of service" : "Privacy, in plain sight.",
    `<div class="legal-body">${kind === "terms" ? terms : privacy}</div>`,
  );
}
document.addEventListener("click", async (e) => {
  const save = e.target.closest("[data-save]");
  if (save) {
    e.stopPropagation();
    toggleSave(save.dataset.save);
    return;
  }
  const dl = e.target.closest("[data-download]");
  if (dl) return download(dl.dataset.download);
  const d = e.target.closest("[data-detail]");
  if (d) return detail(d.dataset.detail);
  const v = e.target.closest("[data-view]");
  if (v) {
    state.view = v.dataset.view;
    state.filter = "all";
    render();
    if (state.view === "profile") loadOwn();
    return;
  }
  const f = e.target.closest("[data-filter]");
  if (f) {
    state.filter = f.dataset.filter;
    render();
    return;
  }
  const tab = e.target.closest("[data-account]");
  if (tab) return account(tab.dataset.account);
  const report = e.target.closest("[data-report]");
  if (report) {
    if (!state.user) return account();
    openModal(
      "Help keep this space safe.",
      `<form class="form" id="report-form" data-id="${esc(report.dataset.report)}"><label class="field">What should we review?<textarea name="reason" required minlength="10" maxlength="1000"></textarea></label><div class="form-error" role="alert"></div><button class="primary">Submit report</button></form>`,
    );
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  try {
    switch (action) {
      case "close":
        modal.close();
        break;
      case "theme":
        theme(
          document.documentElement.dataset.theme === "light" ? "dark" : "light",
        );
        break;
      case "account":
        account();
        break;
      case "upload":
        upload();
        break;
      case "settings":
        settings();
        break;
      case "edit-profile":
        editProfile();
        break;
      case "terms":
      case "privacy":
        legal(action);
        break;
      case "clear-saved":
        state.saved.clear();
        persist();
        render();
        toast("Your bookmarks have been cleared.");
        break;
      case "logout":
        await api("/logout", { method: "POST" });
        state.user = null;
        state.own = [];
        updateAccount();
        modal.close();
        render();
        toast("Signed out. See you in another life.");
        break;
      case "export-data": {
        const data = await api("/account/export");
        const u = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = u;
        a.download = "larpin-account.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 2000);
        break;
      }
      case "delete-account":
        openModal(
          "Leave no trace.",
          `<p>This permanently removes your account and all associated uploads from active storage. Downloaded copies cannot be recalled.</p><form class="form" id="delete-form"><label class="field">Confirm with your password<input name="password" type="password" required autocomplete="current-password"></label><div class="form-error" role="alert"></div><button class="primary">Permanently delete my account</button></form>`,
        );
        break;
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (
    ![
      "account-form",
      "profile-form",
      "upload-form",
      "report-form",
      "delete-form",
    ].includes(form.id)
  )
    return;
  e.preventDefault();
  const b = form.querySelector('button[type="submit"],button.primary');
  b.disabled = true;
  form.querySelector(".form-error").textContent = "";
  const fd = new FormData(form);
  try {
    if (form.id === "account-form") {
      const data = await api(`/${form.dataset.mode}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(fd)),
      });
      state.user = data.user;
      updateAccount();
      await loadOwn();
      modal.close();
      toast("Welcome to your little escape.");
    } else if (form.id === "profile-form") {
      state.user = (
        await api("/profile", {
          method: "PATCH",
          body: JSON.stringify({ name: fd.get("name"), bio: fd.get("bio") }),
        })
      ).user;
      updateAccount();
      const photo = fd.get("photo");
      if (photo?.size) {
        const upload = new FormData();
        upload.set("media", photo);
        const result = await api("/avatar", { method: "POST", body: upload });
        toast(
          result.status === "rejected"
            ? "Name and bio saved. The photo was rejected by the safety check."
            : "Profile saved. Your photo is pending safety review.",
        );
      } else toast("Profile updated.");
      modal.close();
    } else if (form.id === "upload-form") {
      const file = fd.get("media");
      if (file.size > 20 * 1024 * 1024)
        throw Error("Please choose a file under 20 MB.");
      const result = await api("/uploads", { method: "POST", body: fd });
      await loadOwn();
      modal.close();
      toast(
        result.status === "rejected"
          ? "This submission was rejected by the safety check."
          : "Submitted. Your larp is private while it is reviewed.",
      );
    } else if (form.id === "report-form") {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          mediaId: form.dataset.id,
          reason: fd.get("reason"),
        }),
      });
      modal.close();
      toast("Report received. Thank you for looking out for everyone.");
    } else {
      await api("/account", {
        method: "DELETE",
        body: JSON.stringify({ password: fd.get("password") }),
      });
      state.user = null;
      state.own = [];
      updateAccount();
      modal.close();
      toast("Your account and uploads were deleted.");
    }
    render();
  } catch (err) {
    form.querySelector(".form-error").textContent = err.message;
  } finally {
    b.disabled = false;
  }
});
$("#search").addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});
$("#sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "theme-setting") theme(e.target.value);
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !modal.open &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $("#search").focus();
  }
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("[data-detail]")
  ) {
    e.preventDefault();
    detail(e.target.dataset.detail);
  }
});
document.querySelector(".brand").addEventListener("click", (e) => {
  e.preventDefault();
  state.view = "discover";
  state.filter = "all";
  state.query = "";
  $("#search").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
theme(document.documentElement.dataset.theme);
load();

if (API_URL)
  setInterval(async () => {
    if (document.hidden) return;
    try {
      const [feed, me] = await Promise.all([api("/feed"), api("/me")]);
      state.user = me.user;
      updateAccount();
      state.items = [
        ...feed.items,
        ...state.items.filter((x) => x.free || x.sample),
      ];
      if (state.view === "profile") await loadOwn();
      else render();
    } catch {}
  }, 30000);

document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName !== "IMG") return;
    const x = [...state.items, ...state.own].find(
      (x) => e.target.src === safeURL(x.url),
    );
    if (x?.fallback && !x.displayURL) {
      x.displayURL = x.fallback;
      e.target.src = x.fallback;
    }
  },
  true,
);
