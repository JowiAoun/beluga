# beluga on Devpost

The text for beluga's [Devpost page](https://devpost.com/software/beluga-p495j3), ready to paste. It matches the README, and the images load from this repo on GitHub, so nothing needs uploading.

1. **Elevator pitch**: paste the line under "Elevator pitch".
2. **About the project**: paste everything between the two lines, from Inspiration to What's next.
3. **Built with**: paste the tags at the bottom.
4. **Try it out**: add the links at the bottom.

## Elevator pitch

beluga turns obstacles into directional sound for blind and low-vision pedestrians, and everyday hazards into actionable reports for cities.

---

![The beluga home page: a 3D beluga in sunglasses surfs a wave next to the words Hear what's in your way](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/hero.gif)

## Inspiration 🐋

Belugas find their way by echolocation. They listen to sound bouncing back from what is around them.

Walking a sidewalk takes more than knowing where to turn. A scooter left across the path, a sign at head height or an unexpected drop-off can change a familiar route in an instant. A white cane finds what is on the ground, but it can miss the sign and the edge. And the city rarely hears about any of it.

So we built beluga around two connected ideas:

1. **In the moment**: a phone on your chest does the listening and tells you what is in your way.
2. **Over time**: the hazards that keep getting in people's way become a list the city can fix, worst first.

## What it does 🎧

beluga turns a phone into a hands-free obstacle warning. You wear it on a chest mount with the camera facing forward, and listen through bone-conduction earbuds, so your ears stay open to traffic.

![On the walk: Left, ahead, right. A short sound from the side of each obstacle, faster as you get closer, next to the beluga app on an Android phone](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/walk.jpg)

- **Quiet until something is in the way**: the phone measures depth 10 times a second. Anything in a 0.9 m walking corridor plays a short sound from its side once it is within the distance you set (1 m by default, 1.5 m for drop-offs), faster and louder as you get closer.
- **Different hazards, different sounds**: a drop-off falls away in pitch and a sign at head height rings high. Bikes, cars, poles and blocked paths get a word and a side, like "pole, left".
- **Five voices**: River, Sarah, Alice, Eric or Chris says the warning words, the status lines and the setup steps, all from ElevenLabs' Eleven v3.
- **Ask**: tap Ask, press the earbuds' play button or ask out loud. One camera frame goes to an ElevenLabs agent that sees with Gemini, and the answer plays from the side of the object it describes.
- **Vibration too**: one, two or three pulses for an obstacle, head height or a drop-off.
- **Keeps working**: warnings never touch the network and run offline once installed. On an iPhone, or without depth, camera mode warns about the things the detector can name.

![Made for bone conduction: Ears open to traffic. The side comes from level and timing between your ears, and pitch stands for height, next to 3D bone-conduction earbuds turning slowly](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/earbuds.gif)

Bone-conduction earbuds rest in front of your ears, so you still hear the street. They also lose most 3D sound, so the far ear drops by up to 24 dB and hears the sound up to 0.6 ms later, pitch stands for height, and the voice says "left", "right" or "ahead".

![The beluga city dashboard: the week's report and near-miss counts, a 3D hazard map with blue bars around Ottawa's O-Train stations, a Check now item for a tactile strip near Rideau, and the Pick a spot panel](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/map.png)

With your consent, beluga also sends anonymous reports of lasting hazards to a dashboard for the City of Ottawa and OC Transpo:

- **Reports, only with consent**: a frame gate picks a few moments worth a look, an agent answers yes or no questions about them, and fixed rules tied to Ontario accessibility standards decide the severity. Only the hazard type, distance, a location rounded to about 100 m and the time are stored. Never an image.
- **Fix-first queue**: spots ranked by severity, reporters, near-misses, recency and nearness to a station, once 3 different people have reported them.
- **Check now**: fall risks, like a missing tactile strip at a platform edge, skip the 3-reporter rule and show by day only.
- **Pick a spot**: the accessibility rule a spot likely breaks, who fixes it, and how to report it to 311.
- **Ask the data**: a planner types a question like "What should the city fix first near Rideau?", and an agent answers from the numbers.

## How we built it 🛠️

**The phone**: Next.js 16 as an installable web app for Chrome on Android. WebXR with ARCore gives depth, the camera and the floor. A MediaPipe detector runs in a web worker, and the Web Audio API places each sound left or right. The whole warning loop runs on the phone.

![ElevenLabs](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/logo-elevenlabs.png)

- **Three agents with client tools**: triage, Ask and Ask the data. Each conversation is deleted a few seconds after its answer.
- **Five voices on Eleven v3**: every warning word, status line and setup step, recorded lossless at 48 kHz and checked with Scribe. Live Ask answers use Eleven v3 too.
- **12 designed warning sounds** from the Sound Effects API, cut below 250 Hz for bone conduction.
- **Scribe v2** turns spoken questions into text.

![Google Cloud](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/logo-google-cloud.png)

- **Gemini inside all three agents**, from the ElevenLabs model list.
- **Triage answers, code decides**: the agent answers yes or no questions, and fixed rules decide the severity, so the same answers always give the same result.
- **Boxes turned into sound**: when an Ask answer is about one object, its box sets where the answer plays from.

![Tiger Data](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/logo-tiger-data.png)

- **One hypertable** and **four real-time continuous aggregates**, one stacked on another.
- **Compression and a 180-day retention policy** as privacy tools.
- **The fix-first score in SQL**, with PostGIS for the distance to each station.

![GoDaddy Registry](https://raw.githubusercontent.com/JowiAoun/beluga/main/images/devpost/logo-godaddy-registry.png)

- **[beluga.surf](https://beluga.surf)**: the landing page, the app at `/walk` and the dashboard at `/map`. A beluga on a wave needed a `.surf`. 🏄

**Design**: the site and the dashboard share one look, with dark blue, contour lines like a sea chart and the 3D beluga. The walking screen keeps big targets, the Atkinson Hyperlegible font and a Stop button you hold, so a coat brushing the screen can't end a walk.

## Challenges we ran into 🧗

- **When to interrupt**: constant sound drowns out traffic, and too little leaves an obstacle unnoticed. We settled on a narrow corridor, short sounds, one warning at a time, and repeats that speed up as you get closer.
- **Bone conduction**: the earbuds sit outside the ear, so the 3D audio we first planned didn't work. We rebuilt the sounds around level, timing and pitch, and had the voice say the side.
- **Seeing and forgetting**: an upload sent the moment an agent conversation started came back 404 or 408. Zero Retention Mode turns off uploads altogether. A delete sent as a conversation ended was undone when ElevenLabs saved it a few seconds later. Each needed its own fix before frames could be both seen and deleted.
- **A stalled loop**: the object detector stalled the sensing loop until we moved it into a web worker.
- **The venue network**: it blocks the database port, so migrations and the seed ran from a phone hotspot.

## Accomplishments that we're proud of 🏆

- **0** network calls between a depth reading and its warning.
- **5 to 6 s** for a full Ask, voice included, and **under 2 s** for Ask the data.
- **429,093** labelled simulated events loaded into Tiger Cloud in **53 s**.
- **17 to 92 ms** for a 7-day question from the continuous aggregate, against about **390 ms** on the raw table.
- **10.4×** smaller once older chunks are compressed.
- **287** automated tests.

And a few we can't put a number on:

- The same moment that warns you can also put a lasting hazard in front of the people who fix it.
- Privacy built into reporting: opt-in, anonymous, locations rounded to about 100 m, and no image ever stored.
- The triage agent names a "sidewalk closed" barrier as a construction barrier with 0.95 confidence, and the conversation holding the frame is gone a few seconds later.
- A judge's live report joins the fix-first queue within seconds.

## What we learned 💡

- **Less is more**: accessibility is as much about what to leave out as what to add. More alerts don't make a better walk. Timing, direction and a few clear sounds do.
- **Bone conduction is its own craft**: fewer, clearer cues beat a realistic sound stage.
- **Two jobs, two speeds**: depth keeps the warnings quick and local, and the agents add context only when you ask.
- **One tool per agent**: an agent with one client tool is a clean way to get structured answers out of a model, and the same tools can hand it data.
- **Real-time aggregates**: continuous aggregates make a dashboard fast without a cache, as long as today's bucket stays real-time.

## What's next for beluga 🚀

- **Co-design with CNIB**: tune the sounds, the warning distances, the chest mount and Ask with blind and low-vision users. None co-designed this version.
- **More testing**: different light, crowded sidewalks and more kinds of obstacles.
- **A pilot with OC Transpo** at the O-Train stations.
- **Closer to the city**: group repeated reports better, and fit the fix-first queue into the City's own 311 work.

---

## Built with

webxr, arcore, gemini, elevenlabs, tiger-data, next.js, react, typescript, web-audio-api, postgresql, timescaledb, tailwind-css, maplibre-gl, recharts, zod, vercel, pwa

## Try it out

- [beluga.surf](https://beluga.surf): the landing page
- [beluga.surf/walk](https://www.beluga.surf/walk): the app, in Chrome on an Android phone with ARCore depth
- [beluga.surf/map](https://www.beluga.surf/map): the city dashboard
- [GitHub](https://github.com/JowiAoun/beluga): the source
- [YouTube](https://www.youtube.com/watch?v=Pz9jS8v5VJ8): the demo video

## Technology feedback

For the feedback question on the submission form.

**ElevenLabs** (Agents, Eleven v3, Sound Effects, Scribe v2): Eleven v3 gave us five voices that sound natural even on one-word warnings like "pole" and "left". The Sound Effects API turned a text prompt into a warning sound in seconds, so we designed all 12 in an afternoon. Scribe v2 was accurate enough that we used it to check all 200 of our voice recordings. Agents with one client tool were a clean way to get structured answers back. A few things slowed us down:

- A file uploaded right after a conversation starts can come back 404 or 408, so we wait and retry.
- Zero Retention Mode turns off file uploads, so we couldn't use it for camera frames.
- Deleting a conversation right after it ends gets undone when ElevenLabs saves it a few seconds later. A "delete when done" option would help any app that promises not to keep images.
- Sound Effects' `pcm_48000` output is stereo with no header, and the docs don't say so. Our first pass came out twice as long and an octave low.
- Text to Speech offers `wav_48000`, but Sound Effects doesn't.
- On very short lines, v3 now and then says the wrong word ("pole" came out as "pull"), so we retook a few.

**Gemini** (inside the ElevenLabs agents): Gemini Flash-Lite answered in about 2.5 s a turn, against 4 to 7 s for Flash, which is fast enough for a question asked mid-walk. It read street scenes well: it named a "sidewalk closed" barrier as a construction barrier with 0.95 confidence. Using it through ElevenLabs also meant one less API key on the backend.

**Tiger Data** (Tiger Cloud, TimescaleDB): continuous aggregates in real-time mode made the dashboard fast with no cache. A 7-day question dropped from about 390 ms on the raw table to 17 to 92 ms. Compression made older chunks 10.4 times smaller, and 429,093 rows loaded in 53 s on the free service. Our one snag came from the venue: its network blocked the database port, so we ran migrations from a phone hotspot. A way to connect over port 443 would help at hackathons.

**WebXR & ARCore depth in Chrome**: depth in the browser, with no app store, is what made beluga possible in a weekend. It needs a little motion, and glass and shiny floors leave holes in the depth. Safari has no WebXR AR, so an iPhone falls back to camera mode.
