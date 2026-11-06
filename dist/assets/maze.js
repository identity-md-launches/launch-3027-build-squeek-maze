// @ts-check
/** @typedef {{x: number, y: number}} Point */
export const SIZE = 21;
/** @type {Readonly<Record<string, Point>>} */
export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});
/** @param {number} seed */
export function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
/** @param {Point} p */
export const key = (p) => p.y * SIZE + p.x;
/** @param {number} n @returns {Point} */
export const point = (n) => ({ x: n % SIZE, y: Math.floor(n / SIZE) });
/** @param {number[][]} grid @param {Point} p */
export const isOpen = (grid, p) => grid[p.y]?.[p.x] === 0;
/** @param {number[][]} grid @param {Point} p @returns {Point[]} */
export const neighbors = (grid, p) =>
  Object.values(DIRECTIONS)
    .map((d) => ({ x: p.x + d.x, y: p.y + d.y }))
    .filter((p) => isOpen(grid, p));
/** Recursive backtracking, with seeded braiding to create arcade escape routes.
 * @param {number} level */
export function generateMaze(level) {
  const random = seededRandom(level * 982451653);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  /** @param {number} x @param {number} y */
  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = Object.values(DIRECTIONS)
      .map((d) => ({ d, order: random() }))
      .sort((a, b) => a.order - b.order);
    for (const { d } of dirs) {
      const nx = x + d.x * 2,
        ny = y + d.y * 2;
      if (
        nx < 1 ||
        ny < 1 ||
        nx >= SIZE - 1 ||
        ny >= SIZE - 1 ||
        grid[ny][nx] === 0
      )
        continue;
      grid[y + d.y][x + d.x] = 0;
      carve(nx, ny);
    }
  }
  carve(1, 19);
  const braid = Math.max(0.1, 0.65 - level * 0.011);
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      if (grid[y][x] === 1 && x % 2 !== y % 2 && random() < braid)
        grid[y][x] = 0;
    }
  }
  return grid;
}
/** Breadth-first distances from a target. @param {number[][]} grid @param {Point} target */
export function distanceMap(grid, target) {
  const distances = new Int16Array(SIZE * SIZE).fill(-1);
  const queue = [target];
  distances[key(target)] = 0;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const next of neighbors(grid, p)) {
      if (distances[key(next)] !== -1) continue;
      distances[key(next)] = distances[key(p)] + 1;
      queue.push(next);
    }
  }
  return distances;
}
/** @param {number} level */
export function difficulty(level) {
  const tier = Math.min(4, Math.floor((level - 1) / 10));
  return {
    snakes: Math.min(4, tier + 1),
    snakeSpeed: 1.95 + tier * 0.43 + (level - 1) * 0.016,
    playerSpeed: 5.2,
    powerDuration: level > 40 ? 3 : level > 30 ? 3.5 : 5,
    beans: level > 40 ? 1 : level > 30 ? 2 : 4,
    name: [
      "Peanut patch",
      "Snake country",
      "Narrow escapes",
      "Deep burrows",
      "The final stretch",
    ][tier],
  };
}
