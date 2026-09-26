# beluga implementation plan

## Context

**beluga is an installable web app for Android (Chrome) that warns blind and low-vision pedestrians about obstacles with directional sounds, and turns lasting hazards into a ranked fix-first dashboard for the city.** It is built for Hack the Hill III (uOttawa, Ottawa). Phases run in parallel tracks (see "Tracks & timeline"); inside a track, build them in order. Each phase ends in something demonstrable, so the project is always submittable.

### The product in one paragraph

The user wears the phone on a chest mount (camera forward) and bone-conduction earbuds (ears stay open to traffic). beluga runs a WebXR augmented-reality session in Chrome that uses ARCore depth to measure distance to everything in front of the user. It stays silent until something enters a narrow walking corridor, then plays a short sound placed on the hazard's side that repeats faster as the user gets closer. Head-height obstacles and drop-offs (platform edges, stairs down) have their own distinct sounds. A tap on the Ask button sends one camera frame to Gemini, and the answer is spoken with an ElevenLabs voice from the direction of the object described. When the user meets a lasting civic hazard (a scooter left across the sidewalk, a construction barrier, a head-height sign), Gemini decides whether to report it; with consent, an anonymous, coarsened report is stored in Tiger Data, where continuous aggregates drive a live fix-first map and ranked queue for the City of Ottawa and OC Transpo.

### Non-negotiable rules

1. **The name is "beluga", always lowercase**, in the UI, page titles, manifest, spoken lines, README and database names.
2. **Platform:** Android + Chrome only, delivered as an installable web app over HTTPS. No iOS, no native app.
3. **The safety loop never touches the network.** Depth → hazard → sound runs entirely on the phone. Gemini, ElevenLabs and Tiger Data may fail or be slow without silencing any warning.
4. **Warnings are decided by depth, not by labels.** The object detector and Gemini only change which sound or words are used.
5. **No image ever reaches the database.** Frames go only to Gemini, are not stored, and never leave the backend in any other direction.
6. **Reporting is off until the user turns it on.** Locations are rounded to \~100 m on the phone and again on the backend.
7. **Never tell the user it is safe to cross a road**, anywhere, in any string, prompt or spoken line.
8. **API keys live only on the backend.** The phone app never holds a Gemini, ElevenLabs or database secret.
9. **All simulated data is labelled as simulated**, in the database, the dashboard and the README.
10. **beluga works alongside the white cane or guide dog.** Onboarding says so aloud; the landing page says it is a research prototype and not a medical device.

### Sponsor prizes this build must clearly satisfy

| Prize | What must be visible in the product |
| --- | --- |
| Best Use of Tiger Data | Hypertable of events; four continuous aggregates (one stacked on another) in real-time mode powering every dashboard view; compression and retention policies; on-screen raw-vs-aggregate query times and compression ratio |
| Best Use of Gemini API | Civic triage with a fixed rubric and structured JSON output; Ask with object boxes turned into a sound direction |
| Best Use of ElevenLabs | A designed warning-sound library made with the Sound Effects API; live Flash v2.5 voice for Ask, placed in space |
| Best Domain Name from GoDaddy Registry | Landing page and dashboard served from the team's registered domain |

### Deadline

Devpost submission closes **10:00 EDT, Sunday Sept 27, 2026**, with a public GitHub link. Commits are reviewed to confirm the work was done during the event. Feature freeze at **02:00**; after that, only fixes, demo hardening and submission assets.

## Risks

**The biggest risk is time: at noon Saturday there are 14 hours to feature freeze and 12 phases to build.** The rest are grouped below, worst first in each group. Each one says where the plan now handles it.

### Time & team

| Risk | Level | What we do |
| --- | --- | --- |
| 12 phases in 14 hours. Built one after another, the phone alone (Phases 0 to 4) fills the day. | High | Four tracks in parallel, a thin end-to-end slice by 18:00, and cut checks at 20:00 and 23:00 (see "Tracks & timeline"). |
| Several people and agents commit to one `main`. `package.json`, the lockfile and the shared modules conflict first. | Medium | Phase 0 adds every dependency and the shared modules in one commit. Each track owns its folders (Conventions). |
| Every push to `main` builds on Vercel. The Hobby plan runs 1 build at a time and allows 100 deploys a day, so builds queue up. | Medium | Docs-only commits skip the build. Phone tests run on `localhost` over `adb reverse` (Local development). |
| DNS can take hours, and the domain was in Phase 10. | Medium | Started in Phase 0. |

### Sensing

| Risk | Level | What we do |
| --- | --- | --- |
| Depth fails on the demo phone: the phone isn't supported, depth needs motion, and glass, dark and shiny floors leave holes. | High | Phase 0 before anything else. Replay clips and a known-good demo spot. Camera-only mode only if Phase 0 shows no depth. |
| The camera can't see close to the feet. In portrait the view is roughly 30 to 40° wide, so the 0.9 m corridor only fits in view past about 1.4 m. A knee-high box drops out of the bottom of the view at about 1 m, and the old "6 updates off" rule would then stop the warning just before impact. | High | Out-of-view memory (Phase 2). Phase 0 measures the real field of view in both orientations, then the team picks orientation and tilt. |
| Door frames (2.03 m) sat inside the old 1.4 to 2.2 m head-height band, so every doorway would ring. Ramps and sloped sidewalks read as walls or drop-offs against a flat floor. | High | Head-height top follows the user's height, heights come from a sloped floor line, and both have tests (Phase 2). |
| A lanyard swings and spins: motion blur, lost tracking, and a corridor pointing into the wall. The screen faces the wearer, so clothing can tap it. | Medium | Rigid chest mount, travel-direction blend (Phase 1), long press on Stop (Phase 9). |
| Chrome's `local-floor` on phones is a fixed guess (1.2 m below the start point). | Medium | Floor from a hit test, then depth calibration (Phase 1). |
| Heat and battery: ARCore, depth, the detector, GPS and the screen all run at once. | Medium | Battery pack, detector to 2 Hz when hot, 15-minute soak test (Phase 10). |
| Depth from motion reads moving people and bikes badly. | Low | Accept for the prototype; name it in the README limitations. |

### Audio & controls

| Risk | Level | What we do |
| --- | --- | --- |
| TalkBack takes raw taps, so double-tap-anywhere Ask could never work for a TalkBack user, and the plan's own TalkBack test would fail. | High | Ask and Stop are real DOM buttons (Phase 9). |
| The 150 ms sound target can't be met: 3 updates at 10 Hz take 200 to 300 ms, and Bluetooth adds 150 to 300 ms. | Medium | Target is now 0.6 s (Phase 3). If still late, close hazards activate after 2 updates (Fallbacks). |
| Left and right are weak on bone conduction: the skull carries sound to both ears. | Medium | Existing fallback: more angle exaggeration, a level difference, and the spoken "left" and "right". |
| A streamed MP3 can't play through the panner as it arrives. | Medium | Whole MP3 in one response; PCM streaming only if Ask misses 3 s (Ask contract). |
| Sounds longer than their repeat interval stack up. `loudnorm` can't measure clips shorter than 0.4 s. | Low | One instance per hazard, loop variants, peak normalising (Phase 3). |

### Cloud services

| Risk | Level | What we do |
| --- | --- | --- |
| Gemini's free limits are low and no longer published. On the free tier Google may use frames to improve its products and humans may read them, which clashes with rule 5. | High | Billing key for every live frame. The README says what Google keeps (abuse logs for 55 days on the paid tier). |
| Gemini 3 Flash thinks at `high` by default, which alone can push Ask past 3 s. The plan's temperature 0.2 goes against Google's advice for Gemini 3. | Medium | `thinking_level: minimal` and the default temperature (Phase 5). |
| Tiger's free service turns read-only at 750 MB and has no connection pooler. Reloading the seed a few times, or many cold function connections, can hit a limit. | Medium | Smoke test in Phase 0, size check before reloads (Phase 8), small client pool (Phase 6). The trial service is the fallback. |
| Giving Gemini database tools (MCP or function calling) in triage or Ask would add a round trip and let text in a frame steer database access. | Medium | Gemini gets no tools on the phone paths; the backend runs every query (Phase 5, "Gemini and the database"). |
| Anyone can call `/api/ask` and `/api/triage`, and a loop bug could drain ElevenLabs credits. | Low | Hourly budgets on both routes (Phase 5). |

### Privacy

| Risk | Level | What we do |
| --- | --- | --- |
| A device hash and a session id on every event add up to a movement trail per person, at 100 m. | Medium | Hash only on civic reports, no session id stored (contracts, Phase 6). |
| Weekly salt rotation inside a 14-day window counts one person up to 3 times, so one person alone could pass the 3-reporter rule. | Medium | Rotate every 28 days at most often, never during the event. The README says a window that crosses a rotation can count one person twice. |
| Test photos and replay clips in the public repo could show strangers. | Medium | Teammates only, no strangers' faces or plates (Phases 5 and 10). |
| The live feed shows single reports, which skips the 3-reporter rule. | Low | The feed shows category, severity, place and time, and nothing about the device. The README says so. |

### Logic fixes

| Risk | Level | What we do |
| --- | --- | --- |
| The frame gate skipped every "vehicle", which blocks bikes and scooters: the main civic story. COCO has no scooter class at all. | High | Skip only person, car, bus and truck (Phase 4). |
| The cut list said "cut from the bottom up", which cuts detector labels first and the tactile-strip stretch last. | Medium | Now "cut from the top down", with five new items at the top. |
| Near-miss pressure `1 + near-misses ÷ 10`: with the seed's volume a busy cell reaches the hundreds, so crowding outranks everything else. | Medium | Log scale (Phase 6). |
| `cell_daily` averaged averages for positions. | Low | Positions come from the geohash centre (Phase 6). |
| Gemini picked severity on its own, so the same scene could score 2 one time and 3 the next. It also had to guess if a thing would "still be there in an hour" from one photo. | Medium | Gemini answers yes/no questions; code works out severity from a fixed table; "left or fixed" replaces "lasting" ("What gets reported"). |
| deck.gl's HexagonLayer re-bins cells, so its hexagons wouldn't match the queue. | Low | MapLibre fill squares, no deck.gl (Phase 7). |

### Demo & safety

| Risk | Level | What we do |
| --- | --- | --- |
| The screen faces the wearer and the sound is in the wearer's ears, so judges see and hear nothing, in a loud hall. | High | `scrcpy` mirror with audio and spare earbuds for the judge (Phase 10, "Demo setup"). |
| The backend drops the same device, cell and category for 15 minutes, so the second judge's staged report vanishes. | High | "New demo reporter" button (Phase 9). |
| Blindfolded testing near stairs, curbs or platforms can hurt someone. | High | Spotter, indoors, staged edges only (hardening checklist). |
| Indoors at the venue there may be no GPS fix, so events have no location and are rejected. | Medium | The chosen station's position as the fallback (Phase 9). |
| The dashboard names the City of Ottawa and OC Transpo. Their logos, or wording that suggests a partnership, could read as speaking for them. | Low | No logos, and "not affiliated with the City of Ottawa or OC Transpo" in the dashboard footer and README. |

## Tracks & timeline

**Four tracks start together in Phase 0 and meet in a thin end-to-end slice at 18:00.** Times are EDT, Saturday Sept 26 into Sunday Sept 27.

Coding agents write most of the code. Each of the four people takes one track and does the parts an agent can't: anything on the phone, anything heard, anything clicked in a vendor console.

| Track | Phases | Owns | Hands-on work for the person |
| --- | --- | --- | --- |
| A. Phone sensing | 0, 1, 2, 4 (detector) | `app/walk`, `lib/xr`, `lib/hazard`, `lib/detect` | Every phone test, tape-measure checks, walking tests, replay clips |
| B. Sound & AI | 3, 4 (frame gate), 5 | `lib/audio`, `lib/server/gemini`, `lib/server/elevenlabs`, `app/api/triage`, `app/api/ask`, `scripts/sounds`, `public/sounds` | Picking sounds by ear, left/right blindfold test, test photos |
| C. Data & dashboard | 6, 7, 8 | `db`, `lib/server/db`, `app/api/events`, `app/api/dashboard`, `app/map`, `scripts/seed` | Tiger console, checking the dashboard numbers make sense |
| D. Shell & ship | domain, 9, 10, 11 | `app/page`, `lib/events`, manifest, service worker, `docs`, README | DNS at the registrar, Vercel settings, chest mount, props, TalkBack test, demo video |

| Time | Checkpoint |
| --- | --- |
| 12:00 to 14:00 | Phase 0 on the phone. In parallel: domain DNS, database smoke test, sound generation, Gemini limits. |
| 14:00 | Decide: depth or camera-only, portrait or landscape, camera access or not. |
| 18:00 | Thin slice: walking toward a chair plays a tick from its side; Ask speaks an answer; `/map` shows seeded data from the real database; the domain serves the landing page. |
| 20:00 | Cut check 1: each track says what is left, and the team cuts from the cut list until it fits. |
| 23:00 | Cut check 2, same rule. Record the three replay clips. |
| 02:00 | Feature freeze. Run the final acceptance checklist. |
| 02:00 to 06:00 | Hardening, backup demo video, screenshots, README numbers. |
| 08:00 | Devpost draft submitted. It can still be edited, and Devpost gets slow near the deadline. |
| 10:00 | Submission closes. |

## Open questions

Settled on Sept 26:

- Team: 4 people, one per track, with coding agents doing most of the code.
- Hardware: an ARCore depth phone, a second Android phone, and bone-conduction earbuds. No chest mount yet.
- Accounts: domain registered, Gemini key with billing, ElevenLabs credits applied, Tiger Cloud service created. The Phase 0 database smoke test still runs.
- Judging: judges visit our table.

Still open. Each one has a default, so no track waits for the answer.

| Question | Default until answered |
| --- | --- |
| What is the domain name? | Vercel address until it is known |
| Which phone model is the main one? | Whatever passes Phase 0 |
| Are the earbuds Bluetooth, and is there a second pair for judges? | Bluetooth, one pair; judges hear through the `scrcpy` mirror |
| How will the phone be worn? There is no mount yet. | A bike phone clamp on a backpack shoulder strap, portrait. Buy or borrow one today |
| What can be staged for the civic demo: an e-scooter, a bike, a construction barrier? | A bike laid across the hallway |
| How long is each judge visit? | 5 minutes |
| Is the staged queue moment in "Demo setup" (2 simulated reporters plus the judge's live one) acceptable? | Yes, labelled |

## Stack and repository layout

**One TypeScript web project serves everything: the phone app, the city dashboard, the landing page and the backend routes, deployed as a single Vercel project.** One deploy, one domain, secrets in one place.

### Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript, strict mode | Pages for `/`, `/walk`, `/map`; route handlers under `/api` |
| Hosting | Vercel | HTTPS by default (required for WebXR, camera, location, install) |
| AR + depth | WebXR Device API in Chrome for Android, `immersive-ar` session with `depth-sensing`, `camera-access`, `hit-test`, `dom-overlay`, `local-floor` | No 3D engine needed; a bare WebGL context for the XR layer and camera texture |
| On-device detector | MediaPipe Tasks Vision Object Detector, EfficientDet-Lite0 (COCO classes), GPU delegate | Model file served from the app and cached for offline |
| Audio | Web Audio API: one AudioContext, PannerNode with HRTF panning, GainNodes | All sounds pre-decoded at start |
| Offline + install | Web app manifest + service worker | Caches app shell, sound library and detector model |
| Backend | Next.js route handlers (Node runtime, not Edge, for the database driver) | Holds all keys |
| Gemini | Google Gen AI SDK for JavaScript | Structured JSON output with a response schema |
| ElevenLabs | REST calls from the backend | Sound Effects (build time), Text to Speech streaming (runtime) |
| Database | Tiger Cloud free service (TimescaleDB + PostGIS) | Plain Postgres driver (postgres.js), SSL required |
| Dashboard map | MapLibre GL JS with the OpenFreeMap basemap (`https://tiles.openfreemap.org/styles/liberty`), cells drawn by MapLibre itself | No paid map keys, no deck.gl (see Phase 7) |
| Dashboard charts | Lightweight SVG charts or Recharts | Small line charts and a bar chart |
| Build-time scripts | Node scripts run locally | Sound generation, seed data |
| Styling | Tailwind CSS | Chosen in Phase 0 |
| Validation | zod | One schema per contract in `lib/shared/contracts.ts`, used by the phone and the backend |
| Tests | Vitest | `npm test`; Phase 2 hazard tests go here |
| Audio post-processing | ffmpeg (local) | Trim, fade, mono, loudness |

### Repository layout

| Path | Holds |
| --- | --- |
| `app/page` | Landing page: what beluga is, disclaimer, links to the app, dashboard and repo |
| `app/walk` | The phone app (Walk, Ask, consent, settings, debug overlay) |
| `app/map` | City dashboard (fix-first queue, map, stations, live feed, performance panel) |
| `app/api/triage` | Gemini civic triage |
| `app/api/ask` | Gemini Ask + ElevenLabs voice |
| `app/api/events` | Batch intake of near-misses and civic reports into Tiger Data |
| `app/api/dashboard/*` | Read-only endpoints for queue, map cells, station trends, live feed, performance numbers |
| `lib/xr` | AR session start/stop, depth reading, camera frame reading, floor tracking |
| `lib/hazard` | Corridor geometry, hazard classification, smoothing, priorities, near-miss detection |
| `lib/audio` | Sound loading, spatial playback, repeat scheduler, voice clips, ducking |
| `lib/detect` | Detector wrapper, label mapping, frame gate |
| `lib/events` | On-phone event queue, batching, offline persistence, coarsening, grid cells |
| `lib/server/gemini` | Prompts, response schemas, calls, validation |
| `lib/server/elevenlabs` | Voice calls |
| `lib/server/db` | Database client and queries |
| `lib/shared` | Types and constants shared by phone, backend and dashboard (the contracts section) |
| `public/sounds` | Final processed sound files + a manifest listing them |
| `public/models` | Detector model file |
| `public/manifest` + service worker | Install and offline |
| `db/migrations` | Ordered database setup files |
| `scripts/sounds` | ElevenLabs generation + ffmpeg processing |
| `scripts/seed` | Simulated-week generator and bulk loader |
| `docs` | Contracts, parameters, demo script, architecture notes |

### Conventions

- All tunable numbers live in one shared parameters module (see "Tunable parameters"), never inline.
- Every module that touches a sponsor service has a short comment header saying which prize it serves; the README links to these files.
- Commit early and often with clear messages; the commit history is judged.
- A `.env.example` lists every variable with no values; real values never enter the repo.
- Phase 0 installs every dependency and creates the shared types and parameters modules in one commit. Parallel tracks then add to those files, and never reorder or reformat them, so merges stay clean.
- Each track owns its folders (see "Tracks & timeline"). Touch another track's folder only in a small, separate commit.

## Accounts, secrets and environment

**Four external services, each reached only from the backend, configured through environment variables set in Vercel and in a local untracked env file.**

| Variable | Used by | Value / source |
| --- | --- | --- |
| `DATABASE_URL` | Backend, seed script, migrations | Tiger Cloud service connection string (SSL required) |
| `DATABASE_URL_READONLY` | Backend ("Ask the data" stretch only) | Connection string for a read-only database role |
| `GEMINI_API_KEY` | Backend | Google AI Studio key |
| `GEMINI_TRIAGE_MODEL` | Backend | Current Flash-Lite model id, `gemini-3.5-flash-lite` as of Sept 2026 (check AI Studio; do not use 2.5 models) |
| `GEMINI_ASK_MODEL` | Backend | Current Flash model id, `gemini-3.8-flash` as of Sept 2026 |
| `ELEVENLABS_API_KEY` | Backend, sound script | ElevenLabs account with event credits applied |
| `ELEVENLABS_VOICE_ID` | Backend, sound script | One calm, clear English voice chosen once and used everywhere |
| `ELEVENLABS_TTS_MODEL` | Backend | `eleven_flash_v2_5` |
| `DEVICE_HASH_SALT` | Backend | Random string; rotating it is what rotates device hashes. Rotate every 28 days at most often, and never during the event: a rotation inside the 14-day fix-first window counts one person as two reporters |
| `GEMINI_HOURLY_BUDGET` | Backend | Default 150 triage calls per hour across all devices |
| `ASK_HOURLY_BUDGET` | Backend | Default 120 Ask calls per hour across all devices, so a bug or a stranger can't drain ElevenLabs credits |
| `DASHBOARD_SHOW_SIMULATED` | Dashboard | Default true (demo); the toggle still works |
| `NEXT_PUBLIC_SITE_NAME` | Everywhere | `beluga` |

### Service setup notes

- **Tiger Cloud:** free service (no card, up to 2 per account, us-east-1, shared CPU; 750 MB of storage, then it turns read-only; no connection pooler). Enable the PostGIS extension. If a free-service limit blocks a needed feature, create a 30-day trial service instead and change only `DATABASE_URL`.
- **Gemini:** check the project's real per-model daily limits in AI Studio before building the gate; Google no longer publishes fixed numbers, and free limits were cut hard in late 2025. Use a key with billing enabled for every live frame: on the free tier Google may use the content to improve its products and human reviewers may read it, which breaks the privacy story for camera frames with bystanders in them. The paid tier does not train on prompts and keeps abuse logs for 55 days.
- **ElevenLabs:** apply the event credit code before generating sounds; sound effects and TTS both draw on it.
- **Domain:** the team's GoDaddy Registry domain points at the Vercel project; the dashboard is also reachable at a `map.` subdomain that routes to `/map`.

### Local development

- WebXR only works on the phone over HTTPS, so phone testing always uses a Vercel preview deployment (every push) or a local HTTPS tunnel.
- Fastest phone loop: plug the phone in over USB, run `adb reverse tcp:3000 tcp:3000`, and open `http://localhost:3000/walk` on the phone. Chrome treats `localhost` as a secure origin, so WebXR works with no tunnel and no deploy, and hot reload works. Use Vercel for testing the domain and the installed app.
- Chrome remote debugging (phone connected over USB, inspect from desktop Chrome) is how console output from the phone is read.
- The dashboard and backend routes can be developed on a laptop against the real database.

## Shared data contracts

**These shapes are defined once in the shared types module and used unchanged by the phone, backend and dashboard.** Units: metres, degrees, milliseconds, ISO-8601 UTC timestamps. Angles: negative = left, positive = right, 0 = straight ahead.

### Enumerations

| Name | Values |
| --- | --- |
| Hazard kind | `obstacle`, `head_height`, `drop_off` |
| Detector class | `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `bench`, `chair`, `fire_hydrant`, `stop_sign`, `potted_plant`, `suitcase`, `pole_like`, `unknown` |
| Sound id | `edge_pulse`, `head_chime`, `tick`, `ping`, `bell`, `marimba`, `buzz`, `taps`, `listening`, `ready`, `reported`, `centre_tick` |
| Event kind | `hazard_seen`, `near_miss`, `civic_report` |
| Civic category | `sidewalk_obstruction`, `construction_barrier`, `head_height_hazard`, `surface_damage`, `blocked_curb_cut`, `tactile_strip_issue`, `snow_ice`, `other_fixed` |
| Scene context | `platform`, `crosswalk`, `sidewalk`, `indoor`, `stairs`, `unknown` |
| Source | `live`, `simulated` |

### Hazard update (on the phone: hazard engine → audio, events, gate)

| Field | Type | Meaning |
| --- | --- | --- |
| id | string | Stable per tracked hazard while it persists (kind + side bucket + short counter) |
| kind | hazard kind | Obstacle, head-height or drop-off |
| distance | number | Metres ahead along the walking direction to the nearest point |
| angle | number | Degrees left/right of the walking direction |
| label | detector class | Best matching detector label, or `unknown` |
| blocking | number 0–1 | Share of corridor width covered |
| active | boolean | Passed the smoothing threshold and should sound |
| firstSeenAt / updatedAt | number | Milliseconds since session start |

### Event (phone → `/api/events`, batched)

Request body: an object with `events` (1–200 items) and `consentVersion`. Each event:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| ts | timestamp | yes | When it happened on the phone |
| deviceKey | string | yes | Random id stored on the phone; the backend turns it into a salted hash for civic reports only, and never stores the raw key. The session id stays on the phone: with a hash and a session on every event, the rows would add up to a movement trail per person |
| kind | event kind | yes |  |
| hazardKind | hazard kind | yes |  |
| detectorClass | detector class | yes |  |
| closestDistance | number | yes | Metres |
| angle | number | no | Degrees |
| heading | number | no | Compass degrees 0–360 from device orientation |
| lat / lon | number | yes | Already rounded to 3 decimals on the phone |
| cell | string | yes | Grid cell key (geohash, 7 characters) |
| stationId | string or null | no | Nearest station within 150 m, or the station chosen at session start when underground |
| context | scene context | no | From the last triage result |
| civic | object or null | only for `civic_report` | category, severity (1–4), confidence (0–1), description (≤ 15 words) |

Response: accepted count and rejected count. The backend rejects the whole batch if consent version is missing, and drops individual events that fail validation.

### Triage (phone → `/api/triage`)

Request: one JPEG frame (long edge ≤ 768 px, quality \~0.7, base64), the triggering hazard (kind, distance, angle, height band, blocking share, detector class), scene hint if known, and deviceKey (for rate limiting only).

Response (validated against the schema before returning). The yes/no answers come from Gemini; severity and the report decision come from the backend (see "What gets reported"):

| Field | Type | Notes |
| --- | --- | --- |
| report | boolean | Final decision after the backend applies the rules (not just the model's say-so) |
| category | civic category or null |  |
| isPublic | boolean | Open to anyone: street, path, platform, station or public building |
| leftOrFixed | boolean | Not moving, not held, not in use |
| wayAround | `clear`, `narrow` or `none` | Path left to get past it: `clear` is 1.5 m or more, `narrow` is less |
| caneWarning | boolean | A warning a cane or foot can find: a solid barrier with a rail or edge at or below 0.68 m, or an intact tactile strip |
| tripOrDrop | boolean | A lip, hole, trench or drop that can catch a foot |
| severity | 1 to 4 | Worked out by the backend from the category table |
| confidence | 0–1 |  |
| description | string | ≤ 15 words, no people, faces, plates |
| context | scene context |  |
| box | 4 integers or null | Top, left, bottom, right, scaled 0–1000 |
| budgetRemaining | number | Calls left this hour |
| latencyMs | number | For the debug overlay |

### Ask (phone → `/api/ask`)

Request: one JPEG frame (same limits), optional question text (MVP always "What's in front of me?").

Response: answer text (≤ 2 sentences), target box or null, target label, and the spoken audio. Return the whole MP3 as the response body, with the answer, box and label in response headers (URL-encoded JSON). The phone decodes it and plays it through the panner. Web Audio can't decode half an MP3, and an `<audio>` element can't send a POST, so a streamed MP3 would not start any sooner. If Ask misses 3 s, the upgrade is to stream `pcm_24000` from ElevenLabs and play each chunk as its own audio buffer. If voice generation fails, return the text with a flag so the phone can fall back to its cached "Sorry, I couldn't see that" line.

### Dashboard read endpoints (browser → `/api/dashboard/*`)

| Endpoint | Returns |
| --- | --- |
| queue | Top 25 fix-first rows: cell, place label, lat/lon, category, who fixes it, worst severity, reporters, near-misses, last seen, score, and each score part |
| urgent | "Check now" list: severity 4 reports from the last 14 days, read from `cell_daily`: cell, place label, category, who fixes it, day, source. No reporter minimum, no time of day |
| cells | Map cells for a time window (1 h / 24 h / 7 d), category filter and source filter: cell, lat/lon, events, near-misses, reports, score |
| stations | Hourly near-misses per station for 7 days, plus an hour-of-day profile for one station |
| feed | Last 20 civic reports (time, category, severity, description, place label, source) |
| perf | Latest measured raw vs aggregate query times, compression ratio, row counts, last seed load time |

Every dashboard response includes `includesSimulated` so the banner can show.

## What gets reported

**A fixed list says what can be reported, a fixed table says how bad it is, and Gemini only answers questions about what it sees.** Code makes every decision, so the same answers always give the same severity, and the dashboard can say why. The rules live once in `lib/shared/reporting` and are used by triage, the seed generator and the dashboard.

### The four tests

A sighting becomes a civic report only if all four are true:

1. **Public:** a place open to anyone. Streets, paths, crossings, curb ramps, transit platforms and stations, and public buildings. Homes and private workplaces are out.
2. **Left or fixed:** not moving, not held, not in use. A scooter lying across the path counts; someone riding it doesn't. This replaces "will it still be there in an hour", which one photo can't answer.
3. **In the way:** in or over the walking path. The phone already makes sure of this, because it only asks about hazards inside the corridor.
4. **Someone can fix it:** its category is on the list below, and so it has an owner. People, animals and vehicles in the road never pass.

### Severity

Severity measures what the cane or guide dog misses. Something the cane finds costs a detour. Something it misses gets walked into. Something it misses that you can fall into is the worst.

| Level | Name | Meaning |
| --- | --- | --- |
| 1 | Minor | The path stays clear. Never reported; anything that passes the four tests is at least a 2 |
| 2 | Detour | The cane or dog finds it, but the user has to leave their line to get past |
| 3 | Collision | Likely to be hit: the cane can't find it (head height, tape-only barrier), or the only way past is the road |
| 4 | Fall | A drop with no warning a cane or foot can find: missing strip at a platform edge or top of stairs, open hole or trench |

### Categories

| Category | Covers | Not this | Base | Goes up when | Who fixes it |
| --- | --- | --- | --- | --- | --- |
| `sidewalk_obstruction` | E-scooter, bike, sandwich board, bin or furniture left in the path | Cars in the road, people, things being carried | 2 | 3 if `wayAround` is none or blocking is over 0.6 | The scooter operator for e-scooters; City by-law for the rest |
| `construction_barrier` | Fencing, barriers, cones, a closed sidewalk | | 2 | 3 if no `caneWarning` (tape only, gaps between cones, no edge at or below 0.68 m); 4 if also `tripOrDrop` | The permit holder, through the City |
| `head_height_hazard` | Sign, branch, awning, mirror or open window sticking out more than 10 cm between 0.68 m and 2.1 m high, with nothing at or below 0.68 m for a cane to hit | Anything that reaches the ground: the cane finds it | 3 | | Property owner; City forestry for branches |
| `surface_damage` | Hole, heaved or broken slab, broken curb in the path | Cracks with no height change | 2 | 3 if `tripOrDrop`, or the phone measured a drop-off | City roads & sidewalks |
| `blocked_curb_cut` | Curb ramp blocked by a car, snow, a scooter or water | | 2 | 3 if `wayAround` is none (the way on is through the road) | City by-law or roads |
| `tactile_strip_issue` | Warning strip missing, worn, broken or covered where one is required: a transit platform edge, the top of stairs, a curb ramp or depressed curb at a crossing | Intact strips; places where no strip is required | 3 | 4 at a platform edge or top of stairs | OC Transpo within 150 m of a station; the City at curbs; the property owner indoors |
| `snow_ice` | Snowbank or ice in the path, unplowed curb ramp | | 2 | 3 if `wayAround` is none | City winter maintenance |
| `other_fixed` | Anything fixed and in the way that fits nothing above | | 2 | Never; it stays at 2 and needs confidence 0.85 | City 311 |

The owner is worked out in the API from this table (no database column). The dashboard shows it as "Who fixes it" and can filter by it.

### Where the numbers come from

The categories follow Ontario's and Ottawa's own accessibility rules, so a planner sees which rule a spot likely breaks.

| Rule | Source | Used in |
| --- | --- | --- |
| Outdoor paths keep 1.5 m of clear width (1.2 m where a path meets a curb ramp) | Ontario O. Reg. 191/11 (AODA), s. 80.23 | `wayAround`: `clear` or `narrow` |
| Where headroom drops below 2.1 m, a rail or barrier a cane can find must go around the object | O. Reg. 191/11, s. 80.23; City of Ottawa Accessibility Design Standards (ADS) 2.5.2 | `head_height_hazard`, `caneWarning` |
| Anything sticking out more than 100 mm between 680 mm and 2030 mm must be cane-detectable at or below 680 mm | CSA B651-12, 4.4.1; Ottawa ADS 2.5.1 and 2.5.3 | `head_height_hazard`, `caneWarning` |
| Tactile strips at the top of every flight of stairs, and at curb ramps and depressed curbs at crossings | O. Reg. 191/11, s. 80.25 to 80.27 | `tactile_strip_issue` |
| Tactile strips along the full length of a transit platform edge | CSA B651-12, 4.3.5.3.2; Ottawa ADS 6.20.1.3 (OC Transpo platforms) | `tactile_strip_issue` at severity 4 |
| Parked e-scooters leave 2 m of foot path clear | City of Ottawa e-scooter rules, 2026 season | `sidewalk_obstruction` for scooters |

The phone can't measure to the centimetre, so a report means a spot likely breaks a rule, and the dashboard says "likely". A person from the city confirms it. The detail card for a spot names the rule and the 311 channel to use: the "Misparked e-scooter" form for scooters, a 311 phone call for broken sidewalks (there is no online form), and the road, sidewalk or pathway problem form for the rest.

### Who decides what

| Piece | Decided by | Why |
| --- | --- | --- |
| In the path, how far, how wide, how high, any drop | Phone depth | Measured |
| Category, the yes/no answers, description | Gemini, from a schema of enums and yes/no fields only | It can see what a thing is; it can't measure |
| Severity | Code, from the tables above | Same input, same answer, and the "why" line can quote the rule |
| Report or not | Code: four tests, confidence, no duplicate, budget left | Gemini's confidence number is a weak signal on its own |
| Place in the queue | The fix-first score (Phase 6) | Severity is one report; the queue is a place over 14 days |

The real check on a report is the 3-reporter rule: a spot only reaches the queue once 3 different phones have reported it.

### Severity is not priority

Severity is how bad one report is. Priority is what to fix first: the fix-first score multiplies the severity weight (1, 2, 4, 8) by reporters, near-misses, recency and transit. A severity 2 scooter spot that 15 people pass every evening can outrank a severity 3 sign that 3 people reported. That is on purpose: the city fixes the spot, like a scooter parking corral, and not the one scooter.

### Severity 4 doesn't wait

A missing strip at a platform edge shouldn't need three people to nearly fall first. Severity 4 reports skip the 3-reporter rule and go to a "Check now" list on the dashboard. That list shows the cell and the day, never the time, so one report can't place one person at one moment. It still shows that someone was in that cell that day; the README says so.

## Phase 0: repo, deploy skeleton, device test page

**Goal: a deployed HTTPS site whose `/walk` page proves, on the demo phone, that Chrome can give depth, camera frames, spatial audio, wake lock and location together.** Nothing else starts until this passes or a fallback is chosen.

### Tasks

1. Create the Next.js TypeScript project with the layout above, strict type checking, a linter, and the shared types and parameters modules (empty but present).
2. Add `.env.example`, a `docs` folder with the contracts and parameters copied from this plan, and an MIT licence.
3. Deploy to Vercel; confirm every push creates a preview URL.
4. Landing page placeholder at `/`: "beluga" title, one-line description, research-prototype disclaimer.
5. `/walk` capability check page, one large "Start test" button (the user gesture), then a pass/fail list:
   - WebXR present and `immersive-ar` supported
   - Session starts with optional features depth sensing (`usagePreference: ["cpu-optimized"]`, `dataFormatPreference: ["luminance-alpha", "unsigned-short"]`; Chrome on ARCore gives no `float32` depth, so asking for it alone returns none), camera access, hit test, DOM overlay, local-floor reference space; list which features were actually granted, and check `session.domOverlayState`, since Chrome drops an optional DOM overlay without saying so
   - Depth data arrives (show width, height, and the distance at screen centre, updating)
   - A camera image arrives (show its size and a tiny preview drawn from the camera texture)
   - Audio: an AudioContext resumed from the same tap plays a test tone hard left, then centre, then hard right through an HRTF panner, on the Bluetooth bone-conduction earbuds. Note how late the tone sounds after the tap
   - Screen wake lock acquired
   - Geolocation fix with reported accuracy
   - Device orientation / compass heading available
   - Field of view: horizontal and vertical degrees from the view's projection matrix, in portrait and in landscape
6. Log every result to the console as well (read through Chrome remote debugging).
7. Run the whole check again from the installed app (home screen), not only a browser tab.

### Start now, in parallel with Phase 0

None of these need the phone, and each one is slow to fix late.

- **Domain:** point the domain at Vercel today (steps in Phase 10). DNS can take hours.
- **Database smoke test:** on the free Tiger service, turn on PostGIS, then create a tiny hypertable, a real-time continuous aggregate with a second one stacked on it, a columnstore policy and a retention policy. If any step fails, move to the trial service now.
- **Sound library:** Phase 3a needs nothing else; generate it now.
- **Gemini:** read the project's real limits in AI Studio and set up the billing key.
- **Hardware:** a chest mount (there is none yet; a bike phone clamp on a backpack shoulder strap is a quick option), battery pack, USB cable, and a bike or scooter to stage.

### Done when

- The team phone shows all checks passing, or the failing ones are known and a fallback from the final section is chosen.
- Depth at screen centre roughly matches a tape measure at 1 m and 2 m while the phone is moving slowly (depth on most phones comes from motion).
- The field of view is measured, and the team has picked portrait or landscape and how far the phone tilts down (see "The camera can't see close to the feet" in Risks).

## Phase 1: AR session, depth, camera frames, floor

**Goal: a reusable module that runs the AR session and, ten times a second, hands the rest of the app a clean set of 3D points in world space, the phone's pose, the floor height and the walking direction.**

### Session lifecycle

- Location permission is asked during first run, before any session, so no prompt has to appear inside AR.
- One start tap does, in order: call `requestSession` straight from the tap handler with no `await` before it, resume the AudioContext in the same handler, then request the wake lock and start location watching. Any failure is spoken (cached voice line) and shown in the overlay.
- Required: `immersive-ar`. Optional: depth sensing, camera access, hit test, DOM overlay (rooted at the app's overlay element), local-floor. Prefer the local-floor reference space; fall back to local and estimate the floor yourself.
- The session ends on "Stop", on visibility loss, or on error. On end: stop audio scheduling, flush the event queue, release the wake lock, speak "beluga stopped".
- If the viewer pose is missing or reported as emulated for more than 1 s, mark tracking as lost, pause hazard output and play the "hold steady" voice line once (cooldown 10 s).

### Depth sampling

- Each XR frame, get the CPU depth information for the single view. Process only every Nth frame to reach \~10 Hz.
- Sample a fixed grid in normalised view coordinates (default 48 × 36 points) and read each one with `getDepthInMeters(x, y)`. It takes normalised view coordinates (0 to 1, or it throws) and applies the depth-buffer transform and the raw-to-metres scale itself, so the data format doesn't matter.
- Discard samples under 0.2 m or over 5 m, and samples that read zero.
- Turn each sample into a 3D point: build the view-space ray for that pixel from the inverse projection matrix, scale it to the measured depth (depth is distance along the camera's forward axis), then transform by the view's pose into the reference space.
- Output per update: array of world points, the camera position, timestamp, sample count, valid count.

### Camera frames

- With camera access granted, get the camera image as a WebGL texture from the XR WebGL binding each processed frame.
- Two consumers, each at its own rate: the detector (small frame, default 320 × 240, 4 Hz) and Gemini (up to 768 px long edge, JPEG \~0.7, only on request).
- Render the texture into a small offscreen framebuffer, read pixels, and hand over an image object. Never read the full-resolution texture every frame.
- Record the camera's horizontal field of view (from the projection matrix) for turning box positions into angles.

### Floor and walking direction

- On phones, Chrome's local-floor is a guess: it always puts the floor 1.2 m below where the phone started. Use it only as a starting value. The first real value comes from a hit test straight down and ahead against ARCore's detected floor plane (the one use for `hit-test`). Refine it during calibration: the user takes three slow steps; take the median height of the lowest 20% of points within 0.5–2 m ahead. Store it; re-estimate every 5 s from points that are clearly floor (within ±0.1 m of the current value) using a slow moving average.
- Walking direction = the camera's forward vector flattened onto the horizontal plane, smoothed over \~0.5 s. Right vector = perpendicular on the horizontal plane.
- When the user moves faster than 0.3 m/s, blend in the direction of travel (camera position change over the last 1 s) at weight 0.5. A phone on a strap twists away from where the user is going, and the corridor would point into the wall.
- Stationary flag: camera position moved less than 0.1 m over the last 5 s.

### Debug overlay (DOM overlay, toggled by a three-finger tap or a settings switch)

Shows processing rate, valid sample count, floor height, tracking state, nearest corridor distance, current hazards, detector labels, last triage/Ask latency, event queue length, Gemini budget left.

### Done when

- Walking toward a wall, the nearest-corridor distance falls smoothly and matches a tape measure within \~20% between 0.5 m and 3 m.
- Floor height stays stable (±0.1 m) over a 2-minute walk.
- The loop holds \~10 updates per second on the demo phone with the detector not yet running.

## Phase 2: corridor hazard detection and hazard engine

**Goal: from each set of world points, decide what is in the walking corridor, how far, which side, and whether it should sound; emit stable hazard updates and near-miss events.** This is pure logic with no browser APIs, so it is unit-tested with synthetic point sets.

### Classify each point

For each world point, relative to the camera position: ahead = distance along the walking direction; lateral = distance along the right vector; height = point height minus floor height.

| Band | Rule | Result |
| --- | --- | --- |
| Outside corridor | lateral beyond ±0.45 m, or ahead under 0.3 m, or ahead over 3.0 m (3.5 m for drop-off candidates) | ignore |
| Walkable floor | height between −0.25 m and +0.15 m | ignore |
| Obstacle | height over 0.15 m up to 1.4 m | obstacle candidate |
| Head-height | height over 1.4 m up to the head-height top (user's height + 0.1 m, default 1.95 m) | head\_height candidate |
| Overhead | above the head-height top | ignore |
| Drop-off | height under −0.25 m | drop\_off candidate |

The head-height top follows the user's height (asked in settings). Door frames sit at 2.03 m and exit signs hang near 2.1 m, so a fixed 2.2 m top would ring the head chime at every doorway.

Heights are measured from a floor line that can slope. Each update, fit height against distance ahead through the walkable-floor points in the corridor (a median-based fit, slope clamped to ±10%). Ramps and sloped sidewalks then stay walkable, instead of reading as a wall ahead or a drop-off.

### Group into hazards

- Split the corridor into 5 lateral buckets (far-left, left, centre, right, far-right). For each kind × bucket, keep the count of candidate points, the nearest ahead distance, and the lateral position of that nearest point.
- A kind × bucket is a raw hit only if it has at least 6 points (rejects depth noise).
- Merge adjacent buckets of the same kind whose nearest distances are within 0.3 m into one hazard; its angle comes from its nearest point; its blocking share = merged width ÷ corridor width.
- Also flag "pole-like": an obstacle hit narrower than one bucket whose points span more than 1.0 m of height.

### Smoothing and identity

- Track hazards across updates by kind + bucket (allowing one bucket of drift per update).
- A hazard becomes active after appearing in 3 consecutive updates, and inactive after 6 consecutive updates without it.
- Distance and angle are smoothed with a short exponential average (weight 0.5 on the new value) to stop sound jitter.
- Out-of-view memory: a hazard that leaves the camera's view (off the bottom or side edge) keeps its last world position. It keeps sounding, placed from the user's current pose, until the user has passed it or 3 s go by. It deactivates early only when its position is back in view and empty. Without this, a knee-high box drops out of view at about 1 m and the warning stops right when it matters most.

### Priorities and output

- Priority: drop\_off (1) > head\_height (2) > vehicle, bike or blocked (3) > pole-like or generic obstacle (4) > person (5). Labels come from Phase 4; before that, everything uses kind only.
- Output all active hazards sorted by priority then distance. Audio uses the top 2.

### Events produced here

- `hazard_seen` once when a hazard first becomes active.
- `near_miss` once per hazard when its distance first drops below 1.0 m. Skip hazards that cover the whole corridor (blocking above 0.9, like a wall or a closed door), or every door the user walks up to becomes a near-miss.
- Both go to the event queue (Phase 9 decides whether they are sent).

### Tests (synthetic point clouds)

| Scene | Expected |
| --- | --- |
| Empty flat floor | no hazards |
| Wall 2 m ahead across full width | one centre obstacle at 2.0 m, blocking \~1.0 |
| Pole 1.5 m ahead, 0.3 m left | one obstacle, left side, pole-like |
| Board at 1.6–1.9 m height, 1.8 m ahead, nothing below | one head\_height hazard, nothing else |
| Floor ends 2 m ahead, drops 0.8 m | one drop\_off at \~2 m |
| Noisy floor with scattered single points | no hazards |
| Obstacle approaching from 3 m to 0.5 m over 3 s | active after 3 updates, one near\_miss at <1 m, never flickers |
| Open doorway, header at 2.03 m, default user height | no hazards |
| Ramp rising 8% over the corridor | no hazards |
| Box 0.4 m tall approached to 0.3 m, leaving the view at about 1 m | keeps sounding until passed |

### Done when

All tests pass, and on the phone the debug overlay correctly shows a chair, a held-up head-height board and a real step-down in a hallway.

## Phase 3: sound library and spatial audio

**Goal: every warning sound designed with ElevenLabs, processed into short mono files cached on the phone, and played from the hazard's side with a parking-sensor rhythm.**

### 3a. Build the library (script, run once, commit the output)

1. For each sound effect below, call the ElevenLabs Sound Effects endpoint three times (text prompt, 0.5–1.0 s duration, prompt influence 0.7–0.8, no loop) and save all variants.
2. For each voice clip, call Text to Speech with the chosen voice and the Flash v2.5 model.
3. Process with ffmpeg: strip leading silence, trim effects to their target length, 50 ms fade-out, convert to mono 44.1 kHz. Normalise effects by peak (−3 dBFS): loudness in LUFS can't be measured on clips shorter than 0.4 s. Normalise voice clips to about −16 LUFS. Voice clips keep their full length. Final balance between sounds comes from the gain trims, set by ear on the audition page.
4. For `edge_pulse`, `head_chime` and `tick`, also generate a loop variant (`loop: true`, which needs the `eleven_text_to_sound_v2` model) for the closest distance band.
5. Write a manifest (sound id → chosen file, duration, gain trim) to `public/sounds`.
6. Add a hidden audition page under `/walk` that plays every variant through the earbuds left/centre/right so the team picks the best one by ear.

| Sound id | Used for | Prompt | Target length |
| --- | --- | --- | --- |
| edge\_pulse | Drop-off | Deep soft sub-bass thump with a short rumble tail, clean studio recording, no reverb | 0.25 s |
| head\_chime | Head-height | Two-note descending glass chime, high then low, bright and short | 0.25 s |
| tick | Generic obstacle | Short dry wooden block tick, percussive, no reverb | 0.12 s |
| ping | Pole-like | Single tiny metallic ping, like tapping a thin steel pole, very short and dry | 0.15 s |
| bell | Bicycle / motorcycle | Quick tiny double bicycle bell ring, crisp and dry | 0.2 s |
| marimba | Person | Soft muted marimba note, warm, short decay | 0.15 s |
| buzz | Car, bus, truck | Very short low gentle horn buzz, not alarming | 0.2 s |
| taps | Blocked path | Three rapid soft taps on hollow plastic | 0.25 s |
| listening | Ask started | Gentle rising two-tone chime, friendly | 0.3 s |
| ready | App ready | Warm soft three-note rising chime | 0.8 s |
| reported | Report sent | Soft single water-drop blip | 0.2 s |
| centre\_tick | Straight-ahead marker | Very short soft click | 0.05 s |

Voice clips (one calm voice): "edge", "step down", "head", "pole", "bike", "scooter", "car", "person", "blocked", "stairs", "left", "right", "ahead", "beluga ready, tap to start", "take three slow steps", "calibrated", "hold steady", "beluga stopped", "reported", "reporting on", "reporting off", "Ask is offline. Obstacle alerts still on.", "Sorry, I couldn't see that.", "beluga works alongside your cane or guide dog. It can miss things."

### 3b. Spatial playback engine

- One AudioContext, created and resumed on the start tap. All sounds decoded to buffers at startup.
- Per active hazard (max 2 at a time): source → HRTF panner → gain → master gain. The panner uses no distance roll-off; loudness is set by the volume table, not by virtual distance.
- Placement: audio angle = hazard angle × 1.5, clamped to ±80°; the source sits 1.5 m from the listener on a frontal arc at that angle, at ear height. Never place a source behind the listener.
- Centre marker: if |angle| < 8°, also play `centre_tick` in both ears with each repeat.
- Scheduling runs on the audio clock: a 25 ms timer checks each voice and schedules the next repeat when due. Repeat interval and volume come from the distance table in "Tunable parameters". Under 0.5 m (1.0 m for drop-offs), repeat every 80 ms (effectively continuous).
- Each hazard plays one instance at a time. A new repeat cuts the one still playing with a 10 ms fade. In the closest band, a sound longer than its interval switches to its loop variant. Without this, a 0.25 s sound every 80 ms stacks three deep and turns to mush.
- Drop-offs use the table shifted one band outward (start at 3.5 m).
- Voice clip: when a hazard enters the 1.5–2.0 m band for the first time, play its word once through the same panner, subject to the 8 s cooldown per kind + side.
- Priority 1 always plays; while it plays, lower-priority voices drop by 12 dB.
- Stationary for more than 5 s: obstacle voices drop 6 dB and stop after 3 more repeats until the user moves; drop-off voices are never reduced.
- Ask playback uses the same engine at the target angle, ducked 12 dB under any hazard; a priority 1–2 hazard stops it.

### Done when

- Blindfolded on the bone-conduction earbuds, a teammate names left / centre / right correctly for at least 8 of 10 random cues.
- From an obstacle entering the corridor to the first sound takes under 0.6 s on the Bluetooth earbuds (measure by recording video with audio). 150 ms can't be reached: 3 updates at 10 Hz alone take 200 to 300 ms, and Bluetooth adds another 150 to 300 ms. Warnings start at 3 m, so at walking pace (1.4 m/s) a 0.6 s delay still leaves about 2 m.
- No clicks, pile-ups or runaway repeats after a 5-minute walk.

## Phase 4: on-device detector and frame gate

**Goal: name what the depth hazards are (so the right sound plays) and decide, sparingly, when a frame is worth sending to Gemini for civic triage.**

### Detector

- MediaPipe Tasks Vision Object Detector with EfficientDet-Lite0 (COCO), video running mode, GPU delegate with automatic CPU fallback, score threshold 0.35, up to 10 results.
- Input: the small camera frame from Phase 1 at 4 Hz. Load the model once at startup from `public/models` (cached offline).
- Self-host the MediaPipe WASM files as well (`FilesetResolver.forVisionTasks("/mediapipe/wasm")`, original file names kept). The usual examples load them from a CDN, which breaks offline.
- If the detector slows the safety loop, move it into a classic Web Worker. A module worker breaks it, because the library loads its files with `importScripts`.
- Keep only the classes listed in the detector-class enumeration; map everything else to `unknown`.
- Turn each box into an angle: box horizontal centre → (centre − 0.5) × camera horizontal field of view.

### Label matching

- For each active depth hazard, pick the detection whose angle is within ±10° of the hazard's angle and whose box touches the lower two-thirds of the frame (for obstacles) or upper half (for head-height). Highest score wins.
- Keep the label for 1 s after the detection disappears, to avoid flip-flopping.
- No match: `pole_like` if the depth hazard was flagged pole-like, else `unknown`.

| Label | Sound | Voice word |
| --- | --- | --- |
| person | marimba | none |
| bicycle, motorcycle | bell | "bike" |
| car, bus, truck | buzz | "car" |
| pole\_like, fire\_hydrant, stop\_sign | ping | "pole" |
| bench, chair, potted\_plant, suitcase, unknown | tick | none |
| any head\_height hazard | head\_chime | "head" |
| any drop\_off hazard | edge\_pulse | "edge" (or "stairs" if the last triage context was stairs) |
| Gemini said the path is blocked (Phase 5) | taps | "blocked" + side |

### Frame gate (triage runs only when reporting is on)

| Trigger | Condition | Cooldown |
| --- | --- | --- |
| New thing in the path | A hazard becomes active and stays active for ≥ 1 s | 20 s per label + side |
| Lasting obstacle | A hazard stays active while the user is stationary or steers around it (angle moves outward by > 15° while distance < 2 m) | 30 s per grid cell |
| Drop-off | A drop\_off hazard becomes active | 30 s |
| Head-height | A head\_height hazard gets closer than 1.5 m | 30 s |

Skip the frame if any is true: the phone is turning faster than 60°/s; mean brightness of the small frame is below 25/255; a triage call is already in flight; the local budget (1 call per 6 s, 150 per hour) is spent; the label is `person`, `car`, `bus` or `truck` (never reportable). Bicycles and motorcycles still go to triage: a bike or e-scooter left across the path is the main civic story, and COCO has no scooter class, so a scooter shows up as `bicycle`, `motorcycle` or nothing.

When a trigger fires, capture the larger JPEG at that moment and call `/api/triage` with the hazard, grid cell and scene hint.

### Using the triage result

- Store `context` as the current scene hint (affects the drop-off word and later triage calls).
- If `report` is true and consent is on, and this session hasn't already reported the same category in the same grid cell in the last 15 minutes, add a `civic_report` event and play `reported` (if enabled).
- If category is `sidewalk_obstruction` or `construction_barrier` and blocking > 0.6, switch that hazard's sound to `taps` / "blocked".

### Done when

- Labels show correctly in the overlay for a person, a bike and a chair at 1–3 m.
- Walking a 2-minute route with 4 staged hazards produces 4–6 triage calls, not dozens.
- With the detector running, the safety loop still holds \~10 updates per second.

## Phase 5: backend — Gemini triage, Ask, ElevenLabs voice

**Goal: two backend routes that turn one camera frame into a validated civic decision or a spoken answer, with strict limits on time, cost and privacy.** Frames are never logged or stored.

### Gemini and the database

Gemini never connects to Tiger Data, and needs no MCP server or tools. It is one step in the middle: a frame and a note go in, validated JSON comes out. The backend route does all database work with plain SQL: the 15-minute dedup check and the budget count in `/api/triage`, then the insert later through `/api/events`.

- Faster: a tool call adds at least one more Gemini round trip, and triage has 6 s.
- Safer: text in a camera frame (a sign, a sticker) can steer a model. With no tools, the worst it can do is return a bad answer, and the backend rule still decides.

MCP suits apps and agents that find their tools at runtime. The backend knows exactly which queries it runs, so it calls them directly. Tiger Data's MCP server is still handy for the team's coding agents, to look at the database while building; it is never part of the app. The one place where Gemini reads the database is the optional "Ask the data" stretch in Phase 7.

### Shared rules for both routes

- Node runtime. Reject frames over 400 KB or not JPEG.
- Call Gemini with a system instruction, the image, a short text part, JSON response type and a response schema.
- Leave temperature at the default 1.0. Google says values below 1.0 on Gemini 3 models can cause looping or worse output.
- Set `thinking_level` to `minimal`. Flash defaults to `high`, which costs seconds on every call.
- Set `media_resolution` to `medium` (560 tokens per image) for triage. Try `high` for Ask if answers miss small things.
- Before any text is returned or spoken, check it for crossing advice ("safe to cross", "you can cross", "okay to cross", "clear to cross", "go ahead and cross"). Replace a match with "I can't judge traffic. Cross the way you normally do." This backs up rule 7 when the model ignores its prompt.
- Validate the JSON against the same schema on the backend; on invalid output, retry once, then fail safe (triage: report = false; Ask: cached apology).
- Timeouts: triage 6 s, Ask 8 s end to end.
- Log only: route, model, latency, outcome, category. Never the image or the description of people.
- Gemini's box format is four integers, top, left, bottom, right, scaled 0–1000.

### `/api/triage`

System instruction (use this wording):

> You are the civic triage step of beluga, an app used by blind and low-vision pedestrians together with a white cane or guide dog. You see one forward-facing chest-height photo and a short note about the hazard the phone detected. Say what the hazard is and answer questions about it. You do not decide whether it is reported or how severe it is. Pick the category from this list, or none: sidewalk\_obstruction (scooter, bike or object left across the walking path), construction\_barrier, head\_height\_hazard (sign, branch, awning sticking out between 0.68 m and 2.1 m high, with nothing below for a cane to hit), surface\_damage (hole, broken curb, heaved slab), blocked\_curb\_cut, tactile\_strip\_issue (missing, worn or covered warning strip at a platform edge, the top of stairs, or a curb ramp at a crossing), snow\_ice, other\_fixed. People, vehicles in the road, animals and things being carried are always none. Then answer: is the place open to the public; is the thing left or fixed in place, and not moving, held or in use; how much path is left to get past it (clear: 1.5 m or more, about two people side by side; narrow: less; none); is there a warning a cane or foot can find, such as a solid barrier with a rail or edge at or below 0.68 m, or an intact tactile strip; is there a lip, hole, trench or drop that can catch a foot. If unsure, lower your confidence. Describe only what is visible in 15 words or fewer. Never mention faces, licence plates or anything that identifies a person. Never say a road is safe to cross. Also classify the scene context. Return JSON only.

Text part: the phone's note, e.g. "Hazard: head\_height, 1.6 m ahead, 10° right, blocking 0.3, detector label unknown, scene hint sidewalk."

Schema fields: category (enum, including none), isPublic, leftOrFixed, wayAround (enum), caneWarning, tripOrDrop, confidence, description, context, box (nullable). Enums in the schema keep the category inside the list.

Backend decision (overrides the model): the backend works out severity from the category table in "What gets reported", then sets report to true only if all four tests pass, the category is not none, and confidence is at least 0.7 (0.85 for `other_fixed`). Also false if the same device hash reported the same category in the same grid cell in the last 15 minutes (checked in the database), or if the hourly budget is spent.

Hourly budget: a tiny `api_budget` table (hour, route, count) incremented per call; refuse triage above `GEMINI_HOURLY_BUDGET`. Ask gets its own row in the same table and stops at `ASK_HOURLY_BUDGET`; past it, the phone speaks the offline line.

### `/api/ask`

System instruction:

> You are beluga's describe-the-scene helper for a blind or low-vision pedestrian. Answer the user's question about one forward-facing chest-height photo in at most two short sentences, the most safety-relevant thing first, using left, right or straight ahead and rough metres. If your answer is about one main object, return its box. For traffic or walk signals say only what the signal appears to show; never say it is safe to cross. Never describe people's faces or identities. Return JSON only.

Schema fields: answer, target label (nullable), box (nullable).

Then call ElevenLabs Text to Speech with the answer, the configured voice and Flash v2.5, MP3 output. Send the whole file back as the response body, with answer, label and box in response headers (see the Ask contract). If ElevenLabs fails, return the JSON with a voice-failed flag; the phone speaks the cached apology.

### Test set (commit it under `docs/test-frames`)

Take 10–12 photos at chest height around the venue and campus: scooter across a sidewalk, construction barrier, head-height sign, broken curb, a person walking, a parked car in the road, an empty hallway, stairs going down, a platform-like edge with yellow strip. The repo is public, so the only people in them are teammates who agreed, and no strangers' faces or licence plates show.

| Photo | Expected triage |
| --- | --- |
| Scooter across sidewalk, room to pass | report, sidewalk\_obstruction, severity 2 |
| Scooter across the whole sidewalk | report, sidewalk\_obstruction, severity 3 |
| Head-height sign | report, head\_height\_hazard, severity 3 |
| Construction area marked with tape only | report, construction\_barrier, severity 3 |
| Someone riding a scooter | no report (not left or fixed) |
| Person walking | no report |
| Car in the road | no report |
| Empty hallway | no report |
| Edge with yellow strip intact | no report (context platform) |

### Done when

The test set matches expectations, triage returns in under \~3 s and Ask audio starts playing on the phone in under \~3 s on venue Wi-Fi.

## Phase 6: Tiger Data schema, aggregates, event intake

**Goal: a Tiger Cloud database where events land in a hypertable and four continuous aggregates in real-time mode keep every dashboard number pre-computed.** Setup lives in ordered migration files run by one command.

### Migrations, in order

| # | Creates | Details |
| --- | --- | --- |
| 001 | Extensions | PostGIS on; TimescaleDB is already present |
| 002 | `stations` | station id (text, primary key), name, location (geography point). Insert uOttawa 45.4205 −75.6828, Rideau 45.4265 −75.6920, Parliament 45.4215 −75.6990, Lyon 45.4190 −75.7040, Hurdman 45.4125 −75.6645 (approximate; check against OC Transpo's stop list) |
| 003 | `hazard_events` hypertable | Columns below; partitioned by time in 1-day chunks |
| 004 | Indexes | (cell, time desc), (station id, time desc), (civic category, time desc), (event kind, time desc), spatial index on location |
| 005 | Compression + retention | Columnstore (compression) on chunks older than 7 days, grouped by cell, ordered by time descending; delete raw chunks older than 180 days. If the service's version uses the older compression settings/policy names, use those equivalents |
| 006 | `cell_15m` aggregate | See aggregates table |
| 007 | `cell_daily` aggregate | Built on top of `cell_15m` |
| 008 | `station_hourly` aggregate |  |
| 009 | `cell_reporters_daily` aggregate |  |
| 010 | `fix_first` view | Ordinary view over the aggregates computing the score |
| 011 | `api_budget` | hour, route, count (primary key hour + route) |
| 012 | `perf_snapshots` | taken at, raw ms, aggregate ms, compressed bytes, uncompressed bytes, total rows, seed load seconds, notes |

### `hazard_events` columns

| Column | Type | Notes |
| --- | --- | --- |
| time | timestamptz, not null | Partitioning column |
| device\_hash | text | Civic reports only: HMAC-SHA256 of the phone's device key with `DEVICE_HASH_SALT`, first 16 hex characters. Null on other events. No session id column |
| event\_kind | text, not null | hazard\_seen / near\_miss / civic\_report |
| hazard\_kind | text, not null | obstacle / head\_height / drop\_off |
| detector\_class | text, not null |  |
| civic\_category | text | civic reports only |
| severity | smallint | 1–4, civic reports only |
| confidence | real | civic reports only |
| description | text | ≤ 15 words, civic reports only |
| closest\_m | real, not null |  |
| angle\_deg, heading\_deg | real |  |
| lat, lon | double precision, not null | Rounded to 3 decimals |
| cell | text, not null | 7-character geohash |
| station\_id | text, references stations |  |
| context | text |  |
| source | text, not null, default live | live / simulated |
| consent\_version | smallint, not null |  |
| location | geography point | Generated from lat/lon, stored |

### Continuous aggregates

All four are created, switched to real-time mode (so the newest, not-yet-materialised events are included in reads), and given refresh policies. Aggregates must not use joins or non-deterministic functions; joins happen in the view.

| Aggregate | Bucket | Group by | Measures | Refresh policy |
| --- | --- | --- | --- | --- |
| `cell_15m` | 15 minutes | cell, civic category (or hazard kind when null), source | events, near-misses, civic reports, worst severity, closest distance | every 1 min, covering the last 3 days, up to 1 min ago |
| `cell_daily` | 1 day (stacked on `cell_15m`) | same | sums of counts, max severity, min closest | every 15 min, covering the last 30 days |
| `station_hourly` | 1 hour | station, hazard kind, source | near-misses, civic reports, events | every 1 min, covering the last 3 days |
| `cell_reporters_daily` | 1 day | cell, civic category, device hash, source | reports per device | every 5 min, covering the last 30 days |

- A cell's position is its geohash centre, worked out at read time with `ST_PointFromGeoHash(cell)`. The aggregates hold no positions: an average of averages in the stacked aggregate would be wrong.
- Buckets are in UTC. The dashboard shows local time (UTC-4 in September), and the seed's rush hours are set in `America/Toronto`.
- Refresh `cell_15m` before `cell_daily` whenever refreshing by hand.

### `fix_first` view

For each cell × civic category over the last 14 days (from `cell_daily`, civic reports > 0), joined to reporter counts (distinct device hashes from `cell_reporters_daily`) and the nearest station:

| Part | Formula |
| --- | --- |
| Severity weight | worst severity 1 → 1, 2 → 2, 3 → 4, 4 → 8 |
| Reporters | log2(1 + distinct reporters) |
| Near-miss pressure | 1 + log10(1 + near-misses in that cell), so 9 near-misses give 2 and 99 give 3. A straight ÷ 10 lets crowding outrank severity: the seed puts hundreds or thousands of near-misses in one cell |
| Recency | 1.5 if last report within 48 h, else 0.5 ^ (days since last report ÷ 7) |
| Transit | 1.3 if within 150 m of a station, else 1 |
| **Score** | product of the five |

Only rows with at least 3 distinct reporters are returned (k-anonymity). Severity 4 goes to the separate "Check now" list instead (see "What gets reported"). The view also returns each part, the station name and a place label ("near Rideau" or the cell).

### `/api/events` intake

1. Validate the batch against the event contract; reject the whole batch if consent version is missing. Drop events with `ts` more than 7 days old or more than 5 minutes in the future.
2. Round lat/lon to 3 decimals again; recompute the cell from them; drop any civic fields on non-civic events.
3. Turn device keys into device hashes on civic reports only; never store the raw key.
4. Fill station id when missing: nearest station within 150 m by PostGIS distance.
5. Insert all rows in one multi-row statement with source = live. Return accepted and rejected counts.

The free service has no connection pooler, and every request can land on a fresh function. Keep one postgres.js client per function instance (module scope, `max: 2`, idle timeout about 20 s).

### Done when

- Migrations run cleanly on a fresh service from one command.
- Posting a test batch makes those events appear in all four aggregates immediately (real-time mode) and in the materialised data within a minute.
- The `fix_first` view returns a ranked row after three different device keys report the same cell and category.

## Phase 7: city dashboard

**Goal: `/map` on the team's domain, where a planner sees, at a glance, what to fix first and why, every view reading from continuous aggregates.**

### Layout (desktop first, readable on a laptop at the demo table)

| Area | Content |
| --- | --- |
| Header | "beluga for cities"; time window (1 h / 24 h / 7 d / 14 d); category filter; source toggle (Live / Simulated / Both); a yellow banner "Demo data: simulated events for illustration, not real incidents" whenever simulated rows are included |
| Left column | **Check now** list on top (severity 4, cell and day only), then the **Fix-first queue** table: rank, place, category, who fixes it, severity, reporters, near-misses, last seen, score, and a "why" line built from the score parts (e.g. "Severity 3 × 6 reporters × 20 near-misses × seen yesterday × near Rideau") |
| Right column | **Map** of Ottawa centred on the five stations: cells as squares (their geohash bounds) coloured by score (or by event count when no reports), station markers, click a cell for a detail card |
| Below | **Station panels**: hourly near-misses over 7 days per station (small line charts) and an hour-of-day bar chart for the selected station |
| Below | **Live feed**: last 20 civic reports with time, category, severity, description, place, source badge |
| Footer panel | **Performance**: raw vs aggregate query time for the same 7-day question, compression ratio, total rows, seed load time, and a "Measure again" button |

### Behaviour

- Poll the feed and queue every 5 s; cells and stations every 15 s; performance only on load and on button press.
- Clicking a queue row flies the map to that cell and opens its card; clicking a cell highlights its queue row.
- New live reports flash briefly in the feed and on the map, so the judge's own report is visible during the demo.
- Map: MapLibre with OpenFreeMap's no-key `liberty` style. Draw each cell as a MapLibre fill layer square from its geohash bounds. Skip deck.gl: its HexagonLayer bins points again after the database already binned them into cells, so its hexagons would not match the queue. Load MapLibre through a client-only dynamic import.
- Colours: a single sequential scale for score that stays readable for colour-blind viewers; severity also shown as a number, never colour alone.
- The queue is a real HTML table with headers; keyboard navigable.

### `/api/dashboard/perf` measurement

- Run the same question twice: "events and near-misses per cell over the last 7 days" from the raw hypertable, and from `cell_15m`. Time each with the database's own execution timing (explain-analyse style), not network time.
- Read the compression statistics for `hazard_events` (compressed vs uncompressed bytes) and total row count.
- Store the result in `perf_snapshots` and return the latest.

### Stretch: ask the data

Build only if the tracks are ahead at the 23:00 cut check. A planner types a question into the dashboard ("Which station had the most near-misses this week?"), and Gemini answers in one or two sentences.

- Gemini uses function calling with four fixed functions that wrap the existing dashboard queries: queue, cells, stations and feed, each with typed filters (time window, category, station, source).
- No free-form SQL. The functions run on a read-only database role (`DATABASE_URL_READONLY`).
- The answer lists which functions it called, so judges see Gemini and the continuous aggregates working together.

### Done when

With seed data loaded, every panel renders in under a second, filters work, and a live event posted from the phone appears in the feed and on the map within 5–10 s.

## Phase 8: seed data and performance panel

**Goal: 14 days of believable, clearly labelled simulated activity around five O-Train stations, so the aggregates, compression and fix-first queue have something real to show.** Fourteen days, not seven, so that the older week is old enough for the 7-day compression policy to apply naturally.

### Generator rules

| Station | Story to simulate |
| --- | --- |
| uOttawa | Evening e-scooter clusters on campus sidewalks (sidewalk\_obstruction, severity 2–3) |
| Rideau | Rush-hour crowding and platform-edge near-misses (drop\_off near-misses; a few tactile\_strip\_issue reports, severity 4) |
| Parliament | Head-height signage and hoarding near entrances (head\_height\_hazard, severity 3) |
| Lyon | Weekday construction barriers 07:00–18:00 (construction\_barrier, severity 2–3) |
| Hurdman | Transfer-platform edge near-misses at bus/rail peaks |

- **Volume:** 300–500k rows total; 50–200 simulated sessions per station per day, each lasting 5–20 minutes.
- **Time profile:** peaks 07:00–09:00 and 16:00–18:00 local time, weekday-heavy, quiet 00:00–05:00.
- **Mix per session:** mostly hazard\_seen and near\_miss; civic reports at 1–3% of events, concentrated on 8–15 recurring spots per station so the queue ranks a few dozen places rather than thousands.
- **Reporters:** simulated device keys drawn from a pool (\~400 per station) so recurring spots collect 3–20 distinct reporters.
- **Places:** drop-off events within \~20 m of each station point; sidewalk hazards scattered within \~400 m; all coordinates rounded to 3 decimals, cells computed the same way as live data.
- **Labelling:** every row has source = simulated.
- **Severity:** the generator picks the yes/no answers for each story and calls the same `lib/shared/reporting` rules, so seeded severities match live ones.
- **Determinism:** seeded random generator so reruns produce the same data.

### Loading

1. Write rows as CSV and bulk-load with the database's copy mechanism; record the elapsed seconds.
2. Manually refresh all four aggregates for the full 14-day range.
3. Run the compression policy job once (or compress eligible chunks directly) so chunks older than 7 days are compressed now.
4. Take a performance snapshot (Phase 7 measurement) and store the load time in it.
5. Provide a "reset" command that deletes simulated rows only, reloads, and refreshes the aggregates. Check the database size before each reload: the free service turns read-only at 750 MB.

### Done when

The dashboard shows a populated map, a fix-first queue topped by recognisable stories (e.g. a Rideau tactile strip, a Parliament sign), station trends with clear rush-hour peaks, a compression ratio well above zero, and an aggregate query that is visibly faster than the raw one.

## Phase 9: consent, privacy, installable app, accessibility

**Goal: beluga installs to the home screen, runs offline for warnings, never sends anything without consent, and is fully usable by someone who cannot see the screen.**

### First-run flow (spoken and on screen, screen-reader friendly)

1. "beluga works alongside your cane or guide dog. It can miss things."
2. Reporting choice, one large button each: "Help the city: share anonymous hazard reports" / "Not now". Explain in one sentence each: what is sent (hazard type, distance, rough location within about 100 metres, time) and what is never sent (images, audio, exact location, identity). Default is off.
3. Location permission prompt, with one sentence on why (reports and station). It is asked here because prompts may not show inside AR.
4. "How tall are you?" in 5 cm steps, default 1.85 m. Sets the head-height top.
5. "Put the phone on your chest mount, camera facing forward, then tap anywhere to start."
6. After start: "Take three slow steps" → calibration → "calibrated".

Store consent (on/off + consent version number) on the phone; changeable any time in settings, which speak "reporting on" / "reporting off".

### On-phone event queue

- Events are always recorded locally (for the debug overlay) but sent only when reporting is on.
- Batches every 10 s or at 50 events, whichever first; persisted to on-phone storage so nothing is lost if the network drops or the app closes; retried with backoff when back online.
- Coarsen before queueing: lat/lon to 3 decimals, cell from the coarsened values.
- Device key: random, created once, stored on the phone; session id: new per launch and at midnight.

### Location

- Watch position with high accuracy. If accuracy is worse than 100 m or no fix arrives for 30 s (typical underground), keep the last good coarse position and the station chosen when the session started (settings offer the five stations plus "on the street").
- With no good fix at all yet (indoors at the venue), use the chosen station's position. Otherwise events have no location, the backend rejects them, and the demo report never shows up.
- Heading from device orientation, smoothed.

### Installable app and offline

- Manifest: name and short name "beluga", full-screen display, orientation picked by the Phase 0 field-of-view test (portrait unless landscape wins), dark theme colours, maskable icons (a simple beluga silhouette, 192 and 512 px), start URL `/walk`.
- Service worker: a hand-written `public/sw.js` (the Next.js PWA plugins add more trouble than they save). Pre-cache the app shell, all sound files, the sound manifest, the detector model and the MediaPipe WASM files; network-only for `/api/*`; the landing page and dashboard use normal network-first caching.
- Offline behaviour: Walk works fully; Ask speaks "Ask is offline. Obstacle alerts still on."; triage is skipped; events wait in the queue.

### Controls during a session

- Screen taps inside the AR session arrive as XR select events, and taps on DOM-overlay elements arrive as normal DOM events; handle both. Call `preventDefault()` in `beforexrselect` on the overlay buttons, so a button tap doesn't also fire an XR select.
- The overlay is two large DOM buttons: "Ask" (top two-thirds) and "Stop" (bottom third, long press, so a brush against the chest doesn't end the session). A click on Ask starts Ask. With TalkBack on, TalkBack takes raw taps (touch to focus, double-tap to activate), so a custom double-tap never reaches the page; a button click works both ways. An accidental Ask only costs a spoken answer.
- Three-finger tap → debug overlay, for sighted testers only (TalkBack keeps multi-finger gestures for itself).
- Stretch: Ask from the headset's play/pause button through the Media Session API. Chrome only routes the button to a page that is playing an `<audio>` element (Web Audio alone doesn't count), so this needs a silent looping `<audio>` running during the session.
- All buttons have accessible names, at least 64 px tall, high contrast; nothing depends on colour alone.
- Settings (outside the session): reporting on/off, "reported" sound on/off, optional alive tick every 30 s, master volume, starting station, height, debug overlay default.
- Debug settings: "New demo reporter" makes a fresh device key. The backend drops a second report of the same category in the same cell from the same device for 15 minutes, so without this the second judge's staged report silently disappears.

### Done when

- Installed from Chrome, launches full-screen from the home screen.
- With TalkBack on, a teammate with eyes closed can complete first run, start a session and stop it.
- In airplane mode, a session starts and warns; events queued offline upload after reconnecting.
- With reporting off, no request reaches `/api/events` or `/api/triage` (check the network log).

## Phase 10: domain, demo hardening, offline and replay modes

**Goal: the demo works on the team's domain, on flaky Wi-Fi, on an awkward floor, and even if live depth misbehaves.**

### Domain

- Attach the team's GoDaddy Registry domain to the Vercel project (apex + `www`), and add a `map.` subdomain that rewrites to `/map`. Copy the DNS records Vercel shows into the registrar. Start this in Phase 0; DNS can take hours.
- Landing page (`/`): beluga name and one-line pitch, three links (Try beluga → `/walk`, City dashboard → `map.` subdomain, Source code → GitHub), the disclaimer, and a short "how it works" with the sponsor stack.
- Keep the Vercel address working as a backup link.

### Replay mode (backup for tests and the demo)

- Recorder: in a session, a debug toggle records 30 s of processed inputs: the world points (already sampled), camera pose, floor height, walking direction and detector results per update, plus a few small frames. Save as a compressed JSON file downloadable from the phone. Clips committed to the public repo hold no frames with bystanders in them.
- Player: `/walk?replay=<file>` feeds a recording into the hazard engine and audio engine without an AR session, at real time. Use it for Phase 2 regression tests and as a live demo fallback on any phone.
- Record at least three clips before the freeze: chair approach, head-height sign, step-down edge.

### Depth-free fallback (only if the demo phone loses depth)

- A settings switch "camera-only mode": no depth; hazards come from detector boxes only; distance estimated from box height for people (assume 1.7 m tall) and from box bottom position for ground objects; no drop-off detection. The overlay says "camera-only mode" and the pitch says depth-capable phones get edge warnings.

### Stretch: tactile-strip detector

- In the lower third of the small frame, count pixels in a bright safety-yellow colour range. A wide horizontal band covering more than \~8% of that region for 3 updates raises a drop\_off-priority warning labelled "edge" with an estimated distance from the band's position (using the floor plane). Makes a taped edge detectable; always shown as a secondary signal.

### Demo setup

The phone sits on the chest with its screen facing the wearer, and the sounds play in the wearer's earbuds. Nobody else sees or hears anything unless the demo is set up for it.

- Mirror the phone to the laptop with `scrcpy` over USB. It carries the screen and, on Android 11 and up, the audio, so judges watch the debug overlay and hear the sounds from the laptop speakers.
- Bring a second pair of bone-conduction earbuds for the judge. They sit outside the ear, so handing them over is quick.
- Keep the replay player open on the laptop, ready if live depth fails.
- Tap "New demo reporter" before each staged report.
- Optional, labelled: seed the demo spot's cell with 2 simulated reporters for the staged category. The judge's live report is the third, so the spot jumps into the fix-first queue on screen. The row shows "includes simulated".
- Phone on a battery pack between demos. Record the backup demo video by 06:00, while people are still awake enough to redo it.

### Hardening checklist

- [ ] Blindfold tests only with a sighted spotter, indoors, away from stairs and roads. Edges are staged (a single step or a taped line), never a real platform edge or curb.
- [ ] 15-minute continuous session: no crash, no audio drift, phone temperature acceptable, battery drop noted
- [ ] Airplane mode: warnings work; Ask speaks the offline line; queue flushes later
- [ ] Venue Wi-Fi slow: Ask and triage time out gracefully
- [ ] Glass door, dark floor, shiny floor tested; known-good demo spot picked
- [ ] Second phone has beluga installed and signed in to nothing (no secrets needed)
- [ ] Three replay clips recorded and playable

## Phase 11: README and submission assets

**Goal: a README a judge can skim in two minutes that proves each sponsor integration with links to the exact files, plus the screenshots and numbers the Devpost page needs.**

### README sections, in order

1. **beluga** — one-line pitch, the echolocation hook, and the disclaimer (research prototype, not a medical device, works alongside cane or guide dog).
2. **Demo** — video link, domain link, dashboard link.
3. **How it works** — the two-speed architecture (on-phone safety loop vs slower cloud paths) as a short diagram image plus five bullets.
4. **Tiger Data** — the hypertable, the four continuous aggregates (with bucket and refresh), the stacked aggregate, compression and retention as privacy tools, the fix-first score formula, and a screenshot of the performance panel with real numbers. Link to the migrations folder.
5. **Gemini** — the triage rubric, the backend decision rule, the frame gate and budget, Ask with boxes turned into sound direction. Link to the prompts and schema files.
6. **ElevenLabs** — the sound library table (id, use, prompt, length), how files were processed, and the live Flash v2.5 Ask voice. Link to the sound script.
7. **Domain** — the GoDaddy Registry domain and what it serves.
8. **Privacy** — consent default off, what is and isn't sent, coarsening, rotating ids, k-anonymity, 180-day deletion, simulated data labelling.
9. **Run it yourself** — accounts needed, environment variables, migrations, seed, sound generation, deploy, and "open `/walk` in Chrome on an ARCore-depth Android phone".
10. **Limitations and next steps** — depth needs motion and a supported phone; bone conduction limits; no blind users co-designed this version yet; next: co-design with CNIB, a pilot with OC Transpo.
11. **Licence** — MIT.

### Assets to produce

- Screenshots: phone in Walk mode with debug overlay, fix-first queue, map, station panel, performance panel, consent screen.
- A 20-second screen recording of a live report appearing on the dashboard.
- The final numbers: rows loaded, load seconds, raw vs aggregate milliseconds, compression ratio, average triage and Ask latency.
- Built-with list: webxr, arcore, chrome, android, pwa, web-audio, mediapipe, gemini-api, elevenlabs, tiger-data, timescaledb, postgresql, postgis, next.js, vercel, maplibre, godaddy-registry.

### Done when

The repo is public, the README renders with working links and images, no secret appears anywhere in the history, and the latest deploy matches the latest commit.

## Tunable parameters

**Every number below lives in the shared parameters module with these defaults; tune on the phone, not in scattered code.**

### Sensing and hazards

| Parameter | Default |
| --- | --- |
| Processing rate | 10 updates/s |
| Depth sample grid | 48 × 36 |
| Valid depth range | 0.2–5.0 m |
| Corridor half-width | 0.45 m |
| Corridor ahead range | 0.3–3.0 m (drop-off 3.5 m) |
| Floor band | −0.25 to +0.15 m |
| Obstacle band | 0.15–1.4 m above floor |
| Head-height band | 1.4 m up to the user's height + 0.1 m (default 1.95 m) |
| Floor line slope clamp | ±10% |
| Out-of-view memory | until passed, at most 3 s |
| Travel-direction blend | above 0.3 m/s, weight 0.5 |
| Drop-off threshold | more than 0.25 m below floor |
| Lateral buckets | 5 |
| Minimum points per hit | 6 |
| Merge distance for adjacent buckets | 0.3 m |
| Pole-like | narrower than one bucket, height span > 1.0 m |
| Activate / deactivate | 3 updates on / 6 updates off |
| Smoothing weight | 0.5 |
| Near-miss distance | 1.0 m |
| Stationary | < 0.1 m moved in 5 s |
| Tracking-lost threshold | 1 s |

### Audio

| Distance ahead | Repeat every | Volume |
| --- | --- | --- |
| more than 3.0 m | silent | — |
| 2.5–3.0 m | 700 ms | −12 dB |
| 2.0–2.5 m | 500 ms | −9 dB |
| 1.5–2.0 m | 350 ms | −6 dB |
| 1.0–1.5 m | 220 ms | −3 dB |
| 0.5–1.0 m | 120 ms | 0 dB |
| under 0.5 m | 80 ms (continuous) | 0 dB |

Drop-offs: same table shifted one band outward (start 3.5 m, continuous under 1.0 m).

| Parameter | Default |
| --- | --- |
| Angle exaggeration / clamp | ×1.5 / ±80° |
| Source distance on the arc | 1.5 m |
| Centre marker zone | ±8° |
| Max simultaneous hazard sounds | 2 |
| Lower-priority duck | −12 dB |
| Stationary reduction | −6 dB, stop after 3 repeats (never for drop-offs) |
| Voice clip trigger | entering 1.5–2.0 m band |
| Voice clip cooldown | 8 s per kind + side |
| Scheduler tick | 25 ms |
| Alive tick (optional) | every 30 s |

### Detector, gate and network

| Parameter | Default |
| --- | --- |
| Detector input / rate | 320 × 240 / 4 Hz |
| Detector score threshold | 0.35 |
| Label match window | ±10°, label held 1 s |
| Gemini frame size | ≤ 768 px long edge, JPEG 0.7, ≤ 400 KB |
| Gate: new thing | active ≥ 1 s, 20 s cooldown per label + side |
| Gate: lasting obstacle / drop-off / head-height | 30 s cooldown each |
| Gate: skip if turning faster than | 60°/s |
| Gate: skip if brightness below | 25/255 |
| Phone budget | 1 triage per 6 s, 150 per hour |
| Backend hourly budget | 150 triage calls, 120 Ask calls |
| Report thresholds | four tests pass, confidence ≥ 0.7 (0.85 for `other_fixed`) |
| Check now list | severity 4, cell and day only, no reporter minimum |
| Report dedup | same device + cell + category within 15 min |
| Timeouts | triage 6 s, Ask 8 s |
| Stop long press | 600 ms |
| Event batch | every 10 s or 50 events |
| Coarsening | 3 decimal places (\~100 m); geohash 7 characters |
| Station snap radius | 150 m |

### Database and dashboard

| Parameter | Default |
| --- | --- |
| Chunk size | 1 day |
| Compress after | 7 days |
| Delete raw after | 180 days |
| k-anonymity | ≥ 3 distinct reporters |
| Fix-first window | 14 days |
| Dashboard polling | feed + queue 5 s; cells + stations 15 s |
| Seed | 14 days, 300–500k rows, seeded random |

## Fallbacks, cut list and final acceptance

**If time runs short, cut from the top of the cut list down; never cut anything in the acceptance checklist.**

### Fallbacks by failure

| If this fails | Do this |
| --- | --- |
| Demo phone has no WebXR depth | Borrow an ARCore-depth phone; else camera-only mode (Phase 10) and say so |
| Camera access not granted inside AR | Use depth-only sounds and disable Ask and triage (no frames to send); warnings still work. Say so in the limitations |
| Detector too slow | Drop to 2 Hz, then disable; depth-only sounds |
| HRTF panning sounds weak on bone conduction | Increase angle exaggeration to ×2; add a small left/right level difference on top |
| Gemini quota runs out | Switch to the billing-enabled key (env var only); raise gate cooldowns |
| ElevenLabs down during Ask | Cached apology line; sounds unaffected (pre-generated) |
| Tiger free service hits a limit | Trial service; change `DATABASE_URL`; re-run migrations and seed |
| Continuous aggregate features differ by version | Keep the same four aggregates; use the older compression names; if stacking fails, build `cell_daily` from the hypertable directly and say so |
| Domain not resolving | Use the Vercel address everywhere; keep trying DNS |
| Camera access and DOM overlay won't run together | Keep camera access. Drive the session with XR select events and spoken state; read debug info through remote debugging or `scrcpy` |
| Warnings arrive too late on Bluetooth | Activate hazards under 1.5 m after 2 updates; demo on wired earbuds or the phone speaker if needed |
| Tracking keeps dropping on the strap | Rigid chest mount, phone taped level; walk the demo slower |
| Phone overheats at the demo table | Detector to 2 Hz, debug overlay off, session stopped between demos |
| Vercel build queue lags or hits 100 deploys a day | Docs-only commits skip the build (Vercel "Ignored Build Step"); test on `localhost` over `adb reverse` |

### Cut list (cut from the top down)

1. Ask the data (dashboard stretch)
2. Tactile-strip detector
3. Headset-button Ask
4. Camera-only mode (build it only if Phase 0 shows no depth)
5. Service worker. A session opened while online keeps warning in airplane mode, because the sounds and model are already in memory. What is lost: starting the app with no network at all
6. Replay mode player UI (keep the recorder)
7. Hour-of-day chart on the dashboard
8. Station trend panels
9. "Blocked path" sound switching
10. Detector labels (depth-only sounds)

### Final acceptance checklist (all must pass by 02:00)

- [ ] Phone: installed app starts a session from one tap, calibrates, and stays silent in an empty hallway
- [ ] Phone: chair, head-height board and a real step-down each produce the right sound from the right side, speeding up on approach
- [ ] Phone: Ask speaks an answer from the object's direction in under \~3 s
- [ ] Phone: warnings still work in airplane mode
- [ ] Phone: with reporting off, nothing is sent; with it on, a staged scooter produces a civic report
- [ ] Database: migrations, compression and retention policies, four real-time continuous aggregates, fix-first view
- [ ] Dashboard: queue, map, feed and performance panel populated; simulated banner visible; the live report appears within \~10 s
- [ ] Domain serves the landing page and the dashboard over HTTPS
- [ ] README complete; no secrets in the repo; licence present
- [ ] Three replay clips and a backup demo video recorded
