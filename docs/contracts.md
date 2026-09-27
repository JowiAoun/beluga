# beluga contracts

Copied from `docs/PLAN.md` on Sept 26, 2026. When this file and `lib/shared` differ, `lib/shared` is the source of truth.

**These shapes are defined once in the shared types module and used unchanged by the phone, backend and dashboard.** Units: metres, degrees, milliseconds, ISO-8601 UTC timestamps. Angles: negative = left, positive = right, 0 = straight ahead.

## Enumerations

| Name | Values |
| --- | --- |
| Hazard kind | `obstacle`, `head_height`, `drop_off` |
| Detector class | `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `bench`, `chair`, `fire_hydrant`, `stop_sign`, `potted_plant`, `suitcase`, `pole_like`, `unknown` |
| Sound id | `edge_pulse`, `head_chime`, `tick`, `ping`, `bell`, `marimba`, `buzz`, `taps`, `listening`, `ready`, `reported`, `centre_tick` |
| Event kind | `hazard_seen`, `near_miss`, `civic_report` |
| Civic category | `sidewalk_obstruction`, `construction_barrier`, `head_height_hazard`, `surface_damage`, `blocked_curb_cut`, `tactile_strip_issue`, `snow_ice`, `other_fixed` |
| Scene context | `platform`, `crosswalk`, `sidewalk`, `indoor`, `stairs`, `unknown` |
| Source | `live`, `simulated` |

## Hazard update (on the phone: hazard engine → audio, events, gate)

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

## Event (phone → `/api/events`, batched)

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

## Triage (phone → `/api/triage`)

Request: one JPEG frame (long edge ≤ 768 px, quality \~0.7, base64), the triggering hazard (kind, distance, angle, height band, blocking share, detector class), scene hint if known, and deviceKey (for rate limiting only).

Response (validated against the schema before returning). The yes/no answers come from the triage agent; severity and the report decision come from the backend (see "What gets reported"):

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

## Ask (phone → `/api/ask`)

Request: one JPEG frame (same limits), optional question text (MVP always "What's in front of me?").

Response: answer text (≤ 2 sentences), target box or null, target label, and the spoken audio. Return the whole file as the response body (a lossless 48 kHz WAV), with the answer, box and label in response headers (URL-encoded JSON). The phone decodes it and plays it through the stereo engine. Web Audio can't decode half a file, and an `<audio>` element can't send a POST, so a streamed file would not start any sooner. If Ask misses 3 s, the upgrade is to stream `pcm_24000` from ElevenLabs and play each chunk as its own audio buffer. If voice generation fails, return the text with a flag so the phone can fall back to its cached "Sorry, I couldn't see that" line.

## Dashboard read endpoints (browser → `/api/dashboard/*`)

| Endpoint | Returns |
| --- | --- |
| queue | Top 25 fix-first rows: cell, place label, lat/lon, category, who fixes it, worst severity, reporters, near-misses, last seen, score, and each score part |
| urgent | "Check now" list: severity 4 reports from the last 14 days, read from `cell_daily`: cell, place label, category, who fixes it, day, source. No reporter minimum, no time of day |
| cells | Map cells for a time window (1 h / 24 h / 7 d), category filter and source filter: cell, lat/lon, events, near-misses, reports, score |
| stations | Hourly near-misses per station for 7 days, plus an hour-of-day profile for one station |
| feed | Last 20 civic reports (time, category, severity, description, place label, source) |
| perf | Latest measured raw vs aggregate query times, compression ratio, row counts, last seed load time |

Every dashboard response includes `includesSimulated` so the banner can show.
