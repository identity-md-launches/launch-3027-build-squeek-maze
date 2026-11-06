# Squeek Maze

A complete, single-page canvas arcade game for Squeekchain. Guide Squeektoshi through 50 seeded mazes, collect peanuts, and outsmart up to four BFS-controlled snakes.

## Run locally

Requires Node.js 20+ and npm. No backend, account, API key, wallet, or runtime package is required.

```sh
npm ci
npm run dev
```

Open `http://localhost:4173`. The source preview serves `public/` assets at the same relative URLs used by the production export.

## Build and preview

```sh
npm run build
npm run preview
```

Open `http://localhost:4173` after stopping the source preview. To choose another port, run `node scripts/serve.mjs dist 4174`.

The finished static site is **`dist/index.html`** and the files beside it. The build uses Node's standard library, copies the vanilla JavaScript modules and CSS into `dist/assets/`, copies local assets, and rewrites the HTML's source URLs. All asset URLs are relative. Upload the entire `dist/` directory to a static host; a gateway subpath works too. Navigation uses `#leaderboard` and needs no server rewrites. Serve over HTTP(S), since native JavaScript modules do not work reliably through `file://`.

The export is delivered alongside source and the npm lockfile. It does not need to be rebuilt to play. Build tools and browser dependencies are development dependencies only.

## Play

- Move with **arrow keys**, **WASD**, **swipes on the maze**, or the mobile direction buttons. Turns are buffered for the next open corridor. Reversing direction works immediately.
- Eat every peanut to advance. Peanuts award 10 points, glowing power beans 50, and a powered snake 200. Clearing a level awards `level × 100`.
- You have **three lives for the entire run**. Losing a life keeps collected peanuts and score. A short recovery gives you time to get moving again.
- Power beans last 5 seconds on levels 1–30, 3.5 seconds on 31–40, and 3 seconds on 41–50. Frightened snakes flee and return three seconds after being eaten.
- Press **P** or **Escape** to pause. Instructions and leaderboard navigation pause a live run. Returning to a paused run lets you resume; switching away from the page also pauses play.
- Complete level 50 to win. On game over or victory, enter a name and save your score. The leaderboard retains the top ten runs on **this browser**, not across devices. “Best” is the highest saved score.
- Sound is off initially. Enable it with the speaker control. “Pause animation” in the footer stops decorative motion; reduced-motion preferences disable it initially. Essential game movement remains active.

| Levels | Snakes | Maze character | Beans |
| --- | ---: | --- | ---: |
| 1–10 | 1 | More connected escape routes | 4 |
| 11–20 | 2 | Fewer shortcuts | 4 |
| 21–30 | 3 | Tighter corridors | 4 |
| 31–40 | 4 | Complex routes, faster pursuit | 2 |
| 41–50 | 4 | Fewest shortcuts, fastest pursuit | 1 |

Each 21×21 maze uses recursive backtracking, a deterministic random generator seeded by level number, and seeded removal of separating walls. All 50 layouts are distinct. Snake speed increases each level. The simulation uses small delta-time steps and preserves fractional movement at tile boundaries.

## Live Squeektoshi

The game requests `https://api.squeekchain.com/v1/status` immediately and every 10 seconds, with a six-second timeout. The observed API exposes wheel movement under `measurement`, so the adapter checks `freshness`, `observedAt`, `staleAfterSeconds`, and `rpmMilli`. Fresh positive rotation means **RUNNING** and multiplies player movement speed by **1.1**; fresh zero rotation means **SLEEPING**. Stale, invalid, or unreachable data displays “Live status unavailable” and uses standard speed. The game continues without the API.

Visibility changes refresh status before retaining a boost. Restoring a cached browser page also restarts polling. No telemetry or player names are sent by this app. The status endpoint receives the normal public HTTPS request; names and scores only use localStorage key `squeek-maze.scores.v1`.

## Validate

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
node scripts/check-export.mjs
```

JavaScript is checked strictly through TypeScript `checkJs` and JSDoc, with no transpilation. The browser suite serves the real export at `/preview/` within one foreground process, checks interactions and accessibility, saves screenshots under `artifacts/screenshots/`, and closes its preview and browser when finished. Optional `PLAYWRIGHT_MODULE`, `AXE_MODULE`, and `BROWSER_EXECUTABLE` overrides support externally installed checking tools. Normal installs do not need them.

The optional `npm run art` command redraws the included favicon and 1200×630 social card from the same canvas art functions. It requires the Playwright browser. Ordinary production builds use the finished images already in `public/`.

### Actual checks in this delivery

Checks ran on 6 November 2026:

| Check | Result |
| --- | --- |
| `npm run build` | Passed; complete relative-URL static export |
| `npm run typecheck` | Passed, strict `tsc --noEmit` with `checkJs` |
| `npm test` | 18 tests passed, including all 50 mazes, scoring, BFS pursuit, collisions, power expiration, storage, and exact movement at 30/60/120 fps |
| `npm run test:browser` | Passed; Chromium 154, production subpath, 320/390/850/1440 widths, primary interactions, API failure handling, and enlarged text |
| Axe checks | Zero reported WCAG A/AA violations in the five inspected menu, pause, instructions, results, and leaderboard states |
| Pinned `taste.mjs --out test/scratch/taste --offline` | 16/16 checks passed; no overflow, text collisions, missing local files, or script errors |
| Menu overlay contrast sampling | At least 7.15:1 across the sampled description/meta text; heading at least 10.69:1 |
| Source preview | Browser smoke check passed; source modules, CSS, font, and Play were available |
| Direct public status request | HTTP 200; actual response parsed successfully, with a CORS `*` header |

See [the six-domain review and limitations](artifacts/validation.md), [machine-readable browser results](artifacts/browser-results.json), and [the export/size check](artifacts/export-check.json).

The built-in browser connector could not launch because of an operating-system socket-path limit. Validation used local Playwright and the available headless Chromium instead. The unmocked Chromium status request received no HTTP response; the app correctly showed unavailable and disabled the boost. Direct HTTPS access succeeded, and deterministic API-shaped responses verified running/sleeping behavior. Neither observation establishes service uptime or end-user connectivity.

No physical mobile device, human screen-reader session, native 200% browser zoom, or audible sound evaluation was performed. The 200% check enlarges root text in CSS. The all-level solver isolates collection/progression from collisions; collision and frame timing have separate tests. Rare later-level browser screens use controlled engine fixtures. These are worker-side results, not independent certification.

## Source map and design

- `src/maze.js`: seeded generation, BFS distances, difficulty bands.
- `src/engine.js`: movement, collisions, power, scoring, and game phases.
- `src/draw.js`: all hamster, snake, peanut, wall, wheel, and icon canvas drawings.
- `src/main.js`: controls, DOM screens, navigation, live status, and animation loop.
- `src/storage.js`, `src/status.js`, `src/audio.js`: local scores, public status adapter, and synthesized sounds.
- `src/styles.css`: tokens, component styles, responsive behavior, and motion preferences.
- `DESIGN.md`: the final implemented visual system and reuse guidance.

Nunito is self-hosted under the SIL Open Font License; see `public/FONT-LICENSE.txt` (also included in the export). Design review follows the pinned Better Interface and design-critic references. Attribution and included guidance licenses are retained in `artifacts/NOTICE.md` and `artifacts/design-guidance-LICENSE.txt`.

Generated dependencies and caches are excluded at every nesting level. `dist/` stays included. The explicit path budget is in [submission-budget.md](artifacts/submission-budget.md).
