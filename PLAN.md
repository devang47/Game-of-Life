# Game of Life: plan

A full-screen website that runs Conway's Game of Life as a living background
effect. It starts by itself, clicks add new life, and the tick rate is adjustable.

## The target look

Measured from the reference screenshot. Colours are sampled from its pixels.

| Property | Value |
| --- | --- |
| Background | `#22242a` |
| Cell size | 16 screenshot px, about **8 CSS px** assuming a 2x display |
| Cell shape | hard square, no rounding, no glow |
| Cell colour | `#f3f8fa` |
| Between touching cells | faint blue-white seam, `#e8f2fa`, not a dark gap |
| Settled vs active cells | the still block is slightly whiter, `#fbfdfe`. Not reproduced: the difference is about 3% |

## Behaviour

| Requirement | Decision |
| --- | --- |
| Full screen | One fixed canvas filling the viewport, redrawn crisply at the device pixel ratio |
| Auto-start | Running from page load with no start button. The page starts blank. With no click, 3 random seeds drop one by one across the first 5 seconds; the first click cancels any still to come |
| Click anywhere | Adds 1 seed at that cell on release, visible even between ticks |
| Scroll | Zooms between 2 and 64 CSS px per cell, keeping the point under the cursor fixed. Trackpad pinch and the `+` and `-` keys work too |
| Drag | Moves the view. A press that moves under 4 CSS px counts as a click. One finger on touch, arrow keys on a keyboard |
| Tick rate | Slider from 1 to 60 ticks per second, default 10, applied instantly |

### Why a click can't place a single cell

Under the Life rules a lone cell has no neighbours, so it dies on the very next
tick and nothing grows from it. A click therefore stamps one small pattern from a
mix, with a random rotation and flip, always with a live cell on the clicked cell:

| Seed | Behaviour | Odds |
| --- | --- | --- |
| R-pentomino | stays active for 1103 generations, about 110 s at the default speed | 2 in 7 |
| Acorn | stays active for 5206 generations, about 9 minutes | 2 in 7 |
| Diehard | grows, then vanishes completely at generation 130 | 1 in 7 |
| Glider | flies diagonally off the screen | 1 in 7 |
| Lightweight spaceship | flies straight off the screen | 1 in 7 |

### Keeping the page alive

Left alone, Life settles into static blocks and blinkers within a few minutes,
and a dead background is the main way this effect could fail.

- **Detect:** hash the cells on screen every tick and compare with the hashes from
  24 and 120 ticks ago. Only the screen counts, because a glider crossing a far part
  of the world can take minutes to leave and would otherwise block keep-alive. 24 ticks catches periods 1, 2, 3, 4, 6, 8 and 12 quickly, including
  anything locked to the 8-tick edge wipe. 120 ticks also catches periods 5, 10
  and 15, so a pentadecathlon can't keep the page frozen forever.
- **Respond:** 3 seconds after settling, drop one new seed at a random spot on
  screen. It collides with the debris and restarts activity. This only begins once the page
  has had its first click or its 3 automatic seeds, so the blank start stays blank.

### Screen edges

Cells run off the edge of the world rather than wrapping around. The world is a
fixed 1024x1024 cells, and the camera can't show the outer 16 on each side, so the
boundary is never on screen. The minimum zoom rises where needed so the world always
fills the window.

A dead boundary alone isn't enough, because it acts as a wall: a test showed a
glider hitting it turning into a stable block. So the outer 8 hidden cells are
wiped every 8 ticks. Nothing in Life moves faster than 1 cell per tick, so nothing
can reach the wall between wipes, and gliders leave for good.

## Architecture

No framework and no runtime dependencies. Vite and TypeScript are dev tools only,
and the build output is static files that can be hosted anywhere.

```
index.html          canvas, slider, CSS
src/life.ts         pure engine with no DOM: grid, step, stamp, hash
src/life.test.ts    runs on node --test, no test framework needed
src/main.ts         camera, rendering, frame loop, pointer and key input, slider
```

`life.ts` stays free of DOM code so that it can move into the portfolio site later
without changes.

- **Grid:** two `Uint8Array` buffers, swapped each tick.
- **Scale:** the world is about 1M cells. A full scan takes about 2.6 ms typically
  and 5.1 ms when dense, measured on one Mac. That fits the 16.7 ms frame at top
  speed, so a worker, WebGL and sparse structures all stay out.
- **Camera:** the cell size and the camera position are whole device pixels, so
  cells stay sharp at every zoom. The zoom value itself is fractional, so small
  trackpad movements add up instead of being rounded away.
- **Timing:** `requestAnimationFrame` with a time accumulator, running as many
  ticks as have come due. Elapsed time is capped at 250 ms per frame so that a
  backgrounded tab can't trigger a burst of catch-up ticks.
- **Drawing:** redraw only after a tick or a click. Cells are positioned on whole
  device pixels so edges stay sharp. Live cells are filled in two passes: the seam
  colour at full size, then the cell colour 1 CSS px smaller.
- **Resize:** the world doesn't change, only the camera's limits, so no cells are lost.

## Milestones

All milestones are done. The site is live at
https://devang47.github.io/Game-of-Life/ and every push to `main` redeploys it, as
long as the tests and build pass.

**1. Engine.** `life.ts` plus tests. Done when `node --test` passes on:
- a lone cell dying
- a block staying still
- a blinker having period 2
- a glider moving diagonally by 1 cell every 4 ticks
- an R-pentomino reaching a population of 116 at generation 1103
- a diehard vanishing at generation 130

**2. Full-screen rendering.** Canvas, frame loop and automatic seeds. Done when a
screenshot looks like the reference side by side, stays sharp at 1x and 2x, and a
tick at 4K (480x270 visible cells at 8 px on a 1x display) takes under 4 ms.

**3. Interaction.** Click to seed via `pointerdown`, so touch works too, plus
keep-alive. Done when a click lands exactly on the pointer's cell at any display
scale, and the page is still active after 10 minutes untouched.

**4. Tick control and accessibility.** A native range input in a corner, styled to
stay out of the way. Clicks on it must not seed cells. Done when:
- it works by keyboard and has a label
- with `prefers-reduced-motion`, the default drops to 2 ticks per second

**5. Polish and ship.** Tune the colours, and make the build work from any URL
path. Then deploy.

## Left out until there's a reason

| Skipped | Add it when |
| --- | --- |
| Drag to paint cells | Clicking alone feels limited once it's playable |
| Brightness that follows cell age | A 3% difference starts to matter; it needs a second array |
| Pause, clear, step buttons | You want the page to be a toy as well as an effect |
| Pattern picker, rule editor | Probably never for a background |
| Pinch to zoom on touch screens | Phones need zoom; one-finger pan already works |
| Worker, WebGL, Hashlife | Tick time starts missing the frame budget on real devices |
| Overlay mode with page content behind it | You embed this in the portfolio |