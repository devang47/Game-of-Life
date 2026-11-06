// Conway's Game of Life engine. No DOM, so it can move to another site unchanged.

export type Grid = {
  cols: number;
  rows: number;
  edge: number; // width of the band around the grid that gets wiped; 0 turns it off
  cells: Uint8Array;
  next: Uint8Array;
  generation: number;
  settled: boolean; // true when the grid repeats with a period of 1, 2, 3 or 6
  history: Int32Array;
};

export type Pattern = readonly (readonly [x: number, y: number])[];

const parse = (art: string[]): Pattern =>
  art.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === "X" ? [[x, y] as const] : [])),
  );

export const R_PENTOMINO = parse([".XX", "XX.", ".X."]);
export const ACORN = parse([".X.....", "...X...", "XX..XXX"]);
export const DIEHARD = parse(["......X.", "XX......", ".X...XXX"]);
export const GLIDER = parse([".X.", "..X", "XXX"]);
export const LWSS = parse([".X..X", "X....", "X...X", "XXXX."]);

// The long-lived seeds are twice as likely as the short-lived ones.
export const SEEDS = [R_PENTOMINO, R_PENTOMINO, ACORN, ACORN, DIEHARD, GLIDER, LWSS];

export function createGrid(cols: number, rows: number, edge = 0): Grid {
  return {
    cols,
    rows,
    edge,
    cells: new Uint8Array(cols * rows),
    next: new Uint8Array(cols * rows),
    generation: 0,
    settled: false,
    history: new Int32Array(6),
  };
}

function clearEdges({ cols, rows, cells, edge }: Grid): void {
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    if (y < edge || y >= rows - edge) {
      cells.fill(0, row, row + cols);
    } else {
      cells.fill(0, row, row + edge);
      cells.fill(0, row + cols - edge, row + cols);
    }
  }
}

// The outermost ring is never computed or stamped, so it stays dead. That makes it
// a wall: a glider hitting it turns into a stable block. So the edge band is wiped
// every `edge` ticks. Nothing moves faster than 1 cell per tick, so nothing can
// cross the band and reach the wall between wipes.
export function step(g: Grid): void {
  const { cols, rows, cells, next } = g;
  if (g.edge && g.generation % g.edge === 0) clearEdges(g);
  let hash = 0x811c9dc5 | 0;
  for (let y = 1; y < rows - 1; y++) {
    const row = y * cols;
    for (let x = 1; x < cols - 1; x++) {
      const i = row + x;
      const n =
        cells[i - cols - 1]! + cells[i - cols]! + cells[i - cols + 1]! +
        cells[i - 1]! + cells[i + 1]! +
        cells[i + cols - 1]! + cells[i + cols]! + cells[i + cols + 1]!;
      const alive = n === 3 || (n === 2 && cells[i] === 1) ? 1 : 0;
      next[i] = alive;
      if (alive) hash = Math.imul(hash ^ i, 16777619);
    }
  }
  g.cells = next;
  g.next = cells;

  // Comparing with the hash from 6 ticks ago catches periods 1, 2, 3 and 6.
  const slot = g.generation % 6;
  g.settled = g.history[slot] === hash;
  g.history[slot] = hash;
  g.generation++;
}

// Stamps the pattern in a random orientation, with a live cell exactly on (x, y).
export function stamp(
  g: Grid,
  pattern: Pattern,
  x: number,
  y: number,
  random: () => number = Math.random,
): void {
  const swap = random() < 0.5;
  const flipX = random() < 0.5 ? -1 : 1;
  const flipY = random() < 0.5 ? -1 : 1;
  const placed = pattern.map(([px, py]) => [
    (swap ? py : px) * flipX,
    (swap ? px : py) * flipY,
  ] as const);

  // The live cell nearest the pattern's centre goes on the target cell.
  const meanX = placed.reduce((sum, [px]) => sum + px, 0) / placed.length;
  const meanY = placed.reduce((sum, [, py]) => sum + py, 0) / placed.length;
  const distance = ([px, py]: readonly [number, number]) =>
    (px - meanX) ** 2 + (py - meanY) ** 2;
  const anchor = placed.reduce((best, cell) =>
    distance(cell) < distance(best) ? cell : best,
  );

  for (const [px, py] of placed) {
    const cx = x + px - anchor[0];
    const cy = y + py - anchor[1];
    if (cx > 0 && cy > 0 && cx < g.cols - 1 && cy < g.rows - 1) {
      g.cells[cy * g.cols + cx] = 1;
    }
  }
  g.settled = false;
}

// Keeps every cell at the same top-left position.
export function resize(g: Grid, cols: number, rows: number): void {
  const cells = new Uint8Array(cols * rows);
  for (let y = 1; y < Math.min(rows, g.rows) - 1; y++) {
    for (let x = 1; x < Math.min(cols, g.cols) - 1; x++) {
      cells[y * cols + x] = g.cells[y * g.cols + x]!;
    }
  }
  g.cols = cols;
  g.rows = rows;
  g.cells = cells;
  g.next = new Uint8Array(cols * rows);
  g.settled = false;
  g.history.fill(0);
}
