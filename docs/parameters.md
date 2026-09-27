# beluga parameters

Copied from `docs/PLAN.md` on Sept 26, 2026. When this file and `lib/shared` differ, `lib/shared` is the source of truth.

**Every number below lives in the shared parameters module with these defaults; tune on the phone, not in scattered code.**

## Sensing and hazards

| Parameter | Default |
| --- | --- |
| Processing rate | 10 updates/s |
| Depth sample grid | 48 × 36, each cell read at 5 depth pixels and kept when 3 agree within 8 cm or 6% |
| Valid depth range | 0.2–5.0 m |
| Corridor half-width | 0.45 m |
| Corridor ahead range | 0.3–3.0 m (drop-off 3.5 m) |
| Floor band | −0.15 to +0.15 m |
| Obstacle band | 0.15–1.4 m above floor |
| Head-height band | 1.4 m up to the user's height + 0.1 m (default 1.95 m) |
| Floor line slope clamp | ±10% |
| Out-of-view memory | until passed, at most 3 s, or 0.25 m outside the corridor |
| Travel-direction blend | above 0.3 m/s, weight 0.5 |
| Drop-off threshold | more than 0.15 m below floor (a single step is 15 to 18 cm) |
| Lateral buckets | 5 |
| Minimum points per hit | 6 |
| Merge distance for adjacent buckets | 0.3 m |
| Pole-like | narrower than one bucket, height span > 1.0 m |
| Activate / deactivate | 3 updates on / 6 updates off; drop-offs 5 updates on, one miss allowed |
| Track match | within 0.6 m of where the hazard was |
| Drop-off edge | at least 6 floor points before it in the same lane |
| Floor move | 3 updates with 30 floor points at the phone's usual height above the floor, and few at the old floor |
| Tilt banner | shows after 1 s with the camera more than 25° down, 10° up or turned 20°, and goes 5° back inside |
| Stale depth | the same depth image for 0.5 s while the phone moved 5 cm or turned 3° counts as no depth |
| Detector stall | a frame not back from the detector in 3 s is let go, and the next one goes |
| Warnings stopped | no update for 3 s, no trusted depth for 3 s, or sound paused for 2 s: a red banner, spoken once, counted in the summary |
| Smoothing weight | 0.5 |
| Near-miss distance | 1.0 m |
| Stationary | < 0.1 m moved in 5 s |
| Tracking-lost threshold | 1 s |
| First floor value | median of 5 hit tests on flat ground 0.5 to 2 m below the phone, ray 45° below straight ahead |
| Floor calibration | ends after 1.5 m of walking or 8 s, once it has 200 floor points |
| Floor drift | every 5 s, 30% of the way to the median of floor points within ±0.1 m (at least 50) |
| Floor line | needs 20 floor points spread at least 0.3 m ahead, else the floor counts as flat |
| Blocked priority (3) | an obstacle covering 60% of the corridor or more |

## Audio

| Distance ahead | Repeat every | Volume |
| --- | --- | --- |
| more than 1.0 m | silent | none |
| 0.75 to 1.0 m | 350 ms | −6 dB |
| 0.5 to 0.75 m | 220 ms | −3 dB |
| 0.3 to 0.5 m | 120 ms | 0 dB |
| under 0.3 m | 80 ms (continuous) | 0 dB |

Hazards are still found out to 3 m, so they sound the moment they come within 1 m. Drop-offs: same table 0.5 m further out (start 1.5 m, continuous under 0.8 m).

| Parameter | Default |
| --- | --- |
| Pan | offset from the walking line ÷ 0.45 m, clamped to ±1. Ask answers: angle ÷ 20° |
| Far ear | −24 dB × pan, silent at full pan, up to 0.6 ms late |
| Centre marker zone | within 0.09 m of the walking line (the middle bucket) |
| Max simultaneous hazard sounds | 1, the nearest band first |
| Centre marker | first repeat straight ahead, then at most every 1 s |
| Lower-priority duck | −12 dB |
| Stationary reduction | −6 dB, stop after 3 repeats (never for drop-offs) |
| Voice clip trigger | entering the 0.5 to 1.0 m band |
| Voice clip | the word, then the side ("pole, left") |
| Voice clip cooldown | 8 s per word + side |
| Scheduler tick / schedule ahead | 25 ms / 100 ms |
| Bluetooth lead | bands use distance − speed × output latency, latency capped at 0.4 s |
| Keep-alive noise | −70 dBFS for the whole walk |
| Limiter threshold | −3 dB |
| High-pass on sound files | 250 Hz |
| Alive tick (optional) | every 30 s |

## Detector, gate and network

| Parameter | Default |
| --- | --- |
| Detector input / rate | 320 × 240 / 4 Hz |
| Detector score threshold | 0.35 |
| Label match window | ±10°, label held 1 s |
| Label match box | obstacles: box reaches the lower two-thirds; head height: box starts in the upper half |
| Agent frame size | ≤ 768 px long edge, JPEG 0.7, ≤ 400 KB |
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

## Database and dashboard

| Parameter | Default |
| --- | --- |
| Chunk size | 1 day |
| Compress after | 7 days |
| Delete raw after | 180 days |
| k-anonymity | ≥ 3 distinct reporters |
| Fix-first window | 14 days |
| Dashboard polling | feed + queue 5 s; cells + stations 15 s |
| Seed | 14 days, 300–500k rows, seeded random |
