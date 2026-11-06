// @ts-check
import {
  generateMaze,
  difficulty,
  SIZE,
  key,
  point,
  isOpen,
  neighbors,
  distanceMap,
  DIRECTIONS,
} from "./maze.js";
/** @typedef {import('./maze.js').Point} Point */
/** @typedef {'menu'|'countdown'|'playing'|'paused'|'hit'|'levelComplete'|'gameOver'|'won'} Phase */
/** @typedef {{tile: Point, from: Point, to: Point|null, progress: number, direction: string, trail: Point[], respawn: number, spawn: Point}} Actor */
/** @param {Point} p @returns {Actor} */
const actor = (p) => ({
  tile: { ...p },
  from: { ...p },
  to: null,
  progress: 0,
  direction: "right",
  trail: [],
  respawn: 0,
  spawn: { ...p },
});
/** @param {Actor} a @returns {Point} */
export function position(a) {
  return a.to
    ? {
        x: a.from.x + (a.to.x - a.from.x) * a.progress,
        y: a.from.y + (a.to.y - a.from.y) * a.progress,
      }
    : a.tile;
}
export class Game {
  constructor() {
    /** @type {Phase} */ this.phase = "menu";
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.power = 0;
    this.boost = false;
    this.clock = 0;
    this.timer = 0;
    this.invincible = 0;
    this.queuedDirection = "right";
    /** @type {(event: string) => void} */ this.onEvent = () => {};
    this.grid = generateMaze(1);
    this.config = difficulty(1);
    this.player = actor({ x: 1, y: 19 });
    /** @type {Actor[]} */ this.snakes = [];
    /** @type {Map<number, number>} */ this.food = new Map();
    this.total = 0;
    this.loadLevel();
  }
  start() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.loadLevel();
    this.phase = "countdown";
    this.timer = 2.5;
    this.onEvent("start");
  }
  loadLevel() {
    this.grid = generateMaze(this.level);
    this.config = difficulty(this.level);
    this.food = new Map();
    this.power = 0;
    this.invincible = 1.6;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (this.grid[y][x] === 0 && !(x === 1 && y === 19))
          this.food.set(key({ x, y }), 10);
      }
    const beans = [
      { x: 1, y: 1 },
      { x: 19, y: 19 },
      { x: 19, y: 1 },
      { x: 1, y: 17 },
    ];
    beans.slice(0, this.config.beans).forEach((p) => this.food.set(key(p), 50));
    this.total = this.food.size;
    this.resetActors();
  }
  resetActors() {
    this.player = actor({ x: 1, y: 19 });
    this.queuedDirection = "right";
    // Keep a substantial BFS distance from the player, even on later levels.
    const distances = distanceMap(this.grid, this.player.tile);
    const candidates = Array.from({ length: SIZE * SIZE }, (_, i) =>
      point(i),
    ).filter((p) => isOpen(this.grid, p) && distances[key(p)] >= 14);
    candidates.sort((a, b) => distances[key(b)] - distances[key(a)]);
    /** @type {Point[]} */ const spawns = [];
    for (const p of candidates) {
      if (spawns.every((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 5))
        spawns.push(p);
      if (spawns.length === this.config.snakes) break;
    }
    while (spawns.length < this.config.snakes)
      spawns.push(candidates[spawns.length] ?? { x: 19, y: 1 });
    this.snakes = spawns.map(actor);
  }
  /** @param {string} direction */
  turn(direction) {
    if (!DIRECTIONS[direction]) return;
    this.queuedDirection = direction;
    // Reversing within a corridor feels immediate and preserves position.
    const a = this.player,
      d = DIRECTIONS[direction];
    if (a.to && a.from.x - a.to.x === d.x && a.from.y - a.to.y === d.y) {
      const old = a.from;
      a.from = a.to;
      a.to = old;
      a.tile = { ...a.from };
      a.progress = 1 - a.progress;
      a.direction = direction;
    }
  }
  pause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.onEvent("pause");
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.onEvent("resume");
    }
  }
  menu() {
    this.phase = "menu";
    this.onEvent("menu");
  }
  /** @param {number} dt */
  update(dt) {
    if (
      this.phase === "menu" ||
      this.phase === "paused" ||
      this.phase === "gameOver" ||
      this.phase === "won"
    )
      return;
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    if (this.phase !== "playing") {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.phase === "levelComplete") {
          this.level++;
          this.loadLevel();
          this.phase = "countdown";
          this.timer = 2.5;
          this.onEvent("nextLevel");
        } else {
          this.phase = "playing";
          this.onEvent("ready");
        }
      }
      return;
    }
    // Small simulation steps avoid tunneling through snakes at different speeds.
    let remaining = dt;
    while (remaining > 0 && this.phase === "playing") {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      this.power = Math.max(0, this.power - step);
      this.invincible = Math.max(0, this.invincible - step);
      this.move(
        this.player,
        step * this.config.playerSpeed * (this.boost ? 1.1 : 1),
        true,
      );
      for (const snake of this.snakes) {
        if (snake.respawn > 0) {
          snake.respawn = Math.max(0, snake.respawn - step);
          continue;
        }
        this.move(
          snake,
          step * this.config.snakeSpeed * (this.power > 0 ? 0.65 : 1),
          false,
        );
      }
      if (this.phase === "playing") this.collisions();
    }
  }
  /** @param {Actor} a @param {number} amount @param {boolean} player */
  move(a, amount, player) {
    if (!a.to) {
      /** @type {Point|undefined} */ let next;
      if (player) {
        for (const dir of [this.queuedDirection, a.direction]) {
          const d = DIRECTIONS[dir];
          const p = { x: a.tile.x + d.x, y: a.tile.y + d.y };
          if (isOpen(this.grid, p)) {
            next = p;
            a.direction = dir;
            break;
          }
        }
      } else {
        const options = neighbors(this.grid, a.tile);
        const distances = distanceMap(
          this.grid,
          this.player.to ?? this.player.tile,
        );
        options.sort((p, q) =>
          this.power > 0
            ? distances[key(q)] - distances[key(p)]
            : distances[key(p)] - distances[key(q)],
        );
        next = options[0];
        if (next) {
          const dx = next.x - a.tile.x,
            dy = next.y - a.tile.y;
          a.direction =
            Object.keys(DIRECTIONS).find(
              (d) => DIRECTIONS[d].x === dx && DIRECTIONS[d].y === dy,
            ) ?? a.direction;
        }
      }
      if (!next) return;
      a.from = { ...a.tile };
      a.to = next;
      a.progress = 0;
    }
    a.progress += amount;
    if (a.progress >= 1) {
      const remainder = a.progress - 1;
      a.trail.unshift({ ...a.from });
      a.trail.length = Math.min(4, a.trail.length);
      a.tile = a.to;
      a.to = null;
      a.progress = 0;
      if (player) this.eat();
      // Preserve distance across tile boundaries for stable frame-independent speed.
      if (remainder > 0 && this.phase === "playing")
        this.move(a, remainder, player);
    }
  }
  eat() {
    const k = key(this.player.tile),
      points = this.food.get(k);
    if (!points) return;
    this.food.delete(k);
    this.score += points;
    if (points === 50) {
      this.power = this.config.powerDuration;
      this.onEvent("power");
    } else this.onEvent("peanut");
    if (this.food.size === 0) {
      this.score += this.level * 100;
      this.power = 0;
      this.phase = this.level === 50 ? "won" : "levelComplete";
      this.timer = 2;
      this.onEvent(this.phase);
    }
  }
  collisions() {
    const p = position(this.player);
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (s.respawn > 0) continue;
      const sp = position(s);
      if (Math.hypot(p.x - sp.x, p.y - sp.y) > 0.64) continue;
      if (this.power > 0) {
        this.score += 200;
        this.snakes[i] = { ...actor(s.spawn), respawn: 3 };
        this.onEvent("snake");
      } else if (this.invincible <= 0) {
        this.lives--;
        this.power = 0;
        if (this.lives === 0) {
          this.phase = "gameOver";
          this.onEvent("gameOver");
        } else {
          this.resetActors();
          this.phase = "hit";
          this.timer = 2;
          this.invincible = 2;
          this.onEvent("hit");
        }
        break;
      }
    }
  }
}
