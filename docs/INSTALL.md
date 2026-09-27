# Install & Run

How to run beluga yourself, deploy it and test it, and what it can't do yet. The overview is in the [README](../README.md).

## Requirements

- Node.js 22 or later, and ffmpeg for the sound library
- A Tiger Cloud service (TimescaleDB and PostGIS)
- An ElevenLabs API key
- An Android phone with ARCore depth and Chrome, and bone-conduction earbuds

## Setup

1. Run `npm install`
2. Run `cp .env.example .env.local` and fill in the values
3. Run `npm run db:migrate`
4. Run `npm run seed` for the simulated fortnight
5. Run `npm run agents` and copy the three agent ids it prints into `.env.local`
6. Run `npm run sounds` to build the sound library
7. Run `npm run dev`

## On the phone

1. Plug the phone in over USB with USB debugging on
2. Run `npm run phone`
3. Open `http://localhost:3000/walk` in Chrome on the phone

## Deploy

Import the repository into Vercel and set the same variables there. Pushes don't deploy by themselves (`vercel.json` turns that off), so a deploy happens only when you ask for one:

1. In Vercel, open the project that serves beluga.surf, then Settings, Git, Deploy Hooks, and make a hook for the branch `main`
2. Put its URL in `.env.local` as `VERCEL_DEPLOY_HOOK_URL`
3. Push your commits to GitHub
4. Run `npm run deploy`

## Test

1. Run `npm run lint`
2. Run `npm run typecheck`
3. Run `npm test` for the 287 tests

## Limitations & next steps

- Depth needs a phone with ARCore depth and a little motion. Glass, dark and shiny floors leave holes in it.
- Without depth, camera-only mode warns about the things the detector can name, but finds no steps, drop-offs or yellow edge strips. With depth, the strip check goes by colour alone, so a yellow mat counts too.
- Safari has no WebXR AR, so an iPhone runs camera mode: the camera and the tilt sensors, with the floor taken to be a chest height below the phone.
- Bone conduction gives weaker left and right than headphones, and no up or down.
- The detector knows common objects only. There is no scooter class, so a scooter shows up as a bike, a motorcycle or nothing.
- Ask and reporting need a network. Warnings don't.
- No blind or low-vision users co-designed this version. Next: co-design with CNIB, and a pilot with OC Transpo.
