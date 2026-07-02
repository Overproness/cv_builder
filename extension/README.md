# CV Builder Chrome Extension

Manifest V3 extension that detects job postings on the web, dispatches
tailored-resume (and optional cover letter) generation to the CV Builder
backend, and lets you download the result — without leaving the job page.

## How it's wired together

- **`background/`** — the service worker. Owns all authentication state and
  every network call to the backend (`/api/extension/*`). Content scripts
  and the popup never call `fetch()` directly; they message the background
  worker via `chrome.runtime.sendMessage`.
- **`content/`** — runs on job board pages. Detects job descriptions (via
  `content/detectors/site-detectors.js` for known boards, falling back to
  `content/detectors/generic-heuristic.js`), injects the floating "Create
  tailored resume" button, and messages the background worker on click.
- **`popup/`** — the toolbar popup UI: login, manual paste-and-generate
  (with a cover-letter checkbox and Master CV picker), and job history with
  download / open-in-tab actions.

See `background/background.js` for the full message-action catalog
(`START_LOGIN`, `DISPATCH_FROM_POPUP`, `GET_JOBS`, `DOWNLOAD_PDF`, etc).

## One-time setup

### 1. Server environment variables

The backend needs two new variables (see the repo root `.env.example`):

```
EXTENSION_JWT_SECRET=<64 hex chars — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
EXTENSION_ID=ojdipgddfbbdhgkeddnmbcfdlpakfcbh
```

`EXTENSION_ID` must exactly match the ID Chrome assigns this extension,
which is derived from the public key pinned in `manifest.json`'s `"key"`
field. The value above matches the key already committed in this repo, so
if you haven't regenerated the key pair, you can use it as-is for local dev.

### 2. Regenerating the dev key pair (optional)

The `"key"` field in `manifest.json` is a **public** key — safe to commit,
and is what makes the extension's ID stable across every `--load-unpacked`
reload (without it, Chrome assigns a new random ID each time, which would
break the OAuth redirect-URI check in `/extension/authorize`). To generate
your own:

```js
// node -e "...", or save as a script and run with `node`
const crypto = require("crypto");
const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const der = publicKey.export({ type: "spki", format: "der" });
console.log("key (put in manifest.json):", der.toString("base64"));

const hash = crypto.createHash("sha256").update(der).digest();
let id = "";
for (const byte of hash.subarray(0, 16)) {
  id += String.fromCharCode(97 + ((byte >> 4) & 0xf)) + String.fromCharCode(97 + (byte & 0xf));
}
console.log("EXTENSION_ID:", id);
```

The private key is never needed again after this — it's only required to
*sign* a packaged `.crx`, which isn't part of the `--load-unpacked` dev flow
or Chrome Web Store publishing (the Web Store manages its own signing key).

### 3. Point the extension at your server

`background/config.js` exports `WEB_APP_ORIGIN`, defaulted to
`http://localhost:3000`. `manifest.json`'s `host_permissions` and
`content_scripts.exclude_matches` currently list `http://localhost:3000/*`
and a placeholder `https://cvbuilder.example.com/*` — **before packaging for
real users, replace the placeholder with your actual production domain in
both `manifest.json` and `WEB_APP_ORIGIN`.**

### 4. Load the extension

1. Run the Next.js app locally (`npm run dev`) with the env vars above set.
2. Chrome → `chrome://extensions` → enable Developer mode → "Load unpacked"
   → select this `extension/` directory.
3. Click the toolbar icon → "Log in to CV Builder" → sign in with your
   normal website account.

## Testing without spending Gemini quota

The popup's paste-and-generate form has a "Fake mode" checkbox. When
checked, dispatch goes to `POST /api/extension/dispatch?fake=true`, which
the server only honors when `NODE_ENV !== "production"` (see
`src/app/api/extension/dispatch/route.js` and
`src/lib/extensionJobProcessor.js`'s `processFakeExtensionJob`). It skips
the real Gemini/LaTeX-compile calls, waits a couple of seconds, and returns
a small generated fixture PDF — enough to exercise the full
queued → processing → compiling → complete → download/open-in-tab path in
seconds.

## Known platform constraints worth knowing

- **Badge updates while the popup is closed are not instant.** Chrome's
  `chrome.alarms` API cannot fire more often than roughly once a minute in a
  packed extension, so the background worker's badge-refresh poll runs on
  that ~1-minute floor. While the popup is *open*, it polls every 3 seconds
  directly (its page context stays alive as long as it's visible), so
  active use feels responsive — it's only the "walked away, came back"
  badge-notification path that has up to ~1 minute of latency.
- **Revoking extension access from the website's Settings page is not
  instant either.** Access tokens are short-lived (15 minutes); revocation
  takes effect the next time the extension refreshes one, not immediately.
