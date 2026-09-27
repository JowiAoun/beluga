# Devpost story

The text for beluga's [Devpost page](https://devpost.com/software/beluga-p495j3), one heading per field, ready to paste. It matches the README. The database numbers come from the dashboard's performance panel on Tiger Cloud, Sept 26.

**Tagline**: beluga turns obstacles into directional sound for blind and low-vision pedestrians, and everyday hazards into actionable reports for cities.

## Inspiration

Belugas find their way by echolocation. They listen to sound bouncing back from what is around them.

Walking a sidewalk takes more than knowing where to turn. A scooter left across the path, a sign at head height or an unexpected drop-off can change a familiar route in an instant. A white cane finds what is on the ground, but it can miss the sign and the edge. And the city rarely hears about any of it.

We built beluga around two connected ideas. Help people notice obstacles in the moment, with a phone on the chest doing the listening. Then help the city fix the hazards that keep getting in their way, worst first.

## What it does

beluga turns a phone into a hands-free obstacle warning. You wear the phone on a chest mount with the camera facing forward, and listen through bone-conduction earbuds, so your ears stay open to traffic.

- **Quiet until something is in the way**: the phone measures depth 10 times a second. Anything in a 0.9 m walking corridor plays a short sound from its side once it is within the distance you set (1 m by default, 1.5 m for drop-offs), faster and louder as you get closer.
- **Different hazards, different sounds**: drop-offs and head-height hazards have their own sounds. Bikes, cars, poles and blocked paths get a word and a side, like "pole, left".
- **Five voices**: River, Sarah, Alice, Eric or Chris says the warning words, the status lines and the setup steps, all from ElevenLabs' Eleven v3.
- **Ask**: tap Ask, press the earbuds' play button or ask out loud. One camera frame goes to an ElevenLabs agent that sees with Gemini, and the answer plays from the side of the object it describes.
- **Vibration too**: one, two or three pulses for an obstacle, head height or a drop-off.
- **Reports for the city, only with consent**: a frame gate picks a few moments worth a look, an agent answers yes or no questions about them, and fixed rules tied to Ontario accessibility standards decide the severity. Only the hazard type, distance, a location rounded to about 100 m and the time are stored. Never an image.
- **A dashboard for planners**: a fix-first queue for the City of Ottawa and OC Transpo, with the rule each spot likely breaks and who fixes it, plus a 3D hazard map, station trends, a live feed, a performance panel and Ask the data, where a planner types a question and an agent answers from the numbers.
- **Keeps working**: warnings never touch the network and run offline once installed. On an iPhone, or without depth, camera mode warns about the things the detector can name.

## How we built it

- **Phone**: Next.js 16 as an installable web app for Chrome on Android. WebXR with ARCore gives depth, the camera and the floor. A MediaPipe detector runs in a web worker, and the Web Audio API places each sound left or right. The whole warning loop runs on the phone.
- **ElevenLabs**: 12 designed warning sounds from the Sound Effects API, cut below 250 Hz for bone conduction. Five Eleven v3 voices recorded lossless at 48 kHz for every word, status line and setup step, and Eleven v3 again for live Ask answers. Scribe v2 for spoken questions. Three agents with client tools: triage, Ask and Ask the data.
- **Gemini**: the model inside all three agents, from the ElevenLabs model list. Triage answers yes or no questions and fixed rules decide the severity. Ask's object boxes become a sound direction.
- **Tiger Data**: one hypertable, four real-time continuous aggregates (one stacked on another), compression and a 180-day retention policy as privacy tools, and the fix-first score in SQL with PostGIS.
- **Design**: the site and the dashboard share one look, with dark blue, contour lines like a sea chart and the 3D beluga. The walking screen keeps big targets, the Atkinson Hyperlegible font and a Stop button you hold, so a coat brushing the screen can't end a walk.
- **GoDaddy Registry**: the app lives at beluga.surf.

## Challenges we ran into

- **When to interrupt**: constant sound drowns out traffic, and too little leaves an obstacle unnoticed. We settled on a narrow corridor, short sounds, one warning at a time, and repeats that speed up as you get closer.
- **Bone conduction**: the earbuds sit outside the ear, so the 3D audio we first planned didn't work. We rebuilt the sounds around level, timing and pitch, and had the voice say the side.
- **Seeing and forgetting**: an upload sent the moment an agent conversation started came back 404 or 408. Zero Retention Mode turns off uploads altogether. A delete sent as a conversation ended was undone when ElevenLabs saved it a few seconds later. Each needed its own fix before frames could be both seen and deleted.
- **A stalled loop**: the object detector stalled the sensing loop until we moved it into a web worker.
- **The venue network**: it blocks the database port, so migrations and the seed ran from a phone hotspot.

## Accomplishments that we're proud of

- Warnings that never wait on the network, and a phone that stays quiet until something is in the way.
- The same moment that warns you can also put a lasting hazard in front of the people who fix it.
- Privacy built into reporting: opt-in, anonymous, locations rounded to about 100 m, and no image ever stored.
- A full Ask, voice included, in about 5 to 6 s, and Ask the data in under 2 s.
- The triage agent names a "sidewalk closed" barrier as a construction barrier with 0.95 confidence, and the conversation holding the frame is gone a few seconds later.
- 429,093 labelled simulated events load into Tiger Cloud in 53 s. The same 7-day question takes about 390 ms on the raw table and 17 to 92 ms from the continuous aggregate, and compressed chunks are 10.4 times smaller.
- A judge's live report joins the fix-first queue within seconds.
- Every voice clip in all five voices checked with Scribe, and 284 automated tests.

## What we learned

- Accessibility is as much about what to leave out as what to add. More alerts don't make a better walk. Timing, direction and a few clear sounds do.
- Sound design for bone conduction is its own craft: fewer, clearer cues beat a realistic sound stage.
- Fast warnings and deeper answers are different jobs. Depth keeps the warnings quick and local, and the agents add context only when you ask.
- An agent with one client tool is a clean way to get structured answers out of a model, and the same tools can hand it data.
- Continuous aggregates make a dashboard fast without a cache, as long as today's bucket stays real-time.

## What's next for beluga

- Co-design with blind and low-vision users through CNIB, to tune the sounds, the warning distances, the chest mount and Ask. No blind or low-vision users co-designed this version.
- Testing in different light, on crowded sidewalks and with more kinds of obstacles.
- A pilot with OC Transpo at the O-Train stations.
- Grouping repeated reports better, and fitting the fix-first queue into the City's own 311 work.

## Try it out

- [beluga.surf](https://beluga.surf): the landing page
- [beluga.surf/walk](https://www.beluga.surf/walk): the app, in Chrome on an Android phone with ARCore depth
- [beluga.surf/map](https://www.beluga.surf/map): the city dashboard
- [GitHub](https://github.com/JowiAoun/beluga): the source
- [YouTube](https://www.youtube.com/watch?v=Pz9jS8v5VJ8): the demo video

## Built with

webxr, arcore, gemini, elevenlabs, tiger-data, next.js, react, typescript, web-audio-api, postgresql, timescaledb, tailwind-css, maplibre-gl, recharts, zod, vercel, pwa
