# Larpin

A polished, responsive gallery for alternate personas. GitHub Pages hosts the public frontend and owner-curated `larp-stuff` collection. A Cloudflare Worker provides accounts, profiles, private submissions, moderation, reporting, data export and account deletion using D1 and R2.

## Run locally

Node 24 recommended. From the existing checkout (each cloud task is isolated; no worktree needed):

```sh
npm ci
npm run dev
```

The frontend listens on port 5173. Browsing, search, filters, light/dark appearance, downloads, legal dialogs and local bookmarks work without backend credentials. The initial cards are labeled editorial inspiration from Unsplash, not invented users or submissions. The Free larp collection is empty until you add your own media. No fake authentication or moderation success is shown in preview mode.

```sh
npm test
npm run build
```

`dist/` is the Pages artifact. The app uses relative asset paths, so it supports project Pages URLs such as `https://user.github.io/larpin/`. Enable **GitHub Pages → Source → GitHub Actions** and push these files to `main`. The included workflow builds and deploys the site; no deployment has been made by this task.

## Cloudflare Workers static-site deployment

For a Cloudflare Git-connected Worker named `larpin`, use the repository root as the root directory and `npx wrangler deploy` as the deploy command (or `npm run deploy`). The root `wrangler.jsonc` runs `npm run build` automatically and uploads **only `dist/`**. A separate dashboard build command is optional. Never set the assets directory to `.`: that includes dependencies, backend source and other files that are not website assets.

The root configuration deploys the public website only. The account/moderation API remains a separate Worker configured in `worker/wrangler.toml`; deploy that with `npm run worker:deploy` after setting up its resources and secrets below. A successful static-site deployment does not enable live accounts by itself.

## Free studio media

Put safe, authorized JPG, PNG, WebP, MP4 or WebM files in `larp-stuff/`. Filenames become titles and subfolders are supported. `npm run build` automatically generates `larp-stuff/manifest.json`. Pushing new files to main triggers the Pages build. During development restart the dev server after adding files. All files in this directory are public and operator-reviewed; they do not go through submission moderation. Do not store confidential material or unlicensed images there.

## Cloudflare backend

1. Authenticate Wrangler with your own Cloudflare account (`npx wrangler login`). Never commit keys or send them in chat.
2. Run `npx wrangler d1 create larpin` and `npx wrangler r2 bucket create larpin-media`.
3. Put the returned D1 ID into `worker/wrangler.toml`. Set `SITE_ORIGIN` to the frontend's exact origin, with **no path** or trailing slash (for project Pages this is `https://user.github.io`). Set `SUPPORT_EMAIL` to your real monitored inbox.
4. Initialize production D1: `npx wrangler d1 execute larpin --remote --config worker/wrangler.toml --file worker/schema.sql`.
5. Set `MODERATION_API_KEY` using `npx wrangler secret put MODERATION_API_KEY --config worker/wrangler.toml`. This is an OpenAI API key used only server-side for `omni-moderation-latest`. Set a strong random `ADMIN_TOKEN` using the same secret command. Never place either in `config.js`.
6. Run `npm run worker:deploy` and set `API_URL` in `config.js` to the deployed HTTPS Worker URL. Set `CONTACT_EMAIL` to the same real contact. Rebuild/redeploy Pages.

To run the local D1/R2 smoke test, initialize the local schema, then start Wrangler with `--var SITE_ORIGIN:http://localhost:5173 --var SUPPORT_EMAIL:test@example.invalid --port 8787` and run `npm run test:api`. This creates and deletes a test account and verifies that a missing moderation key cannot publish an image. Leave real AI keys unset for this check.

For local backend development, run `npx wrangler d1 execute larpin --local --config worker/wrangler.toml --file worker/schema.sql`, then `npm run worker:dev`. Put local secrets in ignored `worker/.dev.vars` and use the corresponding frontend origin. Real session cookies use HTTPS, Secure and SameSite=None; use HTTPS for end-to-end browser authentication tests. Do not weaken production cookie settings.

**Cookie hosting:** GitHub Pages and workers.dev are separate sites. Browsers that block third-party cookies will prevent sessions across those domains. For dependable production accounts, use custom domains on the same registrable site, such as `www.larpin.example` (Pages) and `api.larpin.example` (Worker). Keep `SITE_ORIGIN` exact. Emails are not verified and password recovery is not yet implemented; do not market verified identities or open a broad public launch before adding a recovery/verification workflow.

## Submission behavior

Uploads are limited to 20 MB and allow raster images and MP4/WebM videos. The backend checks file signatures and declared MIME types; active HTML/SVG is not accepted. Uploads are stored in a private R2 bucket, without an R2 public URL. Only approved objects are served publicly; submitters can view their own pending media. Avatar uploads use the same image review pipeline.

Images are sent directly to OpenAI's moderation endpoint as encoded image input. Any returned flag prevents publication. A missing key, provider failure or malformed response leaves the submission private. Passing images stay pending for at least 120 seconds; the once-per-minute scheduled Worker normally approves them at about 2–3 minutes. New frontend feed/profile data refreshes every 30 seconds. This is a safety classification, not a guarantee against every unsafe image.

**Video moderation:** Set `VIDEO_MODERATION_API_KEY` with Wrangler secrets to enable the Gemini adapter. It sends the complete video (including audio) to `gemini-2.5-flash` for structured safety classification. `VIDEO_MODERATION_MODEL` can override the model after compatibility validation. Missing credentials default to manual review. Provider errors or incomplete results remain private; flagged content is rejected. A passing result becomes eligible for the same two-minute hold. AI video interpretation can miss brief events; evaluate a representative safety test corpus before public auto-publication. This adapter has mocked-response tests but has not made a paid live AI request. For manual review, inspect the entire clip before approving.

Pending/rejected files are deleted after 30 days by the scheduled job. Approved uploads remain until account deletion or operator removal. Rate limits are D1-backed: 20 authentication requests/hour/IP, 10 uploads/hour/account and 10 reports/hour/account. They are basic abuse controls; add Cloudflare managed protections, quotas and budget alerts before a large public launch.

## Operator review

Use D1 queries to inspect private pending uploads and reports:

```sh
npx wrangler d1 execute larpin --remote --config worker/wrangler.toml --command "SELECT id,user_id,title,type,safety,created_at FROM media WHERE status='pending' ORDER BY created_at"
npx wrangler d1 execute larpin --remote --config worker/wrangler.toml --command "SELECT id,media_id,reason,created_at FROM reports ORDER BY created_at DESC"
```

The authenticated `GET /admin/queue` lists pending/rejected submissions and reports. `GET /admin/media/<id>` streams private media for full review. Send `Authorization: Bearer <ADMIN_TOKEN>` from a trusted terminal or admin tool, never the public frontend. `POST /admin/retry` with JSON `{ "id": "..." }` reruns a pending image or video check. `POST /admin/review` accepts `{ "id": "...", "action": "approve", "reviewed": true }` or `{ "id": "...", "action": "reject" }`. Manual approval requires the minimum hold and explicit operator attestation; review safety and rights first. Rejecting an already approved item immediately removes access through the API. A dedicated admin dashboard is a future enhancement.

## Privacy and legal launch requirements

The site includes substantive policies tied to this implementation: public/private data, moderation disclosure, user media licenses, reporting and appeals, minors, downloaded copies, session retention, account export/deletion, provider transfers and limitations. They are not a substitute for filling in your real operator details. Before public registration, identify the legal operator and contact, review the wording with regard to your jurisdiction, document Cloudflare/provider retention and processing arrangements and establish report/appeal handling. The backend keeps registration closed while `SUPPORT_EMAIL` is empty.

Theme and bookmarks are local-only. No analytics are included. Preview photos load from Unsplash with original local illustrated fallbacks and locally bundled open-source fonts, disclosed in the notice; self-host them if desired. Passwords use salted PBKDF2-SHA256 (100,000 iterations, the Workers WebCrypto limit), sessions use random tokens with hashed database storage and seven-day Secure/HttpOnly cookies. Monitor platform limits and revisit the authentication design before scaling. Account deletion removes its active database records and R2 uploads; infrastructure backup/log retention is controlled by the operator's providers.
