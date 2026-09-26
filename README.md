# beluga

beluga warns blind and low-vision pedestrians about obstacles with short sounds that come from the obstacle's side, and turns lasting hazards into a fix-first list for the city. It is a research prototype and not a medical device: it works alongside a white cane or guide dog.

Built at Hack the Hill III. The plan is in `docs/PLAN.md`.

## Install & Run

1. Run `npm install`
2. Run `cp .env.example .env.local` and fill in the values
3. Run `npm run dev`
4. Open `http://localhost:3000`

## Test on the phone

1. Plug the phone in over USB with USB debugging on
2. Run `adb reverse tcp:3000 tcp:3000`
3. Open `http://localhost:3000/walk` in Chrome on the phone and tap Start test

## License

MIT
