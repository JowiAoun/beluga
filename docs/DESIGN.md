# beluga design

How every beluga page looks, moves and loads: colours, fonts, components, motion, 3D and accessibility. Read it before changing any page. The build plan is still `docs/PLAN.md`.

**beluga is made for blind and low-vision people, so the site has to be striking and still pass every accessibility check.** That pairing is our pitch for the UI design prize.

## The idea

The look follows landonorris.com, in blue: big uppercase headings that mix a heavy sans with a thin serif, flat sections that switch between dark, black and light, one bright accent, square corners, and faint contour lines behind everything.

Belugas find their way by echolocation, and every page shows it with one motif: **sonar rings**, circles that grow out of a point and fade.

- Out of the hero beluga's forehead (belugas echolocate from the bump there, the melon)
- From the earbuds' contact pads, on the side the sound plays
- On the map, where a new report lands
- While something loads

The contour lines are the sea floor as sonar maps it, and the hand-drawn scribble is a wave with three sonar arcs, the logo's motif.

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

- The small icons sit on a navy tile (`#0b1320`), so the white whale still shows on light tab bars. The tile predates the blue restyle and stays: the icons are cached by file name.
- The service worker serves `/icons` from its cache first, so a changed icon gets a new file name.

## Colours

Defined once in `app/globals.css` as CSS variables with matching `@theme` tokens. A section picks its colour set with a tone utility: `tone-dark` (the default), `tone-ink`, `tone-paper` or `tone-accent`. The tone redefines the variables, so every token class inside it (`text-foreground`, `text-muted`, `border-line`) follows. Contrast is measured against the tone's own `background`.

| Token | `tone-dark` | `tone-ink` | `tone-paper` | Use |
| --- | --- | --- | --- | --- |
| `background` | `#1b232c` | `#0f141a` | `#eef3f6` | Section fill |
| `foreground` | `#eef3f6` (14.2:1) | `#eef3f6` (16.6:1) | `#1b232c` (14.2:1) | Text |
| `muted` | `#afbec8` (8.3:1) | `#afbec8` (9.7:1) | `#424e57` (7.6:1) | Second-level text |
| `sonar` | `#75c7f0` (8.5:1) | `#75c7f0` (9.9:1) | `#005e99` (6.1:1) | Serif words, links, eyebrows, rings |
| `focus` | `#29b8ff` | `#29b8ff` | `#005e99` | The focus ring |
| `surface` | `#222b35` | `#161c23` | `#e2e9ee` | Panels, opaque |
| `line` | `#434c57` | `#363e48` | `#b9c4cc` | Hairlines and contours, decoration only |
| `line-strong` | `#6b7784` (3.5:1) | `#626e7b` (3.6:1) | `#7a8793` (3.3:1) | Borders of inputs, selects, outline buttons and cards |

The same on every tone:

| Token | Value | Use |
| --- | --- | --- |
| `accent` | `#29b8ff` (7.1:1 on dark, 8.3:1 on ink) | The one accent: main buttons, the simulated-data labels, fills, the active item. On `paper` it is a fill only, never text (2:1) |
| `on-accent` | `#0f141a` (8.3:1 on accent) | Text and icons on `accent`. Never `text-background`, which turns light inside `tone-paper` |
| `abyss` | `#0f141a` | Behind the map, the walking screen's boxes |
| `paper` | `#eef3f6` | The light fill, for use outside a tone |
| `danger` | `#991b1b` (8.3:1 with white text) | Stop, Check now, severity 4 |

`tone-accent` is the blue band: `#29b8ff` with `#0f141a` text, focus ring and lines.

- There is no yellow left. Blue means "act here" or "this is simulated", and the words always say which.
- Never use slate-500 (3.9:1), blue-600 (3.6:1) or anything darker for text on the dark tones.
- The map and charts use a blue ramp that gets lighter as a spot gets worse (`SCORE_COLOURS` in `app/map/format.ts`). Each step is at least 1.6:1 from the next, so colour-blind viewers can tell them apart by lightness. Severity always shows as a number or word too.

## Type

- [Mona Sans](https://fonts.google.com/specimen/Mona+Sans): headings, buttons, eyebrows and big numbers. Weight 800, uppercase through CSS, so the source stays in sentence case.
- [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif): the words a heading leans on, in `sonar`, through `<Serif>` in `components/brand/Display.tsx`. Headings only, never body text.
- [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next): paragraphs, form labels, captions, tables, and every word on the walking screen. The Braille Institute made it for low-vision readers.
- [Atkinson Hyperlegible Mono](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono): distances, times and table numbers.

All four load in `app/layout.tsx` with `next/font/google` as CSS variables, behind `--font-display`, `--font-serif`, `--font-sans` and `--font-mono`.

| Style | Size | Leading | Tracking |
| --- | --- | --- | --- |
| `text-hero` | `clamp(2.75rem, 11vw, 9rem)` | 0.88 | `-0.035em` |
| `text-section` | `clamp(2.25rem, 7vw, 5.5rem)` | 0.9 | `-0.03em` |
| `text-statement` | `clamp(2rem, 4.4vw, 4.25rem)` | 0.95 | `-0.025em` |
| `text-impact` | `clamp(4rem, 10vw, 10rem)` | 0.9 | `-0.04em` |
| Body on `/` and `/map` | 18 px (`text-lg`), lines 65 characters at most | normal | normal |
| Body on `/walk` | 20 px (`text-xl`) or larger | normal | normal |

- `DISPLAY` in `Display.tsx` is the heading class: Mona Sans, 800, uppercase, balanced.
- The name is always lowercase. Inside an uppercase heading or button, write it as `<Name />`.
- `cn()` in `lib/utils.ts` knows the four sizes and the two new fonts. Without that, it drops `text-section` when `text-muted` comes after it.

## Shape & surfaces

- **Flat.** No shadows, glows, blur, dot grids or gradient blobs. The one gradient is the blue arc behind the footer panel.
- **Corners**: square for panels, cards, images, tables and the map. `rounded-md` (6 px) for buttons, inputs, selects, badges and pills. `rounded-[1.5rem]` for the footer panel only. Dots and rings stay round.
- **Cards**: `CARD` in `components/brand/Card.tsx`, a hairline `line` border on `surface`. `NotchCard` is the outline card with a label tab at the bottom right.
- **Buttons**: `rounded-md`, Mona Sans uppercase, at least 48 px tall (64 px on `/walk`). The main button is blue with `on-accent` text and turns `foreground` on hover. The second button is a `line-strong` outline. On `/walk` the buttons keep Atkinson in sentence case.
- **Backgrounds**: `Contours`, the depth lines in `public/textures`, masked over the `line` colour.
- **Icons**: [Tabler](https://tabler.io/icons) at 24 px, always next to a word.

## Motion

- Easing: `ease-water`, `cubic-bezier(0.65, 0.05, 0, 1)`, for reveals, wipes and colour changes. `ease-out-expo`, `cubic-bezier(0.19, 1, 0.22, 1)`, for the text roll. Sonar rings keep their calm `cubic-bezier(0.22, 1, 0.36, 1)`.
- Durations: 300 ms for hovers and colour changes, 600 ms for the text roll, 750 to 900 ms for a section coming into view and for the menu wipe. Sections animate in once and stay.
- Headings slide up line by line out of a mask (`RevealHeading`). Buttons and big links roll their label up on hover and keyboard focus (`Roll`). The scribble draws itself in once.
- Nothing flashes more than 3 times a second.
- Anything that moves by itself for more than 5 seconds stops when the **Pause motion** switch in the navbar is on (WCAG 2.2.2). The switch is saved on the device.
- With `prefers-reduced-motion`, nothing moves by itself: no marquee, no roll, no wipe, the scribble shows whole, and 3D scenes show their still image. Fades stay.
- `/walk` gets no Motion library and no view transitions. Its setup screens use CSS transitions and the 3D beluga (`app/walk/WalkBeluga.tsx`). Tapping Start swaps the whole screen, which unmounts the canvas and frees its GPU context, so nothing 3D or animated runs during a walk: the GPU belongs to depth and the detector.

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
| Magic UI | `animated-beam` | The two speeds diagram |
| Magic UI | `number-ticker` | Dashboard and "For the city" numbers |
| Our own | `Contours`, `Scribble`, `NotchCard`, `Marquee`, `Roll`, `RevealHeading` | Every page, in `components/brand` |
| shadcn/ui | `switch`, `slider`, `tooltip`, `dialog`, `sonner` | If a page needs one |

Leave out:

- Lenis: it takes the scroll wheel from the map, and keyboard and magnifier users feel the lag.
- GSAP, `@react-three/postprocessing` and `@google/model-viewer`: a second animation engine, and too heavy for phones.
- Anything that glows, blurs or follows the pointer: Spotlight, Glowing Effect, Border Beam, Sparkles, Vortex, Card Spotlight. The flat look has no place for them.
- Magic UI Dock (mouse only) and Globe (Ottawa is one city).

Fix these when you use them:

- A marquee repeats its items, so screen readers read each one 2 to 4 times. Put `aria-hidden` on it, and keep the words elsewhere on the page.
- Number Ticker shows 0 first. Put the final value in `sr-only` and `aria-hidden` the ticker.
- Magic UI never checks reduced motion. Gate it with `motion-safe:` or `useReducedMotion()`.

## Folders

| Path | Holds |
| --- | --- |
| `components/ui` | Copied Magic UI and shadcn components. Edit them only to fix accessibility or to match the look |
| `components/brand` | Logo, Display (`DISPLAY`, `Serif`, `Name`, `Eyebrow`), Button and `Roll`, Card, NotchCard, Section and its tones, Contours, Scribble, Marquee, SonarRings, Navbar, PauseMotion |
| `components/three` | 3D scenes and the typed model components |
| `lib/utils.ts` | `cn()` |
| `public/3d` | GLB models, and a still `.webp` of each scene with the same name |
| `public/textures` | The contour lines, `contours-a.svg` and `contours-b.svg` |

These belong to track D. Restyling `app/map` (track C) or `app/walk` (track A) goes in small, separate commits, as `AGENTS.md` says.

## 3D

### Models

| File | Status | Where | Parts |
| --- | --- | --- | --- |
| `public/3d/trekz-air.glb` | Done (390 KB, 120 KB after meshopt) | Hear a warning, then the exploded view | Shells, contact pads, rear pods, neckband. Hide `TrekzAir_wordmark_00`, `TrekzAir_wordmark_01` and `TrekzAir_emblem`: they carry the AfterShokz marks |
| `public/3d/beluga.glb` | Done (560 KB, 146 KB after `dedup` and meshopt): the beluga riding a wave | Hero | Body, tail flukes, flippers, face, sunglasses, cane, wave, foam and droplets, 50 named parts. The parts are baked in place, so `BelugaScene.tsx` finds the tail and flipper pivots from their bounds |
| `public/3d/phone.glb` | Done (1.54 MB, 79 KB after `resize`, `webp` and meshopt) | How it works, step 1 | Frame, glass, display, camera plate and lenses, 31 named parts. Its OnePlus and Hasselblad marks are swapped for plain panels, and its screen shows the beluga walk screen. No mount yet |
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

| # | Section | Tone | What's in it |
| --- | --- | --- | --- |
| 1 | Navbar | clear, then `dark` once scrolled | Skip link first, then the logo; on the right Pause motion, "Try beluga" and Menu. Menu opens a full-screen native `<dialog>` with the links in `text-section`, Pause motion and the beluga still |
| 2 | Hero | `dark`, contours | The 3D beluga on the water, rings from its forehead. The heading "Hear what's / in your way." Buttons: "Try beluga (Android Chrome)" and "City dashboard". Right under them, the disclaimer: research prototype, not a medical device, use it with a cane or guide dog. A still of the beluga (`public/3d/beluga.webp`) shows first |
| 3 | Marquee | `accent` | Left, ahead, right, step down, head height, sliding. `aria-hidden` |
| 4 | Statement | `paper`, contours | One big sentence about sounds coming from the obstacle's side, with the scribble |
| 5 | Hear a warning | `paper` | A "Hear a warning (headphones on)" button plays 3 real sounds once each: left, ahead, right. It uses `lib/audio/placement.ts` and `lib/audio/library.ts`, so it pans like the earbuds do. The 3D earbuds light the contact pad on the side that plays, and the giant word for that side fills blue. Caption in `aria-live="polite"`, like "Left: pole, 2 m". A Stop button, low starting volume, no loop, and the AudioContext made inside the click |
| 6 | How it works | `ink` | 4 notched cards in a staggered row: depth (the 3D phone and its corridor), sound, Ask, the city |
| 7 | Two speeds | `dark`, contours | Animated Beam: camera, depth, hazard, sound, earbuds, labelled "on the phone, no network". Below it the slower paths: Ask to an ElevenLabs agent with Gemini, and report to Tiger Data to the dashboard |
| 8 | Features | `paper` | A hairline grid of 6: bone conduction, drop-offs and head height, Ask, works offline, TalkBack, privacy |
| 9 | Privacy | `dark` | What is sent and what is never sent, side by side, in the same words as the first-run flow |
| 10 | For the city | `ink` | Big number tickers from `/api/dashboard/perf`: rows, raw and aggregate query times, compression ratio. A link to `/map` |
| 11 | Footer | `paper` into the blue arc | The dark panel with a bump on top: "Hear the way.", the scribble, the 3D beluga, the page links, "Built with" and Try beluga. Under it, on `accent`: the disclaimer and "not affiliated with the City of Ottawa or OC Transpo" |

### Dashboard `/map`

Desktop first for the demo laptop, then phones.

- **Header**: `dark` with contours, the eyebrow, and "beluga for cities" in `text-section`. Filters sit in a flat bar. They stay native `<select>` elements, styled, since those work best with TalkBack and phone pickers. The simulated-data banner is blue with `on-accent` text.
- **Stats**: 4 flat cards with big Mona Sans number tickers: reports, reporters, near-misses, compression ratio.
- **Check now**: a flat panel with a red frame and bar.
- **Queue**: still a real `<table>`. Sticky header, the selected row tinted blue with a blue bar on its left, the rank in Mono. On phones it scrolls sideways with the place column fixed.
- **Map**: OpenFreeMap's `dark` style with its background set to `abyss`. Cells are `fill-extrusion` bars at `pitch: 50`, height and blue ramp by score. Quiet cells are grey. A sonar ring where a new report lands. Flying to a selected cell stays.
- **Charts**: flat bars in `accent`, a custom tooltip, and a draw-in on first load only.
- **Live feed**: new reports slide in and ring.
- **Performance**: raw and aggregate query times as two bars, the numbers in Mono.
- **Phones**: stats, then the map at 60% of the screen height, then the queue, feed, stations and performance.

### Walk `/walk`, `/walk/check`, `/walk/sounds`

No Motion and no view transitions on these pages. The only canvas is the 3D beluga on the `/walk` setup and start screens, and it's gone before a walk starts.

- **Setup**: the 3D beluga at the top (its still with reduced motion, no WebGL2 or offline), "beluga" in big Mona Sans, step dots ("2 of 5"), the buttons in Atkinson and the height in big Mono digits. A CSS slide between steps. Headings in Mona Sans; everything else in Atkinson.
- **During a walk**: colours, font and corners only, with no animation, blur or shadow. The status pill, Ask and Stop keep their sizes, and Stop keeps its hold-to-fill.
- **`/walk/sounds`**: a head seen from above with a dot moving to each side, in CSS.
- **`/walk/check`**: checklist cards, each result as a word and an icon.
- The manifest and theme colour are `#1b232c`, the dark tone.

## Accessibility rules

1. `<MotionConfig reducedMotion="user">` wraps `/` and `/map`. CSS animations use `motion-safe:`. Canvases and JS loops check `useReducedMotion()` themselves.
2. The Pause motion switch stops everything that moves by itself.
3. Everything focusable gets `outline: 3px solid var(--focus); outline-offset: 3px` on `:focus-visible`: bright blue on the dark tones, `#005e99` on `paper`, near-black on `accent`.
4. Under `contrast-more:` and `forced-colors:`, contours, the scribble and the blue arc go, and notched cards fall back to a plain border.
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

1. The corridor in 3D (done in `PhoneScene.tsx`; the 2D drawing is its still)
2. The exploded view
3. The 3D map (the flat squares stay)
4. The view transitions

## Credits

The README credits what sits in `components/ui`: Magic UI (MIT) and shadcn/ui (MIT). It also credits any CC BY model.
