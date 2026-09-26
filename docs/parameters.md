# beluga parameters

Copied from `docs/PLAN.md` on Sept 26, 2026. When this file and `lib/shared` differ, `lib/shared` is the source of truth.

**Every number below lives in the shared parameters module with these defaults; tune on the phone, not in scattered code.**

## Sensing and hazards

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
| First floor value | median of 5 hit tests on flat ground 0.5 to 2 m below the phone, ray 45° below straight ahead |
| Floor calibration | ends after 1.5 m of walking or 8 s, once it has 200 floor points |
| Floor drift | every 5 s, 30% of the way to the median of floor points within ±0.1 m (at least 50) |

## Audio

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

## Detector, gate and network

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
