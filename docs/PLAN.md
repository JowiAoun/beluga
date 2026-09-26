# beluga implementation plan

## Context

**beluga is an installable web app for Android (Chrome) that warns blind and low-vision pedestrians about obstacles with directional sounds, and turns lasting hazards into a ranked fix-first dashboard for the city.** It is built for Hack the Hill III (uOttawa, Ottawa). Build phases in order; each phase ends in something demonstrable, so the project is always submittable.

### The product in one paragraph

The user wears the phone on a chest lanyard (camera forward) and bone-conduction earbuds (ears stay open to traffic). beluga runs a WebXR augmented-reality session in Chrome that uses ARCore depth to measure distance to everything in front of the user. It stays silent until something enters a narrow walking corridor, then plays a short sound placed on the hazard's side that repeats faster as the user gets closer. Head-height obstacles and drop-offs (platform edges, stairs down) have their own distinct sounds. A double-tap sends one camera frame to Gemini, and the answer is spoken with an ElevenLabs voice from the direction of the object described. When the user meets a lasting civic hazard (a scooter left across the sidewalk, a construction barrier, a head-height sign), Gemini decides whether to report it; with consent, an anonymous, coarsened report is stored in Tiger Data, where continuous aggregates drive a live fix-first map and ranked queue for the City of Ottawa and OC Transpo.

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
| Dashboard map | MapLibre GL JS with a free vector/raster basemap, deck.gl HexagonLayer over it | No paid map keys |
| Dashboard charts | Lightweight SVG charts or Recharts | Small line charts and a bar chart |
| Build-time scripts | Node scripts run locally | Sound generation, seed data |
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

## Accounts, secrets and environment

**Four external services, each reached only from the backend, configured through environment variables set in Vercel and in a local untracked env file.**

| Variable | Used by | Value / source |
| --- | --- | --- |
| `DATABASE_URL` | Backend, seed script, migrations | Tiger Cloud service connection string (SSL required) |
| `GEMINI_API_KEY` | Backend | Google AI Studio key |
| `GEMINI_TRIAGE_MODEL` | Backend | Current Flash-Lite model id (check AI Studio; do not use 2.5 models) |
| `GEMINI_ASK_MODEL` | Backend | Current Flash model id |
| `ELEVENLABS_API_KEY` | Backend, sound script | ElevenLabs account with event credits applied |
| `ELEVENLABS_VOICE_ID` | Backend, sound script | One calm, clear English voice chosen once and used everywhere |
| `ELEVENLABS_TTS_MODEL` | Backend | `eleven_flash_v2_5` |
| `DEVICE_HASH_SALT` | Backend | Random string; rotating it weekly is what rotates device hashes |
| `GEMINI_HOURLY_BUDGET` | Backend | Default 150 triage calls per hour across all devices |
| `DASHBOARD_SHOW_SIMULATED` | Dashboard | Default true (demo); the toggle still works |
| `NEXT_PUBLIC_SITE_NAME` | Everywhere | `beluga` |

### Service setup notes

- **Tiger Cloud:** free service (no card, up to 2 per account, us-east-1, shared CPU; turns read-only at its storage limit). Enable the PostGIS extension. If a free-service limit blocks a needed feature, create a 30-day trial service instead and change only `DATABASE_URL`.
- **Gemini:** check the project's real per-model daily limits in AI Studio before building the gate; they vary widely. Keep a second key with billing enabled as a backup, swappable by env var only.
- **ElevenLabs:** apply the event credit code before generating sounds; sound effects and TTS both draw on it.
- **Domain:** the team's GoDaddy Registry domain points at the Vercel project; the dashboard is also reachable at a `map.` subdomain that routes to `/map`.

### Local development

- WebXR only works on the phone over HTTPS, so phone testing always uses a Vercel preview deployment (every push) or a local HTTPS tunnel.
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
| sessionId | uuid | yes | New random value per app launch; also rotated at midnight |
| deviceKey | string | yes | Random id stored on the phone; the backend turns it into a salted hash and never stores the raw key |
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

Request: one JPEG frame (long edge ≤ 768 px, quality \~0.7, base64), the triggering hazard (kind, distance, angle, height band, detector class), scene hint if known, and deviceKey (for rate limiting only).

Response (validated against the schema before returning):

| Field | Type | Notes |
| --- | --- | --- |
| report | boolean | Final decision after the backend applies the rules (not just the model's say-so) |
| category | civic category or null |  |
| lasting | boolean | Model's judgment that it will still be there in an hour |
| severity | 1–4 |  |
| confidence | 0–1 |  |
| description | string | ≤ 15 words, no people, faces, plates |
| context | scene context |  |
| box | 4 integers or null | Top, left, bottom, right, scaled 0–1000 |
| budgetRemaining | number | Calls left this hour |
| latencyMs | number | For the debug overlay |

### Ask (phone → `/api/ask`)

Request: one JPEG frame (same limits), optional question text (MVP always "What's in front of me?").

Response: answer text (≤ 2 sentences), target box or null, target label, and the spoken audio. Deliver audio as a streamed MP3 response with the answer, box and label in response headers (URL-encoded JSON), so playback can start while audio is still arriving. If voice generation fails, return the text with a flag so the phone can fall back to its cached "Sorry, I couldn't see that" line.

### Dashboard read endpoints (browser → `/api/dashboard/*`)

| Endpoint | Returns |
| --- | --- |
| queue | Top 25 fix-first rows: cell, place label, lat/lon, category, worst severity, reporters, near-misses, last seen, score, and each score part |
| cells | Map cells for a time window (1 h / 24 h / 7 d), category filter and source filter: cell, lat/lon, events, near-misses, reports, score |
| stations | Hourly near-misses per station for 7 days, plus an hour-of-day profile for one station |
| feed | Last 20 civic reports (time, category, severity, description, place label, source) |
| perf | Latest measured raw vs aggregate query times, compression ratio, row counts, last seed load time |

Every dashboard response includes `includesSimulated` so the banner can show.

## Phase 0: repo, deploy skeleton, device test page

**Goal: a deployed HTTPS site whose `/walk` page proves, on the demo phone, that Chrome can give depth, camera frames, spatial audio, wake lock and location together.** Nothing else starts until this passes or a fallback is chosen.

### Tasks

1. Create the Next.js TypeScript project with the layout above, strict type checking, a linter, and the shared types and parameters modules (empty but present).
2. Add `.env.example`, a `docs` folder with the contracts and parameters copied from this plan, and an MIT licence.
3. Deploy to Vercel; confirm every push creates a preview URL.
4. Landing page placeholder at `/`: "beluga" title, one-line description, research-prototype disclaimer.
5. `/walk` capability check page, one large "Start test" button (the user gesture), then a pass/fail list:
   - WebXR present and `immersive-ar` supported
   - Session starts with optional features depth sensing (CPU-optimised usage; luminance-alpha or float32 data format), camera access, hit test, DOM overlay, local-floor reference space; list which features were actually granted
   - Depth data arrives (show width, height, and the distance at screen centre, updating)
   - A camera image arrives (show its size and a tiny preview drawn from the camera texture)
   - Audio: an AudioContext resumed from the same tap plays a test tone hard left, then centre, then hard right through an HRTF panner
   - Screen wake lock acquired
   - Geolocation fix with reported accuracy
   - Device orientation / compass heading available
6. Log every result to the console as well (read through Chrome remote debugging).

### Done when

- The team phone shows all checks passing, or the failing ones are known and a fallback from the final section is chosen.
- Depth at screen centre roughly matches a tape measure at 1 m and 2 m while the phone is moving slowly (depth on most phones comes from motion).

## Phase 1: AR session, depth, camera frames, floor

**Goal: a reusable module that runs the AR session and, ten times a second, hands the rest of the app a clean set of 3D points in world space, the phone's pose, the floor height and the walking direction.**

### Session lifecycle

- One start tap does, in order: resume the AudioContext, request the wake lock, start the XR session, request location watching. Any failure is spoken (cached voice line) and shown in the overlay.
- Required: `immersive-ar`. Optional: depth sensing, camera access, hit test, DOM overlay (rooted at the app's overlay element), local-floor. Prefer the local-floor reference space; fall back to local and estimate the floor yourself.
- The session ends on "Stop", on visibility loss, or on error. On end: stop audio scheduling, flush the event queue, release the wake lock, speak "beluga stopped".
- If the viewer pose is missing or reported as emulated for more than 1 s, mark tracking as lost, pause hazard output and play the "hold steady" voice line once (cooldown 10 s).

### Depth sampling

- Each XR frame, get the CPU depth information for the single view. Process only every Nth frame to reach \~10 Hz.
- Sample a fixed grid in normalised view coordinates (default 48 × 36 points), mapping each point into depth-buffer coordinates with the depth-buffer-from-view transform the API provides, and reading metres with the provided raw-to-metres scale.
- Discard samples under 0.2 m or over 5 m, and samples that read zero.
- Turn each sample into a 3D point: build the view-space ray for that pixel from the inverse projection matrix, scale it to the measured depth (depth is distance along the camera's forward axis), then transform by the view's pose into the reference space.
- Output per update: array of world points, the camera position, timestamp, sample count, valid count.

### Camera frames

- With camera access granted, get the camera image as a WebGL texture from the XR WebGL binding each processed frame.
- Two consumers, each at its own rate: the detector (small frame, default 320 × 240, 4 Hz) and Gemini (up to 768 px long edge, JPEG \~0.7, only on request).
- Render the texture into a small offscreen framebuffer, read pixels, and hand over an image object. Never read the full-resolution texture every frame.
- Record the camera's horizontal field of view (from the projection matrix) for turning box positions into angles.

### Floor and walking direction

- Floor height starts at the local-floor origin (y = 0) if available. Refine it during calibration: the user takes three slow steps; take the median height of the lowest 20% of points within 0.5–2 m ahead. Store it; re-estimate every 5 s from points that are clearly floor (within ±0.1 m of the current value) using a slow moving average.
- Walking direction = the camera's forward vector flattened onto the horizontal plane, smoothed over \~0.5 s. Right vector = perpendicular on the horizontal plane.
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
| Head-height | height over 1.4 m up to 2.2 m | head\_height candidate |
| Overhead | height over 2.2 m | ignore |
| Drop-off | height under −0.25 m | drop\_off candidate |

### Group into hazards

- Split the corridor into 5 lateral buckets (far-left, left, centre, right, far-right). For each kind × bucket, keep the count of candidate points, the nearest ahead distance, and the lateral position of that nearest point.
- A kind × bucket is a raw hit only if it has at least 6 points (rejects depth noise).
- Merge adjacent buckets of the same kind whose nearest distances are within 0.3 m into one hazard; its angle comes from its nearest point; its blocking share = merged width ÷ corridor width.
- Also flag "pole-like": an obstacle hit narrower than one bucket whose points span more than 1.0 m of height.

### Smoothing and identity

- Track hazards across updates by kind + bucket (allowing one bucket of drift per update).
- A hazard becomes active after appearing in 3 consecutive updates, and inactive after 6 consecutive updates without it.
- Distance and angle are smoothed with a short exponential average (weight 0.5 on the new value) to stop sound jitter.

### Priorities and output

- Priority: drop\_off (1) > head\_height (2) > vehicle, bike or blocked (3) > pole-like or generic obstacle (4) > person (5). Labels come from Phase 4; before that, everything uses kind only.
- Output all active hazards sorted by priority then distance. Audio uses the top 2.

### Events produced here

- `hazard_seen` once when a hazard first becomes active.
- `near_miss` once per hazard when its distance first drops below 1.0 m.
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

### Done when

All tests pass, and on the phone the debug overlay correctly shows a chair, a held-up head-height board and a real step-down in a hallway.

## Phase 3: sound library and spatial audio

**Goal: every warning sound designed with ElevenLabs, processed into short mono files cached on the phone, and played from the hazard's side with a parking-sensor rhythm.**

### 3a. Build the library (script, run once, commit the output)

1. For each sound effect below, call the ElevenLabs Sound Effects endpoint three times (text prompt, 0.5–1.0 s duration, prompt influence 0.7–0.8, no loop) and save all variants.
2. For each voice clip, call Text to Speech with the chosen voice and the Flash v2.5 model.
3. Process with ffmpeg: strip leading silence, trim effects to their target length, 50 ms fade-out, convert to mono 44.1 kHz, normalise loudness (about −16 LUFS). Voice clips keep their full length.
4. Write a manifest (sound id → chosen file, duration, gain trim) to `public/sounds`.
5. Add a hidden audition page under `/walk` that plays every variant through the earbuds left/centre/right so the team picks the best one by ear.

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
- Drop-offs use the table shifted one band outward (start at 3.5 m).
- Voice clip: when a hazard enters the 1.5–2.0 m band for the first time, play its word once through the same panner, subject to the 8 s cooldown per kind + side.
- Priority 1 always plays; while it plays, lower-priority voices drop by 12 dB.
- Stationary for more than 5 s: obstacle voices drop 6 dB and stop after 3 more repeats until the user moves; drop-off voices are never reduced.
- Ask playback uses the same engine at the target angle, ducked 12 dB under any hazard; a priority 1–2 hazard stops it.

### Done when

- Blindfolded on the bone-conduction earbuds, a teammate names left / centre / right correctly for at least 8 of 10 random cues.
- From a hand appearing in the corridor to the first sound feels immediate (aim under \~150 ms; measure by recording video with audio).
- No clicks, pile-ups or runaway repeats after a 5-minute walk.

## Phase 4: on-device detector and frame gate

**Goal: name what the depth hazards are (so the right sound plays) and decide, sparingly, when a frame is worth sending to Gemini for civic triage.**

### Detector

- MediaPipe Tasks Vision Object Detector with EfficientDet-Lite0 (COCO), video running mode, GPU delegate with automatic CPU fallback, score threshold 0.35, up to 10 results.
- Input: the small camera frame from Phase 1 at 4 Hz. Load the model once at startup from `public/models` (cached offline).
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

Skip the frame if any is true: the phone is turning faster than 60°/s; mean brightness of the small frame is below 25/255; a triage call is already in flight; the local budget (1 call per 6 s, 150 per hour) is spent; the label is `person` or a vehicle (never reportable).

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

### Shared rules for both routes

- Node runtime. Reject frames over 400 KB or not JPEG.
- Call Gemini with a system instruction, the image, a short text part, JSON response type and a response schema, temperature 0.2.
- Validate the JSON against the same schema on the backend; on invalid output, retry once, then fail safe (triage: report = false; Ask: cached apology).
- Timeouts: triage 6 s, Ask 8 s end to end.
- Log only: route, model, latency, outcome, category. Never the image or the description of people.
- Gemini's box format is four integers, top, left, bottom, right, scaled 0–1000.

### `/api/triage`

System instruction (use this wording):

> You are the civic triage step of beluga, an app used by blind and low-vision pedestrians together with a white cane or guide dog. You see one forward-facing chest-height photo and a short note about the hazard the phone detected. Decide whether it shows a lasting public-space hazard that the city should fix. Only these categories are reportable: sidewalk\_obstruction (scooter, bike or object left across the walking path), construction\_barrier, head\_height\_hazard (sign, branch, awning at head height), surface\_damage (pothole, broken curb, heaved slab), blocked\_curb\_cut, tactile\_strip\_issue (missing or damaged warning strip at a platform or curb edge), snow\_ice, other\_fixed. People, moving or parked vehicles in the road, animals and things being carried are never reportable. Severity: 1 minor inconvenience, 2 forces a detour, 3 collision likely, 4 fall risk. Be conservative: if unsure, lower your confidence. Describe only what is visible in 15 words or fewer. Never mention faces, licence plates or anything that identifies a person. Never say a road is safe to cross. Also classify the scene context. Return JSON only.

Text part: the phone's note, e.g. "Hazard: head\_height, 1.6 m ahead, 10° right, detector label unknown, scene hint sidewalk."

Schema fields: report, category, lasting, severity, confidence, description, context, box (nullable).

Backend decision (overrides the model): report is true only if the model said report, category is in the reportable list, lasting is true, confidence ≥ 0.7 and severity ≥ 2. Also false if the same device hash reported the same category in the same grid cell in the last 15 minutes (checked in the database), or if the hourly budget is spent.

Hourly budget: a tiny `api_budget` table (hour, route, count) incremented per call; refuse triage above `GEMINI_HOURLY_BUDGET`. Ask is not budget-limited beyond Gemini's own limits.

### `/api/ask`

System instruction:

> You are beluga's describe-the-scene helper for a blind or low-vision pedestrian. Answer the user's question about one forward-facing chest-height photo in at most two short sentences, the most safety-relevant thing first, using left, right or straight ahead and rough metres. If your answer is about one main object, return its box. For traffic or walk signals say only what the signal appears to show; never say it is safe to cross. Never describe people's faces or identities. Return JSON only.

Schema fields: answer, target label (nullable), box (nullable).

Then call ElevenLabs Text to Speech streaming with the answer, the configured voice and Flash v2.5, MP3 output. Pipe the audio straight back as the response body, with answer, label and box in response headers. If ElevenLabs fails, return the JSON with a voice-failed flag; the phone speaks the cached apology.

### Test set (commit it under `docs/test-frames`)

Take 10–12 photos at chest height around the venue and campus: scooter across a sidewalk, construction barrier, head-height sign, broken curb, a person walking, a parked car in the road, an empty hallway, stairs going down, a platform-like edge with yellow strip.

| Photo | Expected triage |
| --- | --- |
| Scooter across sidewalk | report, sidewalk\_obstruction, severity 2–3 |
| Head-height sign | report, head\_height\_hazard, severity 3 |
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
| session\_id | uuid, not null |  |
| device\_hash | text, not null | HMAC-SHA256 of the phone's device key with `DEVICE_HASH_SALT`, first 16 hex characters |
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
| `cell_15m` | 15 minutes | cell, civic category (or hazard kind when null), source | events, near-misses, civic reports, worst severity, closest distance, average lat, average lon | every 1 min, covering the last 3 days, up to 1 min ago |
| `cell_daily` | 1 day (stacked on `cell_15m`) | same | sums of counts, max severity, min closest, average position | every 15 min, covering the last 30 days |
| `station_hourly` | 1 hour | station, hazard kind, source | near-misses, civic reports, events | every 1 min, covering the last 3 days |
| `cell_reporters_daily` | 1 day | cell, civic category, device hash, source | reports per device | every 5 min, covering the last 30 days |

### `fix_first` view

For each cell × civic category over the last 14 days (from `cell_daily`, civic reports > 0), joined to reporter counts (distinct device hashes from `cell_reporters_daily`) and the nearest station:

| Part | Formula |
| --- | --- |
| Severity weight | worst severity 1 → 1, 2 → 2, 3 → 4, 4 → 8 |
| Reporters | log2(1 + distinct reporters) |
| Near-miss pressure | 1 + near-misses in that cell ÷ 10 |
| Recency | 1.5 if last report within 48 h, else 0.5 ^ (days since last report ÷ 7) |
| Transit | 1.3 if within 150 m of a station, else 1 |
| **Score** | product of the five |

Only rows with at least 3 distinct reporters are returned (k-anonymity). The view also returns each part, the station name and a place label ("near Rideau" or the cell).

### `/api/events` intake

1. Validate the batch against the event contract; reject the whole batch if consent version is missing.
2. Round lat/lon to 3 decimals again; recompute the cell from them; drop any civic fields on non-civic events.
3. Turn device keys into device hashes; never store the raw key.
4. Fill station id when missing: nearest station within 150 m by PostGIS distance.
5. Insert all rows in one multi-row statement with source = live. Return accepted and rejected counts.

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
| Left column | **Fix-first queue** table: rank, place, category, severity, reporters, near-misses, last seen, score, and a "why" line built from the score parts (e.g. "Severity 3 × 6 reporters × 20 near-misses × seen yesterday × near Rideau") |
| Right column | **Map** of Ottawa centred on the five stations: cells as hexagons or circles coloured by score (or by event count when no reports), station markers, click a cell for a detail card |
| Below | **Station panels**: hourly near-misses over 7 days per station (small line charts) and an hour-of-day bar chart for the selected station |
| Below | **Live feed**: last 20 civic reports with time, category, severity, description, place, source badge |
| Footer panel | **Performance**: raw vs aggregate query time for the same 7-day question, compression ratio, total rows, seed load time, and a "Measure again" button |

### Behaviour

- Poll the feed and queue every 5 s; cells and stations every 15 s; performance only on load and on button press.
- Clicking a queue row flies the map to that cell and opens its card; clicking a cell highlights its queue row.
- New live reports flash briefly in the feed and on the map, so the judge's own report is visible during the demo.
- Map: MapLibre with a free, no-key basemap style; data layer via deck.gl (hexagons or scatter) or MapLibre's own circle layer, whichever is quicker to get right.
- Colours: a single sequential scale for score that stays readable for colour-blind viewers; severity also shown as a number, never colour alone.
- The queue is a real HTML table with headers; keyboard navigable.

### `/api/dashboard/perf` measurement

- Run the same question twice: "events and near-misses per cell over the last 7 days" from the raw hypertable, and from `cell_15m`. Time each with the database's own execution timing (explain-analyse style), not network time.
- Read the compression statistics for `hazard_events` (compressed vs uncompressed bytes) and total row count.
- Store the result in `perf_snapshots` and return the latest.

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
- **Determinism:** seeded random generator so reruns produce the same data.

### Loading

1. Write rows as CSV and bulk-load with the database's copy mechanism; record the elapsed seconds.
2. Manually refresh all four aggregates for the full 14-day range.
3. Run the compression policy job once (or compress eligible chunks directly) so chunks older than 7 days are compressed now.
4. Take a performance snapshot (Phase 7 measurement) and store the load time in it.
5. Provide a "reset" command that deletes simulated rows only and reloads.

### Done when

The dashboard shows a populated map, a fix-first queue topped by recognisable stories (e.g. a Rideau tactile strip, a Parliament sign), station trends with clear rush-hour peaks, a compression ratio well above zero, and an aggregate query that is visibly faster than the raw one.

## Phase 9: consent, privacy, installable app, accessibility

**Goal: beluga installs to the home screen, runs offline for warnings, never sends anything without consent, and is fully usable by someone who cannot see the screen.**

### First-run flow (spoken and on screen, screen-reader friendly)

1. "beluga works alongside your cane or guide dog. It can miss things."
2. Reporting choice, one large button each: "Help the city: share anonymous hazard reports" / "Not now". Explain in one sentence each: what is sent (hazard type, distance, rough location within about 100 metres, time) and what is never sent (images, audio, exact location, identity). Default is off.
3. "Put the phone on your chest lanyard, camera facing forward, then tap anywhere to start."
4. After start: "Take three slow steps" → calibration → "calibrated".

Store consent (on/off + consent version number) on the phone; changeable any time in settings, which speak "reporting on" / "reporting off".

### On-phone event queue

- Events are always recorded locally (for the debug overlay) but sent only when reporting is on.
- Batches every 10 s or at 50 events, whichever first; persisted to on-phone storage so nothing is lost if the network drops or the app closes; retried with backoff when back online.
- Coarsen before queueing: lat/lon to 3 decimals, cell from the coarsened values.
- Device key: random, created once, stored on the phone; session id: new per launch and at midnight.

### Location

- Watch position with high accuracy. If accuracy is worse than 100 m or no fix arrives for 30 s (typical underground), keep the last good coarse position and the station chosen when the session started (settings offer the five stations plus "on the street").
- Heading from device orientation, smoothed.

### Installable app and offline

- Manifest: name and short name "beluga", full-screen display, portrait, dark theme colours, maskable icons (a simple beluga silhouette, 192 and 512 px), start URL `/walk`.
- Service worker: pre-cache the app shell, all sound files, the sound manifest and the detector model; network-only for `/api/*`; the landing page and dashboard use normal network-first caching.
- Offline behaviour: Walk works fully; Ask speaks "Ask is offline. Obstacle alerts still on."; triage is skipped; events wait in the queue.

### Controls during a session

- Screen taps inside the AR session arrive as XR select events, and taps on DOM-overlay elements arrive as normal DOM events; handle both.
- Double-tap anywhere (two taps within 400 ms) → Ask. A large "Stop" button at the bottom of the overlay. Three-finger tap → debug overlay.
- All buttons have accessible names, at least 64 px tall, high contrast; nothing depends on colour alone.
- Settings (outside the session): reporting on/off, "reported" sound on/off, optional alive tick every 30 s, master volume, starting station, debug overlay default.

### Done when

- Installed from Chrome, launches full-screen from the home screen.
- With TalkBack on, a teammate with eyes closed can complete first run, start a session and stop it.
- In airplane mode, a session starts and warns; events queued offline upload after reconnecting.
- With reporting off, no request reaches `/api/events` or `/api/triage` (check the network log).

## Phase 10: domain, demo hardening, offline and replay modes

**Goal: the demo works on the team's domain, on flaky Wi-Fi, on an awkward floor, and even if live depth misbehaves.**

### Domain

- Attach the team's GoDaddy Registry domain to the Vercel project (apex + `www`), and add a `map.` subdomain that rewrites to `/map`. Copy the DNS records Vercel shows into the registrar.
- Landing page (`/`): beluga name and one-line pitch, three links (Try beluga → `/walk`, City dashboard → `map.` subdomain, Source code → GitHub), the disclaimer, and a short "how it works" with the sponsor stack.
- Keep the Vercel address working as a backup link.

### Replay mode (backup for tests and the demo)

- Recorder: in a session, a debug toggle records 30 s of processed inputs: the world points (already sampled), camera pose, floor height, walking direction and detector results per update, plus a few small frames. Save as a compressed JSON file downloadable from the phone.
- Player: `/walk?replay=<file>` feeds a recording into the hazard engine and audio engine without an AR session, at real time. Use it for Phase 2 regression tests and as a live demo fallback on any phone.
- Record at least three clips before the freeze: chair approach, head-height sign, step-down edge.

### Depth-free fallback (only if the demo phone loses depth)

- A settings switch "camera-only mode": no depth; hazards come from detector boxes only; distance estimated from box height for people (assume 1.7 m tall) and from box bottom position for ground objects; no drop-off detection. The overlay says "camera-only mode" and the pitch says depth-capable phones get edge warnings.

### Stretch: tactile-strip detector

- In the lower third of the small frame, count pixels in a bright safety-yellow colour range. A wide horizontal band covering more than \~8% of that region for 3 updates raises a drop\_off-priority warning labelled "edge" with an estimated distance from the band's position (using the floor plane). Makes a taped edge detectable; always shown as a secondary signal.

### Hardening checklist

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
| Head-height band | 1.4–2.2 m above floor |
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
| Backend hourly budget | 150 triage calls |
| Report thresholds | confidence ≥ 0.7, severity ≥ 2, lasting |
| Report dedup | same device + cell + category within 15 min |
| Timeouts | triage 6 s, Ask 8 s |
| Double-tap window | 400 ms |
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

**If time runs short, cut from the bottom of the cut list; never cut anything in the acceptance checklist.**

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

### Cut list (cut from the bottom up)

1. Tactile-strip detector
2. Replay mode player UI (keep the recorder)
3. Hour-of-day chart on the dashboard
4. Station trend panels
5. "Blocked path" sound switching
6. Detector labels (depth-only sounds)

### Final acceptance checklist (all must pass by 02:00)

- [ ] Phone: installed app starts a session from one tap, calibrates, and stays silent in an empty hallway
- [ ] Phone: chair, head-height board and a real step-down each produce the right sound from the right side, speeding up on approach
- [ ] Phone: double-tap Ask speaks an answer from the object's direction in under \~3 s
- [ ] Phone: warnings still work in airplane mode
- [ ] Phone: with reporting off, nothing is sent; with it on, a staged scooter produces a civic report
- [ ] Database: migrations, compression and retention policies, four real-time continuous aggregates, fix-first view
- [ ] Dashboard: queue, map, feed and performance panel populated; simulated banner visible; the live report appears within \~10 s
- [ ] Domain serves the landing page and the dashboard over HTTPS
- [ ] README complete; no secrets in the repo; licence present
- [ ] Three replay clips and a backup demo video recorded
