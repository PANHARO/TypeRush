# TypeRush installable web app

This companion web app ports the C++/Qt rules to a responsive, offline-capable PWA.
The original desktop source remains usable. There are no npm runtime dependencies,
remote fonts, analytics, servers, online accounts, or external asset requests.

## Run locally

With Node.js 22 or later, from this directory:

```sh
npm test
npm run build
npm start
```

Open `http://127.0.0.1:4173`. Build output is `web/dist`. Do not open `index.html`
through `file://`: service workers and Web Crypto need HTTPS or localhost.
The build copies the shared `../assets/words.txt`, so both app versions use the same words.

## Install and play offline

Host `dist` on HTTPS. The manifest, asset paths, and service worker use relative URLs,
including when hosted at `/TypeRush/` on GitHub Pages. Wait for **Offline ready**
before disconnecting. The first successful visit needs internet to cache the app.

- iPhone/iPad: open in Safari → Share → Add to Home Screen. Enable Open as Web App if shown.
- Android: use Chrome's Install app or Add to Home screen menu.
- Windows: install using Chrome or Edge's address bar/menu.
- Mac: Safari File → Add to Dock (macOS Sonoma+) or Chrome's install menu.

The in-app Install TypeRush dialog includes these steps and offers the native browser
install prompt when supported. No store submission is needed. Actual install UI varies
by browser; test Safari/iOS and a real Android keyboard before a broad release.

## Profiles, scores, and backup recovery

Guests can play Speed Test and Survival, but guest rounds do not save. Create a local
name-and-PIN profile before a round to save its result. Profiles work fully offline;
an active local session stays signed in until sign-out. Sessions are local to the
browser/app's storage context. New device/browser contexts require a new local profile
and a backup import. A PIN is an in-app gate, not encryption or online authentication.
It is salted and derived with PBKDF2-SHA-256; raw PINs are never saved or exported.
There is no remote PIN recovery. Forgetting a PIN requires creating another profile
and restoring a previously exported score backup.

IndexedDB keeps the top 10 Speed scores per duration and top 10 Survival results by
time, separated by profile. Only completed rounds save. Reinstalling or clearing
browser/app data can remove profiles and scores; local storage is never a backup.

High Scores → **Export backup** downloads a versioned JSON file for the current profile.
Keep it outside the app, for example Files, Downloads, or your personal cloud drive.
The reminder reappears after new high scores. An export starts a download; the app
cannot verify that the user kept the downloaded file. Backups contain score data and
the profile name, not the PIN, session, or credential hashes.

To restore, create/sign into a local profile → High Scores → **Import backup** →
review the source and destination → **Merge scores**. The original profile name need
not match. Imports validate the schema, numeric values, dates, size, and version before
writing, skip duplicate score IDs, and retain the best 10 for each category.
Restore recovers only the scores included in that file; there is no cloud sync.
The C++ `data/scores.txt` format is separate and is not imported by this version.

## Updates without losing scores

`typerush-player-data` IndexedDB is separate from versioned `typerush-app-*` shell
caches. Builds derive the shell cache version from its content. A new worker waits
until **Update now** is selected (disabled during a round). Activation deletes only
old TypeRush shell caches and never deletes the player database. Keep this database
name and use explicit migrations if the database version changes in future releases.
The stable manifest ID, origin, and deployment path must remain the same to retain
the same installation/storage identity. Changing domains or paths may need backup transfer.

## Publish with GitHub Pages

The repository workflow tests pull requests. The initial `codex/typerush-installable-web`
branch and subsequent pushes to `master` test/build and publish `web/dist` using GitHub
Pages. The initial branch can therefore be reviewed while the live web version is usable.
A repository administrator must set
Settings → Pages → Build and deployment → Source to **GitHub Actions** once.
The expected default URL is `https://panharo.github.io/TypeRush/`. Use the actual URL returned by the
deployment. The workflow supports manual dispatch on the initial branch or `master` as well.

The portable `dist` folder can also be hosted on another HTTPS static host.
For Vercel or Cloudflare Pages, use build command `npm --prefix web run build`,
output directory `web/dist`, and no framework preset. No environment secrets are needed.

## Verification

`npm test` checks desktop-equivalent scoring, timing, background expiry, duration
choices, survival caps/penalties, backup validation/ranking/deduplication, and the
service-worker update lifecycle at a project subpath. Before releasing, also verify
profile creation/sign-in, score separation, offline reload, backup download/restore,
storage failure, responsive layout, and update retention in supported browsers.
