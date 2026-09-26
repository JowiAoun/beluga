# beluga design

How every beluga page looks, moves and loads: colours, fonts, components, motion, 3D and accessibility. Read it before changing any page. The build plan is still `docs/PLAN.md`.

**beluga is made for blind and low-vision people, so the site has to be striking and still pass every accessibility check.** That pairing is our pitch for the UI design prize.

## The idea

Belugas find their way by echolocation, and every page shows it with one motif: **sonar rings**, circles that grow out of a point and fade.

- Out of the hero beluga's forehead (belugas echolocate from the bump there, the melon)
- From the earbuds' contact pads, on the side the sound plays
- When a main button is pressed
- On the map, where a new report lands
- While something loads

Motion is slow and calm, like water. Nothing bounces or shakes.

## Logo & icons

The logo is `images/image.png`: the beluga in sunglasses, holding a white cane, riding a wave. The 3D beluga in the hero is the same pose.

| File | Size | Use |
| --- | --- | --- |
| `app/favicon.ico` | 16, 32 and 48 px | Browser tabs |
| `app/icon.png` | 192 px | Tab icon for browsers that take a PNG |
| `app/apple-icon.png` | 180 px | iPhone home screen |
| `public/icons/beluga-192.png`, `beluga-512.png` | 192 and 512 px | Installed app, rounded navy tile |
| `public/icons/beluga-maskable-192.png`, `beluga-maskable-512.png` | 192 and 512 px | Installed app on Android, logo inside the safe zone |
| `public/icons/logo-128.png`, `logo-256.webp`, `logo-512.webp` | 128 to 512 px | `BelugaMark` on the pages |
| `app/opengraph-image.jpg` | 1200 × 630 | Link previews on Devpost and in chats |

- The small icons sit on a navy tile (`#0b1320`), so the white whale still shows on light tab bars.
- The service worker serves `/icons` from its cache first, so a changed icon gets a new file name.

## Colours

Defined once in `app/globals.css` as CSS variables with matching `@theme` tokens. Contrast is measured against `background`.

| Token | Value | Contrast | Use |
| --- | --- | --- | --- |
| `background` | `#0b1320` | | Page background (already there) |
| `abyss` | `#060b14` | | Deeper bands between sections, behind the map |
| `foreground` | `#f2f5f7` | 17:1 | Text (already there) |
| `muted` | `#94a3b8` | 7.3:1 | Second-level text |
| `accent` | `#fde047` | 14:1 | Tactile yellow: main buttons, focus rings, the simulated-data banner (already there) |
| `sonar` | `#38bdf8` | 8.7:1 | From the logo's wave: rings, glows, lines, links |
| `surface` | `rgb(255 255 255 / 0.05)` | | Card fill |
| `line` | `rgb(255 255 255 / 0.1)` | | Card and table borders |
| `danger` | `#991b1b` | 8.3:1 with white text | Stop button |

- Never use slate-500 (3.9:1), blue-600 (3.6:1) or anything darker for text.
- Gradient or glowing text: check its darkest stop against the brightest thing behind it.
- The map and charts keep the viridis scale in `app/map/format.ts`, which colour-blind viewers can read. Severity always shows as a number or word too.

## Type

- [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next): every word on every page. The Braille Institute made it for low-vision readers. Variable, weight 200 to 800, with italics.
- [Atkinson Hyperlegible Mono](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono): numbers, stats, distances and times.

Load both in `app/layout.tsx` with `next/font/google` (`Atkinson_Hyperlegible_Next`, `Atkinson_Hyperlegible_Mono`) as CSS variables, and point `--font-sans` and `--font-mono` at them in `@theme`.

| Style | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Hero heading | `clamp(2.75rem, 8vw, 6rem)` | 800 | `-0.02em` |
| Section heading | `clamp(2rem, 5vw, 3.5rem)` | 700 | `-0.01em` |
| Body on `/` and `/map` | 18 px (`text-lg`), lines 65 characters at most | 400 | normal |
| Body on `/walk` | 20 px (`text-xl`) or larger | 400 to 700 | normal |
| Numbers | Mono with `tabular-nums` | 500 | normal |

## Shape & surfaces

- **Cards**: `rounded-3xl`, `surface` fill, 1 px `line` border. Background blur (`backdrop-blur-md`) only from the `md` breakpoint up, since it slows phones.
- **Buttons**: `rounded-2xl`, at least 48 px tall (64 px on `/walk`). The main button is yellow with navy text. The second button has a `line` border and white text.
- **Backgrounds**: a faint dot grid on `abyss`, with a soft `sonar` glow behind the one thing each section is about.
- **Icons**: [Tabler](https://tabler.io/icons) at 24 px, always next to a word.

## Motion

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for everything that enters or moves.
- Durations: 150 ms for presses and hovers, 300 ms for UI changes, 600 to 900 ms for a section coming into view. Sections animate in once and stay.
- Nothing flashes more than 3 times a second.
- Anything that moves by itself for more than 5 seconds stops when the **Pause motion** switch in the navbar is on (WCAG 2.2.2). The switch is saved on the device.
- With `prefers-reduced-motion`, nothing moves by itself. Fades stay. 3D scenes show their still image.
- `/walk` gets no Motion library, no canvas and no view transitions. Its setup screens use CSS transitions only, and nothing animates during a walk: the GPU belongs to depth and the detector.

## Libraries

Install in one commit, so `package.json` and the lockfile change once.

1. Run `npm i -E motion@13.4.4 clsx@2.1.1 tailwind-merge@3.7.0 @tabler/icons-react@3.48.0 three@0.186.1 @react-three/fiber@9.8.1 @react-three/drei@10.7.9`
2. Run `npm i -D -E @types/three@0.186.0`
3. Write `components.json` by hand (below). Skip `shadcn init`: it applies its own preset, and the hand-written file leaves `app/globals.css` alone.
4. Add `cn()` in `lib/utils.ts`, built from `clsx` and `tailwind-merge`.

To add a component:

1. Run `npx shadcn@latest add @aceternity/<name> --dry-run` and read what it adds.
2. Run it again without `--dry-run`.
3. Copy the component's keyframes from its docs page into `app/globals.css`, inside `@theme inline`. Tailwind v4 has no `tailwind.config`.
4. Check `package.json`: a component can ask for an older `motion`. Keep 13.4.4.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "zinc", "cssVariables": true, "prefix": "" },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils",
    "hooks": "@/hooks"
  },
  "registries": {
    "@aceternity": "https://ui.aceternity.com/registry/{name}.json",
    "@magicui": "https://magicui.design/r/{name}",
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

### What we take

| From | Component | Where |
| --- | --- | --- |
| Aceternity | Resizable Navbar | Top of `/` and `/map` |
| Aceternity | Spotlight New | Hero, light coming down like through water |
| Aceternity | Encrypted Text | Hero heading (it already sets `aria-label`) |
| Aceternity | Background Ripple Effect | Hear a warning: a tap sends out a ring |
| Aceternity | Sticky Scroll Reveal | How it works, next to the corridor scene |
| Aceternity | Bento Grid, Glowing Effect | Features, and the dashboard stat cards (pass `disabled={false}`) |
| Aceternity | Grid and Dot backgrounds | Section backgrounds |
| Magic UI | `ripple` | Sonar rings, pure CSS |
| Magic UI | `number-ticker` | Dashboard and "For the city" numbers |
| Magic UI | `animated-beam` | The two speeds diagram |
| Magic UI | `border-beam` | One card only: Check now on `/map` |
| React Bits | `Waves-TS-TW` | The water under the hero |
| React Bits | `BlurText-TS-TW` | Section headings coming in |
| shadcn/ui | `switch`, `slider`, `tooltip`, `dialog`, `sonner` | Pause motion, settings, toasts |

Leave out:

- Lenis: it takes the scroll wheel from the map, and keyboard and magnifier users feel the lag.
- GSAP, `@react-three/postprocessing` and `@google/model-viewer`: a second animation engine, and too heavy for phones.
- Aceternity Sparkles, Globe, 3D Globe, Vortex, Canvas Reveal and Card Spotlight: heavy canvas or WebGL.
- Magic UI Dock (mouse only) and Globe (Ottawa is one city).
- Aceternity Tabs and Animated Modal: the keyboard can't use them. Take the shadcn versions.

Fix these when you use them:

- Infinite Moving Cards and Magic UI Marquee repeat their items, so screen readers read each one 2 to 4 times. Put `aria-hidden` on the copies.
- Flip Words changes text every 3 seconds with no pause. Tie it to Pause motion and put the whole list in `sr-only`.
- Aurora Background wraps its content in its own `<main>`. Change it to a `<div>`.
- Number Ticker shows 0 first. Put the final value in `sr-only` and `aria-hidden` the ticker.
- Split-letter text (BlurText, Encrypted Text) keeps the whole text in `sr-only` or `aria-label`, with the animated copy `aria-hidden`.
- Magic UI and React Bits never check reduced motion. Gate them with `motion-safe:` or `useReducedMotion()`.

## Folders

| Path | Holds |
| --- | --- |
| `components/ui` | Copied Aceternity, Magic UI, React Bits and shadcn components. Edit them only to fix accessibility |
| `components/brand` | Logo, SonarRings, Button, Card, Section, PauseMotion |
| `components/three` | 3D scenes and the typed model components |
| `lib/utils.ts` | `cn()` |
| `public/3d` | GLB models, and a still `.webp` of each scene with the same name |

These belong to track D. Restyling `app/map` (track C) or `app/walk` (track A) goes in small, separate commits, as `AGENTS.md` says.

## 3D

### Models

| File | Status | Where | Parts |
| --- | --- | --- | --- |
| `public/3d/trekz-air.glb` | Done (390 KB, 120 KB after meshopt) | Hear a warning, then the exploded view | Shells, contact pads, rear pods, neckband. Hide `TrekzAir_wordmark_00`, `TrekzAir_wordmark_01` and `TrekzAir_emblem`: they carry the AfterShokz marks |
| `public/3d/beluga.glb` | Done (560 KB, 146 KB after `dedup` and meshopt): the beluga riding a wave | Hero | Body, tail flukes, flippers, face, sunglasses, cane, wave, foam and droplets, 50 named parts. The parts are baked in place, so `BelugaScene.tsx` finds the tail and flipper pivots from their bounds |
| `public/3d/phone-mount.glb` | Maybe later | How it works | Screen, lens, clamp, strap. Until then, a drei `RoundedBox` |
| `public/3d/scooter.glb` | Maybe later | How it works | Until then, boxes and cylinders |

Built in code with no model: the walking corridor, the pole, the head-height sign, the step-down edge, the construction barrier, the tactile strip (repeated bumps), the sonar rings and the map's 3D cells.

### Making a model

Ask the generator for the same style as the earbuds:

- GLB from Blender, real size in metres, Y up, origin at the bottom centre
- Each part its own named mesh, like `Beluga_tail` and `Beluga_cane`, so code can move it
- Flat colours on a small texture atlas, from the palette above where it fits
- Under 10k triangles (the water can take a few thousand more)

Meshy's free output is CC BY 4.0, so credit it in the README. Tripo's free output is non-commercial, so don't use it. Rodin needs a paid plan.

### Shrinking & typing a model

1. Run `npx @gltf-transform/cli@4.5.0 meshopt <in>.glb public/3d/<name>.glb`. The earbuds drop from 390 KB to 120 KB (60 KB gzip) and keep all 14 parts. drei's JS carries the decoder, so it works offline.
2. For a big generated model, run the same CLI's `simplify`, `resize --width 1024` and `webp` first, then `meshopt`. Aim for under 1 MB. Run `dedup` first when many parts share a colour: it took the beluga from 50 materials to 11.
3. Skip `optimize`: it joins the parts into 2 meshes and merges `trekz_blue` into `ink_black`. Skip `draco`: its decoder loads from `gstatic.com`.
4. Run `npx gltfjsx@6.5.3 public/3d/<name>.glb --types --keepnames -o components/three/<Name>.tsx`, then fix three things so `tsc` passes:
   - Change `JSX.IntrinsicElements['group']` to `ThreeElements['group']`.
   - Delete `animations: GLTFAction[]`.
   - Cast the `useGLTF` result with `as unknown as GLTFResult`, and check its path by hand.

### Loading

```
app/page.tsx (server)
└ SceneSlot ("use client")
   ├ still image public/3d/<name>.webp, always the first paint
   ├ mounts the canvas only when on screen, with WebGL2 and motion allowed
   └ dynamic(() => import("@/components/three/<Scene>"), { ssr: false })
      └ <Canvas dpr={[1, 1.5]} frameloop={onScreen ? "always" : "never"} aria-hidden>
         ├ PerformanceMonitor: drop to dpr 1, then back to the still image
         ├ ambient and directional light
         ├ Suspense > the model, reading a scroll value in useFrame
         └ ContactShadows frames={1}
```

- `ssr: false` only works inside a Client Component (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`).
- Scroll: `useScroll({ target })` from `motion/react`, read with `scrollYProgress.get()` in `useFrame`. It follows normal page scroll, so the keyboard and screen readers keep working.
- Every canvas is `aria-hidden`, with the same meaning in real text beside it.
- Per scene: under 100k triangles and 30 draw calls. No postprocessing and no live shadows. No drei `Environment`, which downloads lighting files at runtime. No `OrbitControls`, which blocks page scrolling on touch.
- Lint: `react-hooks/immutability` fails when code changes `useGLTF`'s `nodes` or `materials`. Give the part its own `<meshStandardMaterial ref>` and change that.
- The 3D code is about 263 KB gzip and loads only on `/`, after the first paint. Leaving the page unmounts the canvas and frees the GPU before `/walk`.

## Pages

### Landing `/`

| # | Section | What's in it |
| --- | --- | --- |
| 1 | Navbar | Skip link first, then the logo, How it works, Hear it, City dashboard, Try beluga and Pause motion |
| 2 | Hero | The beluga on the water in 3D, rings from its forehead, Waves below and Spotlight from above. The heading in Encrypted Text. Buttons: "Try beluga (Android Chrome)" and "City dashboard". Right under them, the disclaimer: research prototype, not a medical device, use it with a cane or guide dog. A still of the beluga (`public/3d/beluga.webp`) shows first |
| 3 | Hear a warning | A "Hear a warning (headphones on)" button plays 3 real sounds once each: left, ahead, right. It uses `lib/audio/placement.ts` and `lib/audio/library.ts`, so it pans like the earbuds do. The 3D earbuds light the contact pad on the side that plays. Caption in `aria-live="polite"`, like "Left: pole, 2 m". A Stop button, low starting volume, no loop, and the AudioContext made inside the click. Scrolling on spreads the earbuds into their parts, each with a label |
| 4 | How it works | Sticky Scroll Reveal with 4 steps (depth, sound, Ask, the city) beside the corridor scene. A 0.9 m × 3 m corridor comes out of the phone's lens. A pole, a head-height sign, a step-down edge and a scooter slide in, and each lights up and rings from its side |
| 5 | Two speeds | Animated Beam: camera → depth → hazard → sound → earbuds, labelled "on the phone, no network". Below it the slower paths: Ask → ElevenLabs agent with Gemini → voice, and report → Tiger Data → dashboard |
| 6 | Features | Bento Grid with Glowing Effect: bone conduction, drop-offs and head height, Ask, works offline, TalkBack, privacy |
| 7 | Privacy | What is sent and what is never sent, side by side, in the same words as the first-run flow |
| 8 | For the city | Live number tickers from `/api/dashboard/perf`: rows, raw and aggregate query times, compression ratio. A link to `/map` |
| 9 | Footer | Built with (text, no logos), source link, "not affiliated with the City of Ottawa or OC Transpo", the disclaimer again and the credits |

### Dashboard `/map`

Desktop first for the demo laptop, then phones.

- **Header**: the logo morphs over from `/` with React's `<ViewTransition name="beluga-mark">`, which needs no config in Next 16. Filters sit in a glass bar. They stay native `<select>` elements, styled, since those work best with TalkBack and phone pickers. The yellow simulated-data banner stays as it is.
- **Stats**: 4 cards with number tickers and Glowing Effect: reports, reporters, near-misses, compression ratio.
- **Check now**: the one card with a Border Beam, in red.
- **Queue**: still a real `<table>`. Sticky header, a glow on the selected row, the rank in Mono. On phones it scrolls sideways with the place column fixed.
- **Map**: OpenFreeMap's `dark` style with its background set to `abyss`. Cells become `fill-extrusion` bars at `pitch: 50`, height by score. `fill-extrusion-opacity` can't change per cell, so how busy a cell is moves into its colour or height. A sonar ring where a new report lands. Flying to a selected cell stays.
- **Charts**: gradient fills, a custom tooltip, and a draw-in on first load only.
- **Live feed**: new reports slide in and ring.
- **Performance**: raw and aggregate query times as two bars, the numbers in Mono.
- **Phones**: stats, then the map at 60% of the screen height, then the queue, feed, stations and performance.

### Walk `/walk`, `/walk/check`, `/walk/sounds`

No Motion, no canvas and no view transitions on these pages.

- **Setup**: the 2D mascot at the top, step dots ("2 of 5"), the new buttons and the height in big Mono digits. A CSS slide between steps.
- **During a walk**: new colours and font only, with no animation, blur or shadow. The status pill, Ask and Stop keep their sizes, and Stop keeps its hold-to-fill.
- **`/walk/sounds`**: a head seen from above with a dot moving to each side, in CSS.
- **`/walk/check`**: checklist cards, each result as a word and an icon.
- The manifest and theme colour stay `#0b1320`.

## Accessibility rules

1. `<MotionConfig reducedMotion="user">` wraps `/` and `/map`. CSS animations use `motion-safe:`. Canvases and JS loops check `useReducedMotion()` themselves.
2. The Pause motion switch stops everything that moves by itself.
3. Everything focusable gets `outline: 3px solid #fde047; outline-offset: 3px` on `:focus-visible`.
4. Under `contrast-more:` and `forced-colors:`, glows, blur and gradient text turn into solid colours.
5. The first thing on each page is a skip link to `<main id="main" tabindex="-1">`.
6. Every effect keeps real text for screen readers.
7. Colour and motion never carry meaning alone.
8. Targets are at least 44 px, and 48 px on `/walk` (its main buttons stay 64 px and up).
9. Hover effects are decoration. Anything useful also works by tap and keyboard.

## Test

1. Check every page at 360, 390, 768, 1024, 1440 and 1920 px wide, and in Safari on an iPhone, since judges open the site on their own phones.
2. Run `npx lighthouse http://localhost:3000 --only-categories=accessibility --view` on `/` and `/map`. Aim for 100.
3. Run axe DevTools in Chrome on each page.
4. Turn on reduced motion (Chrome DevTools, Rendering, "Emulate CSS media feature prefers-reduced-motion") and check nothing moves by itself.
5. Go through each page with the keyboard only.
6. Go through the `/walk` setup with TalkBack on.

## Order of work & cut list

Feature freeze is 02:00, Sunday Sept 27.

1. Foundation: libraries, colours, fonts, `cn`, brand components, Pause motion and the meshopt earbuds. Everything else waits on this commit.
2. Landing hero, with the 2D logo until the beluga arrives.
3. Hear a warning with the earbuds, then the rest of the landing page.
4. Dashboard restyle and 3D map, in parallel once step 1 lands.
5. Walk screens, in parallel once step 1 lands.
6. The beluga, then any later models, as they arrive.
7. Accessibility and width pass, then the Devpost screenshots.

When behind, cut from the top:

1. The corridor in 3D (a 2D SVG animation takes its place)
2. The exploded view
3. The 3D map (the flat squares stay)
4. The view transitions

## Credits

The README credits what sits in `components/ui`: Aceternity UI (free components, which can't be resold as a component library), Magic UI (MIT), React Bits (MIT with Commons Clause) and shadcn/ui (MIT). It also credits any CC BY model.
