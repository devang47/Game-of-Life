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
| Settled vs active cells | the still block is slightly whiter, `#fbfdfe`, so brightness may follow cell age (an inference, see milestone 5) |

## Behaviour

| Requirement | Decision |
| --- | --- |
| Full screen | One fixed canvas filling the viewport, redrawn crisply at the device pixel ratio |
| Auto-start | Running from page load with no start button. The page starts blank. With no click, 3 random seeds drop one by one across the first 5 seconds; the first click cancels any still to come |
| Click anywhere | Adds 1 seed at that cell, immediately visible, even between ticks |
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

- **Detect:** hash the grid every tick and compare with the hashes from 24 and 120
  ticks ago. 24 ticks catches periods 1, 2, 3, 4, 6, 8 and 12 quickly, including
  anything locked to the 8-tick edge wipe. 120 ticks also catches periods 5, 10
  and 15, so a pentadecathlon can't keep the page frozen forever.
- **Respond:** 3 seconds after settling, drop one new seed at a random spot. It
  collides with the debris and restarts activity. This only begins once the page
  has had its first click or its 3 automatic seeds, so the blank start stays blank.

### Screen edges

Cells run off the edge of the screen rather than wrapping around, which matches
the reference, where a cluster is cut off at the left edge. The grid extends 16
hidden cells past each side of the viewport.

A dead boundary alone isn't enough, because it acts as a wall: a test showed a
glider hitting it turning into a stable block. So the outer 8 hidden cells are
wiped every 8 ticks. Nothing in Life moves faster than 1 cell per tick, so nothing
can reach the wall between wipes, and gliders leave for good.

## Architecture

No framework and no runtime dependencies. Vite and TypeScript are dev tools only,
and the build output is static files that can be hosted anywhere.

```
index.html          canvas, slider, CSS
src/life.ts         pure engine with no DOM: grid, step, stamp, resize, hash
src/life.test.ts    runs on node --test, no test framework needed
src/main.ts         rendering, frame loop, pointer input, slider
```

`life.ts` stays free of DOM code so that it can move into the portfolio site later
without changes.

- **Grid:** two `Uint8Array` buffers, swapped each tick.
- **Scale:** 1920x1080 at 8 px is 272x167 cells including the margin, about 45k.
  A full scan each tick should be well under the frame budget, so a worker, WebGL
  and sparse structures all stay out. Milestone 2 confirms this by measuring.
- **Timing:** `requestAnimationFrame` with a time accumulator, running as many
  ticks as have come due. Elapsed time is capped at 250 ms per frame so that a
  backgrounded tab can't trigger a burst of catch-up ticks.
- **Drawing:** redraw only after a tick or a click. Cells are positioned on whole
  device pixels so edges stay sharp. Live cells are filled in two passes: the seam
  colour at full size, then the cell colour 1 CSS px smaller.
- **Resize:** copy the existing cells into the new grid rather than resetting.

## Milestones

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

**5. Polish and ship.** Tune the colours, and add age-based brightness only if the
side-by-side shows it matters, since it needs a second array. Then deploy.

## Left out until there's a reason

| Skipped | Add it when |
| --- | --- |
| Drag to paint cells | Clicking alone feels limited once it's playable |
| Pause, clear, step buttons | You want the page to be a toy as well as an effect |
| Pattern picker, rule editor | Probably never for a background |
| Worker, WebGL, Hashlife | Milestone 2's tick measurement misses its budget |
| Overlay mode with page content behind it | You embed this in the portfolio |

## Open questions

1. **Hosting:** not needed until milestone 5.
