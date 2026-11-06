import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACORN,
  DIEHARD,
  GLIDER,
  LWSS,
  R_PENTOMINO,
  SEEDS,
  createGrid,
  resize,
  stamp,
  step,
  type Grid,
  type Pattern,
} from "./life.ts";

const place = (g: Grid, pattern: Pattern, ox: number, oy: number) => {
  for (const [x, y] of pattern) g.cells[(oy + y) * g.cols + ox + x] = 1;
};
const steps = (g: Grid, n: number) => {
  for (let i = 0; i < n; i++) step(g);
};
const population = (g: Grid) => g.cells.reduce((sum, c) => sum + c, 0);
const liveCells = (g: Grid) =>
  [...g.cells.keys()]
    .filter((i) => g.cells[i])
    .map((i) => [i % g.cols, Math.floor(i / g.cols)]);
const BLOCK: Pattern = [[0, 0], [1, 0], [0, 1], [1, 1]];
const BLINKER: Pattern = [[0, 0], [1, 0], [2, 0]];

test("a lone cell dies on the next tick", () => {
  const g = createGrid(9, 9);
  place(g, [[0, 0]], 4, 4);
  step(g);
  assert.equal(population(g), 0);
});

test("a block stays still", () => {
  const g = createGrid(9, 9);
  place(g, BLOCK, 4, 4);
  const before = liveCells(g);
  steps(g, 5);
  assert.deepEqual(liveCells(g), before);
});

test("a blinker has period 2", () => {
  const g = createGrid(9, 9);
  place(g, BLINKER, 3, 4);
  const before = liveCells(g);
  step(g);
  assert.deepEqual(liveCells(g), [[4, 3], [4, 4], [4, 5]]);
  step(g);
  assert.deepEqual(liveCells(g), before);
});

test("a glider moves diagonally by 1 cell every 4 ticks", () => {
  const g = createGrid(30, 30);
  place(g, GLIDER, 5, 5);
  const before = liveCells(g);
  steps(g, 4);
  assert.deepEqual(liveCells(g), before.map(([x, y]) => [x! + 1, y! + 1]));
});

test("a lightweight spaceship moves straight by 2 cells every 4 ticks", () => {
  const g = createGrid(40, 20);
  place(g, LWSS, 20, 8);
  const before = liveCells(g);
  steps(g, 4);
  const moved = liveCells(g);
  const shift = moved[0]![0]! - before[0]![0]!;
  assert.equal(Math.abs(shift), 2);
  assert.deepEqual(moved, before.map(([x, y]) => [x! + shift, y]));
});

test("an R-pentomino reaches a population of 116 at generation 1103", () => {
  const g = createGrid(600, 600);
  place(g, R_PENTOMINO, 300, 300);
  steps(g, 1103);
  assert.equal(population(g), 116);
});

test("a diehard vanishes at generation 130", () => {
  const g = createGrid(100, 100);
  place(g, DIEHARD, 45, 50);
  steps(g, 129);
  assert.ok(population(g) > 0);
  step(g);
  assert.equal(population(g), 0);
});

test("settled detects repeating grids but not moving ones", () => {
  const still = createGrid(9, 9);
  place(still, BLOCK, 4, 4);
  steps(still, 6);
  assert.equal(still.settled, false, "needs a full 6-tick history first");
  step(still);
  assert.equal(still.settled, true);

  const blinker = createGrid(9, 9);
  place(blinker, BLINKER, 3, 4);
  steps(blinker, 7);
  assert.equal(blinker.settled, true);

  const glider = createGrid(60, 60);
  place(glider, GLIDER, 5, 5);
  for (let i = 0; i < 40; i++) {
    step(glider);
    assert.equal(glider.settled, false);
  }
});

test("spaceships leave through every edge without leaving debris", () => {
  for (const pattern of [GLIDER, LWSS]) {
    for (let bits = 0; bits < 8; bits++) {
      const choices = [bits & 1, bits & 2, bits & 4].map((b) => (b ? 0 : 0.9));
      const g = createGrid(40, 40, 8);
      stamp(g, pattern, 20, 20, () => choices.shift()!);
      steps(g, 120);
      assert.equal(population(g), 0);
    }
  }
});

test("without the edge wipe a glider would hit the wall and become a block", () => {
  const g = createGrid(20, 20);
  place(g, GLIDER, 10, 10);
  steps(g, 60);
  assert.equal(population(g), 4);
});

test("stamp puts a live cell on the target in every orientation", () => {
  for (const pattern of SEEDS) {
    for (let bits = 0; bits < 8; bits++) {
      const choices = [bits & 1, bits & 2, bits & 4].map((b) => (b ? 0 : 0.9));
      const g = createGrid(40, 40);
      stamp(g, pattern, 20, 20, () => choices.shift()!);
      assert.equal(g.cells[20 * 40 + 20], 1);
      assert.equal(population(g), pattern.length);
    }
  }
});

test("stamp never writes to the outer ring, even at a corner", () => {
  const g = createGrid(12, 12);
  stamp(g, ACORN, 1, 1);
  stamp(g, ACORN, 10, 10);
  for (let i = 0; i < 12; i++) {
    for (const index of [i, 132 + i, i * 12, i * 12 + 11]) {
      assert.equal(g.cells[index], 0);
    }
  }
});

test("resize keeps cells in place and the outer ring dead", () => {
  const g = createGrid(20, 20);
  place(g, BLOCK, 3, 3);
  place(g, BLOCK, 17, 17);
  resize(g, 30, 25);
  assert.equal(g.cells[3 * 30 + 3], 1);
  assert.equal(population(g), 8);

  resize(g, 10, 10);
  assert.deepEqual(liveCells(g), [[3, 3], [4, 3], [3, 4], [4, 4]]);
  step(g);
  assert.equal(population(g), 4);
});
