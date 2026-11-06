import { SEEDS, createGrid, resize, stamp, step } from "./life.ts";

const CELL_SIZE = 8; // CSS px
const MARGIN = 16; // hidden cells past each side of the viewport
const EDGE = 8; // the outer part of the margin that gets wiped
const CELL_COLOR = "#f3f8fa";
const SEAM_COLOR = "#e8f2fa";
const AUTO_SEEDS = 3;
const AUTO_SEED_WINDOW = 5000; // ms
const MAX_FRAME_TIME = 250; // ms, stops a backgrounded tab bursting on return

const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const grid = createGrid(MARGIN * 2 + 1, MARGIN * 2 + 1, EDGE);

let cellPx = CELL_SIZE;
let ticksPerSecond = 10;
let autoSeedsDropped = 0;
let lastFrame = performance.now();
const startTime = lastFrame;
let elapsed = 0;
let dirty = true;

function fit(): void {
  const dpr = devicePixelRatio;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  cellPx = Math.max(1, Math.round(CELL_SIZE * dpr));
  resize(
    grid,
    Math.ceil(canvas.width / cellPx) + MARGIN * 2,
    Math.ceil(canvas.height / cellPx) + MARGIN * 2,
  );
  dirty = true;
}

function dropRandomSeed(): void {
  const pattern = SEEDS[Math.floor(Math.random() * SEEDS.length)]!;
  const inset = () => 0.1 + Math.random() * 0.8; // keeps it clear of the screen edge
  stamp(
    grid,
    pattern,
    MARGIN + Math.floor((grid.cols - MARGIN * 2) * inset()),
    MARGIN + Math.floor((grid.rows - MARGIN * 2) * inset()),
  );
  dirty = true;
}

function draw(): void {
  const { cols, rows, cells } = grid;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Seam colour at full size, then the cell colour 1 CSS px smaller, so touching
  // cells show a faint line between them.
  const seam = Math.max(1, Math.round(devicePixelRatio));
  for (const [color, size] of [[SEAM_COLOR, cellPx], [CELL_COLOR, cellPx - seam]] as const) {
    ctx.fillStyle = color;
    for (let y = MARGIN; y < rows - MARGIN; y++) {
      for (let x = MARGIN; x < cols - MARGIN; x++) {
        if (cells[y * cols + x]) {
          ctx.fillRect((x - MARGIN) * cellPx, (y - MARGIN) * cellPx, size, size);
        }
      }
    }
  }
}

function frame(now: number): void {
  elapsed += Math.min(now - lastFrame, MAX_FRAME_TIME);
  lastFrame = now;

  const interval = 1000 / ticksPerSecond;
  while (elapsed >= interval) {
    step(grid);
    elapsed -= interval;
    dirty = true;
  }

  const nextAutoSeedAt = ((autoSeedsDropped + 1) * AUTO_SEED_WINDOW) / AUTO_SEEDS;
  if (autoSeedsDropped < AUTO_SEEDS && now - startTime >= nextAutoSeedAt) {
    dropRandomSeed();
    autoSeedsDropped++;
  }

  if (dirty) {
    draw();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

addEventListener("resize", fit);
fit();
requestAnimationFrame(frame);
