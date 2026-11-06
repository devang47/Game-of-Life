import { SEEDS, createGrid, stamp, step, type View } from "./life.ts";

const WORLD_SIZE = 1024; // cells per side
const MARGIN = 16; // cells at the world's edge that the camera can't show
const EDGE = 8; // the outer part of the margin that gets wiped
const DEFAULT_ZOOM = 8; // CSS px per cell
const MIN_ZOOM = 2;
const MAX_ZOOM = 64;
const WHEEL_SPEED = 0.002;
const PINCH_SPEED = 0.01; // trackpad pinches arrive as ctrl+wheel with small deltas
const KEY_ZOOM = 1.25;
const KEY_PAN = 64; // CSS px
const DRAG_THRESHOLD = 4; // CSS px a press can move and still count as a click
const CELL_COLOR = "#f3f8fa";
const SEAM_COLOR = "#e8f2fa";
const AUTO_SEEDS = 3;
const AUTO_SEED_WINDOW = 5000; // ms
const KEEP_ALIVE_DELAY = 3000; // ms the view stays settled before a new seed
const MAX_FRAME_TIME = 250; // ms, stops a backgrounded tab bursting on return

const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const slider = document.querySelector<HTMLInputElement>("#speed")!;
const readout = document.querySelector("output")!;
const grid = createGrid(WORLD_SIZE, WORLD_SIZE, EDGE);

// The camera is in whole device pixels so cells always land on the pixel grid.
let zoom = DEFAULT_ZOOM;
let cellPx = 1;
let camX = 0; // where the world's top-left corner sits on the canvas
let camY = 0;
let drag: {
  id: number;
  startX: number;
  startY: number;
  camX: number;
  camY: number;
  moved: boolean;
} | null = null;

let ticksPerSecond = 0;
let autoSeedsDropped = 0;
let clicked = false;
let settledAt: number | null = null;
let lastFrame = performance.now();
const startTime = lastFrame;
let elapsed = 0;
let dirty = true;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const deviceScale = () => canvas.width / canvas.clientWidth;

function clampCamera(): void {
  const far = (WORLD_SIZE - MARGIN) * cellPx;
  camX = clamp(camX, canvas.width - far, -MARGIN * cellPx);
  camY = clamp(camY, canvas.height - far, -MARGIN * cellPx);
  dirty = true;
}

// Applies `zoom`, keeping the world point at this canvas position where it is.
function applyZoom(anchorX: number, anchorY: number): void {
  const dpr = devicePixelRatio;
  const shown = WORLD_SIZE - MARGIN * 2;
  // The world must always fill the window, so it never shows an edge.
  const minPx = Math.max(
    Math.ceil(MIN_ZOOM * dpr),
    Math.ceil(canvas.width / shown),
    Math.ceil(canvas.height / shown),
  );
  zoom = clamp(zoom, minPx / dpr, Math.max(MAX_ZOOM, minPx / dpr));
  const next = Math.round(zoom * dpr);
  camX = Math.round(anchorX - ((anchorX - camX) / cellPx) * next);
  camY = Math.round(anchorY - ((anchorY - camY) / cellPx) * next);
  cellPx = next;
  clampCamera();
}

function zoomBy(factor: number, clientX: number, clientY: number): void {
  zoom *= factor;
  applyZoom(clientX * deviceScale(), clientY * deviceScale());
}

function fit(): void {
  canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
  canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
  applyZoom(0, 0);
}

function centerCamera(): void {
  const centered = (size: number) =>
    Math.round((size - WORLD_SIZE * cellPx) / 2 / cellPx) * cellPx;
  camX = centered(canvas.width);
  camY = centered(canvas.height);
  clampCamera();
}

function visibleCells(): View {
  return {
    x0: Math.max(0, Math.floor(-camX / cellPx)),
    y0: Math.max(0, Math.floor(-camY / cellPx)),
    x1: Math.min(WORLD_SIZE, Math.ceil((canvas.width - camX) / cellPx)),
    y1: Math.min(WORLD_SIZE, Math.ceil((canvas.height - camY) / cellPx)),
  };
}

function setSpeed(value: number): void {
  ticksPerSecond = value;
  elapsed = 0; // time saved up at a slow speed would burst out at a fast one
  slider.value = String(value);
  slider.setAttribute("aria-valuetext", `${value} ticks per second`);
  readout.textContent = `${value}/s`;
}

function dropSeed(x: number, y: number): void {
  stamp(grid, SEEDS[Math.floor(Math.random() * SEEDS.length)]!, x, y);
  dirty = true;
}

function dropRandomSeed(): void {
  const { x0, y0, x1, y1 } = visibleCells();
  const inset = () => 0.1 + Math.random() * 0.8; // keeps it clear of the screen edge
  dropSeed(x0 + Math.floor((x1 - x0) * inset()), y0 + Math.floor((y1 - y0) * inset()));
}

function draw(): void {
  const { cells } = grid;
  const { x0, y0, x1, y1 } = visibleCells();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Seam colour at full size, then the cell colour an eighth smaller, so touching
  // cells show a faint line between them.
  const seam = Math.max(1, Math.round(cellPx / 8));
  for (const [color, size] of [[SEAM_COLOR, cellPx], [CELL_COLOR, cellPx - seam]] as const) {
    ctx.fillStyle = color;
    for (let y = y0; y < y1; y++) {
      const row = y * WORLD_SIZE;
      for (let x = x0; x < x1; x++) {
        if (cells[row + x]) {
          ctx.fillRect(camX + x * cellPx, camY + y * cellPx, size, size);
        }
      }
    }
  }
}

function frame(now: number): void {
  elapsed += Math.min(now - lastFrame, MAX_FRAME_TIME);
  lastFrame = now;

  const interval = 1000 / ticksPerSecond;
  const view = visibleCells();
  while (elapsed >= interval) {
    step(grid, view);
    elapsed -= interval;
    dirty = true;
  }

  const nextAutoSeedAt = ((autoSeedsDropped + 1) * AUTO_SEED_WINDOW) / AUTO_SEEDS;
  if (!clicked && autoSeedsDropped < AUTO_SEEDS && now - startTime >= nextAutoSeedAt) {
    dropRandomSeed();
    autoSeedsDropped++;
  }

  settledAt = grid.settled && !drag ? (settledAt ?? now) : null;
  const started = clicked || autoSeedsDropped === AUTO_SEEDS;
  if (started && settledAt !== null && now - settledAt >= KEEP_ALIVE_DELAY) {
    dropRandomSeed();
  }

  if (dirty) {
    draw();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !event.isPrimary) return;
  canvas.setPointerCapture(event.pointerId);
  drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    camX,
    camY,
    moved: false,
  };
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== drag?.id) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  drag.moved = true;
  canvas.style.cursor = "grabbing";
  camX = drag.camX + Math.round(dx * deviceScale());
  camY = drag.camY + Math.round(dy * deviceScale());
  clampCamera();
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== drag?.id) return;
  if (!drag.moved) {
    clicked = true;
    dropSeed(
      Math.floor((drag.startX * deviceScale() - camX) / cellPx),
      Math.floor((drag.startY * deviceScale() - camY) / cellPx),
    );
  }
  drag = null;
  canvas.style.cursor = "";
});

canvas.addEventListener("pointercancel", () => {
  drag = null;
  canvas.style.cursor = "";
});

// On the window so that a pinch over the slider can't zoom the whole page.
addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    const speed = event.ctrlKey ? PINCH_SPEED : WHEEL_SPEED;
    zoomBy(Math.exp(-event.deltaY * lines * speed), event.clientX, event.clientY);
  },
  { passive: false },
);

addEventListener("keydown", (event) => {
  // Arrows belong to the slider while it has focus, ctrl/cmd + plus to the browser.
  if (event.target === slider || event.ctrlKey || event.metaKey) return;
  const pan = KEY_PAN * deviceScale();
  const centerX = canvas.clientWidth / 2;
  const centerY = canvas.clientHeight / 2;
  if (event.key === "ArrowLeft") camX += pan;
  else if (event.key === "ArrowRight") camX -= pan;
  else if (event.key === "ArrowUp") camY += pan;
  else if (event.key === "ArrowDown") camY -= pan;
  else if (event.key === "+" || event.key === "=") zoomBy(KEY_ZOOM, centerX, centerY);
  else if (event.key === "-") zoomBy(1 / KEY_ZOOM, centerX, centerY);
  else return;
  camX = Math.round(camX);
  camY = Math.round(camY);
  clampCamera();
});

slider.addEventListener("input", () => setSpeed(slider.valueAsNumber));
setSpeed(matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 10);

addEventListener("resize", fit);
fit();
centerCamera();
requestAnimationFrame(frame);
