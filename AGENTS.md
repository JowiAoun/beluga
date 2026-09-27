<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# beluga

An installable web app for Android Chrome that warns blind and low-vision pedestrians about obstacles with directional sounds, plus a fix-first hazard dashboard for the city. The full plan is `docs/PLAN.md`: read the phase you are working on before writing code.

## Commands

- `npm run dev`: dev server on port 3000
- `npm run lint`, `npm run typecheck`, `npm test`: run all three before committing
- `npm run build`: production build, the same one Vercel runs. It and `npm run dev` first put the detector's model and WASM and MapLibre's worker in `public` (`scripts/assets.ts`)
- `npm run phone`: sends the phone's `localhost:3000` to this laptop over USB (see Phone testing)
- `npm run db:smoke`: Phase 0 database check, needs `DATABASE_URL` in `.env.local`
- `npm run db:migrate`: applies `db/migrations` in order, once each. The venue network blocks the database's port, so run it from a phone hotspot
- `npm run agents`: creates or updates the three ElevenLabs agents (triage, Ask, Ask the data) and prints their ids; `npm run agents -- --check photo.jpg` runs the Phase 5 image check, and `npm run agents -- --sweep` deletes any finished conversation the agents still hold
- `npm run sounds`: generates the ElevenLabs sound library into `public/sounds`
- `npm run demo-spot -- uottawa sidewalk_obstruction`: stages 2 simulated reporters at the demo spot, so a judge's live report makes the third and the spot joins the fix-first queue; `-- --remove` takes them out
- `npm run deploy`: deploys beluga.surf from `main` on GitHub. Pushes don't deploy by themselves (`vercel.json`); this calls the deploy hook in `VERCEL_DEPLOY_HOOK_URL`
- `npm run seed`: loads the labelled simulated fortnight (about 424,000 rows), compresses the older week and takes a performance snapshot; `npm run seed -- --reset` replaces the simulated rows. Like the migrations, run it from a phone hotspot

## Phone testing

1. Plug the phone in over USB with USB debugging on.
2. Run `npm run phone`. It runs `adb reverse tcp:3000 tcp:3000` for each plugged-in phone and finds `adb` in the Android SDK when it isn't on PATH.
3. Open `http://localhost:3000/walk` in Chrome on the phone. `localhost` counts as a secure page, so WebXR works with no tunnel.

An iPhone can't use `adb reverse`, and camera mode needs a secure page, so test it on the deployed site or through an HTTPS tunnel. Safari has no WebXR AR, so an iPhone always runs camera mode.

`/walk` is the walking app. The device check at `/walk/check` prints its results in the `npm run dev` terminal as `[beluga check]` lines. With the debug overlay on, each `/walk` session ends with a `[beluga walk]` summary line there too. The sound check at `/walk/sounds` plays every warning sound left, centre and right, and runs the blindfold test; each score prints as a `[beluga sounds]` line. `/walk?detector=cpu` runs the object detector off the GPU and `/walk?detector=off` turns it off. With the overlay on, "Record a 30 s replay" saves a clip on the phone (depth, pose and detector boxes, no camera frames); put clips in `public/replays` and play them at `/walk?replay=/replays/<file>.json.gz`, or pick a file on that page.

## Rules for every change

- The name is "beluga", always lowercase.
- The safety loop (depth, hazard, sound) never touches the network.
- No image ever reaches the database. Frames go only to the ElevenLabs agents (which see with Gemini), are never stored by beluga, and each agent conversation is deleted right after its answer.
- Every model call goes through ElevenLabs agents, not the Gemini API. Calling Gemini directly is only the fallback in `docs/PLAN.md`.
- Reporting is off until the user turns it on. Locations are rounded to 3 decimals on the phone and again on the backend.
- Never tell the user it is safe to cross a road, in any string, prompt or spoken line.
- API keys live only on the backend. Files under `lib/server` start with `import "server-only"`.
- Simulated data is labelled as simulated everywhere.

## Where things go

- Each track owns its folders (table in "Tracks & timeline" in `docs/PLAN.md`). Touch another track's folder only in a small, separate commit.
- Shared contracts live in `lib/shared`: `enums`, `contracts` (zod schemas and response types), `params` (every tunable number), `reporting` (categories and severity), `geo` (coarsening and grid cells), `stations`. Add to these files; never reorder or reformat them.
- A module that uses a sponsor service starts with a comment naming the prize it serves.
- Every page follows `docs/DESIGN.md`: colours, fonts, components, motion, 3D and accessibility.
