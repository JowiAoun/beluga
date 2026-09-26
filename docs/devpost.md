# Devpost draft

Text for the beluga submission, ready to paste. The database numbers come from the dashboard's performance panel on Tiger Cloud, Sept 26.

**Tagline**: Short sounds from the side of each obstacle for blind and low-vision pedestrians, and a fix-first list for the city.

## Inspiration

Belugas find their way by echolocation: they listen to sound bouncing back from what is around them. A white cane finds what is on the ground, but not a sign at head height, a scooter left across the sidewalk a step ahead, or the edge of a platform. And the city rarely hears about any of it. We wanted a phone on the chest to do the listening, and to turn what it hears into a list the city can act on.

## What it does

- **Warns with sound**: the phone measures depth 10 times a second. Anything in a 0.9 m walking corridor within 3 m plays a short sound from its side, faster as you get closer. Drop-offs and head-height hazards have their own sounds, and named things (people, bikes, cars, poles) get theirs, with a voice clip like "pole, left".
- **Made for bone-conduction earbuds**: they keep the ears open to traffic but can't do 3D sound, so the side comes from a level and time difference between the ears, and pitch stands for height.
- **Ask**: one tap, or the earbuds' play button, sends one camera frame to an ElevenLabs agent that sees with Gemini. The answer plays from the side of the object it describes.
- **Reports for the city, only with consent**: a frame gate picks a few moments worth a look, an agent answers yes or no questions about them, and fixed rules tied to Ontario accessibility standards decide the severity. Only the hazard type, distance, a location rounded to about 100 m and the time are sent. Never an image.
- **A dashboard for planners**: a fix-first queue, a map, station trends, a live feed, a performance panel, and "Ask the data", where a planner types a question and an agent answers from the numbers.
- **Keeps working**: warnings never touch the network and run offline. Without depth, camera-only mode warns from the detector's boxes, and yellow edge strips are caught by colour.

## How we built it

- **Phone**: Next.js 16 as an installable web app for Chrome on Android. WebXR gives depth, the camera and the floor. A MediaPipe detector runs in a web worker, and Web Audio plays the sounds.
- **ElevenLabs**: a library of 12 designed warning sounds from the Sound Effects API, cut below 250 Hz for bone conduction; 24 voice clips; the Flash v2.5 voice for Ask; and three agents with client tools: triage, Ask, and Ask the data.
- **Gemini**: the model inside all three agents, from the ElevenLabs model list.
- **Tiger Data**: one hypertable, four real-time continuous aggregates (one stacked on another), compression and a 180-day retention policy as privacy tools, and the fix-first score in SQL with PostGIS.
- **GoDaddy Registry**: the app lives at beluga.surf.

## Challenges we ran into

- Bone-conduction earbuds sit outside the ear, so the 3D audio we first planned didn't work. We rebuilt the sounds around level, timing and pitch, and had the voice say the side.
- An upload sent the moment an agent conversation started came back 404 or 408. Zero Retention Mode turns off uploads altogether. A delete sent as a conversation ended was undone when ElevenLabs saved it a few seconds later. Each needed its own fix before frames could be both seen and deleted.
- The object detector stalled the sensing loop until we moved it into a web worker.
- The venue network blocks the database port, so migrations and the seed ran from a phone hotspot.

## Accomplishments that we're proud of

- Ask answers in about 2.5 s from the agent, and Ask the data in under 2 s.
- The triage agent names a "sidewalk closed" barrier as a construction barrier with 0.95 confidence, and the conversation holding the frame is gone a few seconds later.
- 429,000 labelled simulated events load into Tiger Cloud in 53 s. The same 7-day question takes about 390 ms on the raw table and 17 to 92 ms from the continuous aggregate, and compressed chunks are 10.4 times smaller.
- A judge's live report joins the fix-first queue within seconds.
- 185 automated tests.

## What we learned

- Sound design for bone conduction is its own craft: fewer, clearer cues beat a realistic sound stage.
- An agent with one client tool is a clean way to get structured answers out of a model, and the same tools can hand it data.
- Continuous aggregates make a dashboard fast without a cache, as long as today's bucket stays real-time.

## What's next for beluga

- Co-design with blind and low-vision users through CNIB. No blind or low-vision users co-designed this version.
- A pilot with OC Transpo at the O-Train stations.
- Sounds tuned from real walking tests, and reports sent straight to the City's 311.

## Built with

webxr, arcore, chrome, android, pwa, web-audio, mediapipe, elevenlabs, elevenlabs-agents, gemini, tiger-data, timescaledb, postgresql, postgis, next.js, vercel, maplibre, godaddy-registry
