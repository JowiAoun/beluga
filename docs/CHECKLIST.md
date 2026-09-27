# Demo checklist

What to check before showing beluga, from the site to the Devpost page. Devpost closes at 10:00 EDT on Sunday, Sept 27. Tick each box as you go.

## Site

- [ ] In Vercel, import `JowiAoun/beluga` and move the `beluga.surf` domain to that project.
- [ ] Add the variables from `.env.example`. Copy `DEVICE_HASH_SALT` from the old project: a new value makes the same phone count as a new reporter.
- [ ] In Settings, Git, Deploy Hooks, make a hook for branch `main`, and put it in `.env.local` as `VERCEL_DEPLOY_HOOK_URL`.
- [ ] Run `npm run deploy`.
- [ ] In Vercel, under Deployments, check that it built the latest commit on `main`.
- [ ] Pick a last deploy time. After it, only fix what breaks.

## Demo phone

- [ ] Charge it full, and bring a battery pack for between demos.
- [ ] Open `beluga.surf/walk/check` and make sure depth, camera, sound, wake lock and location all pass.
- [ ] Open `beluga.surf/walk` on the venue Wi-Fi and wait for "Spoken labels saved on this device for offline playback."
- [ ] Go through setup: pick the voice, turn reporting on (it starts off), allow location and set your height.
- [ ] In Settings, set the warning distances and sounds you'll demo.
- [ ] Walk for 5 minutes with the debug overlay on. The "Last session" panel should say "During the walk: nothing stopped".
- [ ] Turn the debug overlay off, unless judges should see it. A three-finger tap turns it on and off during a walk.
- [ ] Fix the phone on the chest mount, camera facing forward and level. The tilt banner shows when it isn't.
- [ ] Stop the walk between demos, so the phone doesn't overheat.

## Route

- [ ] Pick a route indoors, away from stairs and roads, and walk it with a sighted spotter.
- [ ] Put a clear pole or box and a single step down on it, so both obstacle and drop-off warnings get heard.
- [ ] Stay off glass doors, dark floors and shiny floors: they leave holes in the depth.
- [ ] Walk it twice with the demo settings. Start each walk with the three slow steps.
- [ ] If something warns that shouldn't, turn on the debug overlay, press "Record a 30 s replay" at that spot, and send the file.

## Sound & screen

- [ ] Run `scrcpy` with the phone plugged in. The laptop shows the screen and, on Android 11 and up, plays the sound.
- [ ] Bring spare bone-conduction earbuds for the judge.
- [ ] If warnings come late over Bluetooth, switch to wired earbuds or the phone speaker.

## Network & Ask

- [ ] Bring a phone hotspot. Ask needs the internet; obstacle warnings don't.
- [ ] Ask one question on the venue network, and check the ElevenLabs account has credits left.
- [ ] Run `npm run agents -- --sweep` to delete any conversation the agents still hold.

## City dashboard

- [ ] On a phone hotspot (the venue network blocks the database), run `npm run demo-spot -- uottawa sidewalk_obstruction`.
- [ ] Open `beluga.surf/map` and check the queue, map and feed have data, with the simulated banner showing.
- [ ] Before each staged report, tap "New demo reporter" in Settings.
- [ ] After the demo, run `npm run demo-spot -- --remove`.

## Backup

- [ ] Record a video of a clean run on the route by 06:00, with the sound audible.
- [ ] Keep a good replay on the laptop. Open `beluga.surf/walk?replay=` and pick the file to play it without AR.

## Devpost

- [ ] Link the video, `https://beluga.surf`, the dashboard and `https://github.com/JowiAoun/beluga`.
- [ ] Submit before 10:00 EDT.
