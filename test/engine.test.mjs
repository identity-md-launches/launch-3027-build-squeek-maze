import test from "node:test";
import assert from "node:assert/strict";
import { Game, position } from "../src/engine.js";
import {
  SIZE,
  generateMaze,
  distanceMap,
  isOpen,
  difficulty,
  key,
  point,
  neighbors,
  DIRECTIONS,
} from "../src/maze.js";

function ready(level = 1) {
  const g = new Game();
  g.level = level;
  g.loadLevel();
  g.phase = "playing";
  g.invincible = 0;
  return g;
}
function place(a, p) {
  a.tile = { ...p };
  a.from = { ...p };
  a.to = null;
  a.progress = 0;
}

test("all 50 seeded mazes are unique, connected, enclosed and reproducible", () => {
  const signatures = new Set();
  for (let level = 1; level <= 50; level++) {
    const grid = generateMaze(level),
      distances = distanceMap(grid, { x: 1, y: 19 });
    assert.deepEqual(grid, generateMaze(level));
    assert.equal(grid.length, SIZE);
    signatures.add(JSON.stringify(grid));
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1)
          assert.equal(grid[y][x], 1);
        if (grid[y][x] === 0)
          assert.ok(
            distances[key({ x, y })] >= 0,
            `unreachable ${level}:${x},${y}`,
          );
      }
  }
  assert.equal(signatures.size, 50);
});

test("five difficulty bands have the specified snake counts, speed and bean limits", () => {
  assert.deepEqual(
    [1, 10, 11, 20, 21, 30, 31, 40, 41, 50].map((n) => difficulty(n).snakes),
    [1, 1, 2, 2, 3, 3, 4, 4, 4, 4],
  );
  for (let n = 2; n <= 50; n++)
    assert.ok(difficulty(n).snakeSpeed > difficulty(n - 1).snakeSpeed);
  assert.equal(difficulty(1).powerDuration, 5);
  assert.equal(difficulty(31).powerDuration, 3.5);
  assert.equal(difficulty(41).powerDuration, 3);
  for (let n = 1; n <= 50; n++) {
    const g = ready(n);
    assert.equal(g.snakes.length, difficulty(n).snakes);
    assert.equal(
      [...g.food.values()].filter((p) => p === 50).length,
      difficulty(n).beans,
    );
    for (const s of g.snakes) {
      assert.ok(isOpen(g.grid, s.tile));
      assert.ok(distanceMap(g.grid, g.player.tile)[key(s.tile)] >= 14);
    }
  }
});

test("BFS snakes choose a shortest route, and move away while powered", () => {
  const g = ready();
  const s = g.snakes[0],
    distances = distanceMap(g.grid, g.player.tile),
    options = neighbors(g.grid, s.tile);
  g.move(s, 0.1, false);
  assert.equal(
    distances[key(s.to)],
    Math.min(...options.map((p) => distances[key(p)])),
  );
  place(s, s.spawn);
  g.power = 5;
  g.move(s, 0.1, false);
  assert.equal(
    distances[key(s.to)],
    Math.max(...options.map((p) => distances[key(p)])),
  );
});

test("peanuts, power beans, snakes and completion award their exact points", () => {
  const g = ready();
  const normal = point([...g.food].find(([, value]) => value === 10)[0]);
  place(g.player, normal);
  g.eat();
  assert.equal(g.score, 10);
  const bean = point([...g.food].find(([, value]) => value === 50)[0]);
  place(g.player, bean);
  g.eat();
  assert.equal(g.score, 60);
  assert.equal(g.power, 5);
  place(g.snakes[0], bean);
  g.collisions();
  assert.equal(g.score, 260);
  assert.equal(g.snakes[0].respawn, 3);
  g.food.clear();
  g.food.set(key(normal), 10);
  place(g.player, normal);
  g.eat();
  assert.equal(g.score, 370);
  assert.equal(g.phase, "levelComplete");
});

test("collisions lose exactly one life, preserve collected peanuts, then end the run", () => {
  const g = ready();
  const count = g.food.size;
  for (let lives = 2; lives >= 0; lives--) {
    g.invincible = 0;
    g.phase = "playing";
    place(g.snakes[0], g.player.tile);
    g.collisions();
    assert.equal(g.lives, lives);
    assert.equal(g.food.size, count);
    assert.equal(g.phase, lives ? "hit" : "gameOver");
    if (lives) {
      g.update(0.1);
      assert.equal(g.lives, lives);
    }
  }
});

test("power protection, expiration and respawn prevent repeated snake points", () => {
  const g = ready();
  g.power = 5;
  place(g.snakes[0], g.player.tile);
  g.collisions();
  assert.equal(g.score, 200);
  assert.equal(g.lives, 3);
  g.collisions();
  assert.equal(g.score, 200);
  g.power = 0.01;
  g.update(0.02);
  assert.equal(g.power, 0);
  const s = g.snakes[0];
  s.respawn = 0.01;
  g.update(0.02);
  assert.equal(s.respawn, 0);
});

test("pause freezes movement and timers; resume and a new run restore correct state", () => {
  const g = ready();
  g.power = 3;
  g.pause();
  const state = JSON.stringify(g);
  g.update(1);
  assert.equal(JSON.stringify(g), state);
  g.resume();
  g.update(0.1);
  assert.ok(g.power < 3);
  g.score = 1000;
  g.lives = 1;
  g.level = 10;
  g.start();
  assert.equal(g.score, 0);
  assert.equal(g.level, 1);
  assert.equal(g.lives, 3);
  assert.equal(g.phase, "countdown");
  for (let n = 0; n < 26; n++) g.update(0.1);
  assert.equal(g.phase, "playing");
});

test("live boost increases movement by 10%, and queued turns never enter a wall", () => {
  const a = ready(),
    b = ready();
  a.snakes = [];
  b.snakes = [];
  b.boost = true;
  const open = neighbors(a.grid, a.player.tile)[0];
  const direction = Object.entries(DIRECTIONS).find(
    ([, d]) => d.x === open.x - 1 && d.y === open.y - 19,
  )[0];
  a.turn(direction);
  b.turn(direction);
  a.update(0.05);
  b.update(0.05);
  const pa = position(a.player),
    pb = position(b.player);
  const da = Math.hypot(pa.x - 1, pa.y - 19),
    db = Math.hypot(pb.x - 1, pb.y - 19);
  assert.ok(Math.abs(db / da - 1.1) < 0.00001);
  a.turn("down");
  for (let n = 0; n < 100; n++) a.update(0.01);
  assert.ok(isOpen(a.grid, a.player.tile));
  if (a.player.to) assert.ok(isOpen(a.grid, a.player.to));
});

test("reversing direction mid-corridor is position-continuous", () => {
  const g = ready();
  g.snakes = [];
  g.turn("up");
  g.update(0.05);
  const p = { ...position(g.player) };
  assert.ok(g.player.to);
  g.turn("down");
  assert.deepEqual(position(g.player), p);
});

test("movement preserves distance across many tile boundaries at 30, 60 and 120fps", () => {
  for (const fps of [30, 60, 120])
    for (const boosted of [false, true]) {
      const g = ready();
      g.snakes = [];
      g.boost = boosted;
      g.grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
      for (let x = 1; x < 20; x++) g.grid[19][x] = 0;
      g.turn("right");
      for (let n = 0; n < fps; n++) g.update(1 / fps);
      assert.ok(
        Math.abs(
          position(g.player).x - 1 - g.config.playerSpeed * (boosted ? 1.1 : 1),
        ) < 0.000001,
        `${fps}fps, boost ${boosted}`,
      );
    }
});

test("opposing moving actors cannot pass through one another without a collision", () => {
  const g = ready();
  place(g.player, { x: 1, y: 19 });
  place(g.snakes[0], { x: 1, y: 18 });
  g.turn("up");
  for (let i = 0; i < 20 && g.phase === "playing"; i++) g.update(1 / 30);
  assert.equal(g.lives, 2);
  assert.equal(g.phase, "hit");
});

test("all 50 mazes can be cleared through movement and award exactly one level bonus", () => {
  const g = new Game();
  let expected = 0;
  for (let level = 1; level <= 50; level++) {
    assert.equal(g.level, level);
    g.phase = "playing";
    // Isolate collection and progression. Collision behavior is tested separately.
    g.snakes.forEach((s) => {
      s.respawn = Infinity;
    });
    expected += [...g.food.values()].reduce((a, b) => a + b, 0) + level * 100;
    let frames = 0;
    while (g.phase === "playing") {
      if (!g.player.to) {
        const fromPlayer = distanceMap(g.grid, g.player.tile);
        const target = [...g.food.keys()].sort(
          (a, b) => fromPlayer[a] - fromPlayer[b],
        )[0];
        const toTarget = distanceMap(g.grid, point(target));
        const next = neighbors(g.grid, g.player.tile).sort(
          (a, b) => toTarget[key(a)] - toTarget[key(b)],
        )[0];
        const d = Object.entries(DIRECTIONS).find(
          ([, d]) =>
            next.x - g.player.tile.x === d.x &&
            next.y - g.player.tile.y === d.y,
        )[0];
        g.turn(d);
      }
      // Traverse one exact edge through the real movement/collection method.
      // Frame interpolation and collision timing are covered independently above.
      g.move(g.player, 1, true);
      if (++frames > 200000) assert.fail(`Level ${level} did not finish`);
    }
    assert.equal(g.score, expected);
    assert.equal(g.food.size, 0);
    if (level < 50) {
      assert.equal(g.phase, "levelComplete");
      while (g.phase === "levelComplete") g.update(0.1);
      assert.equal(g.phase, "countdown");
    } else assert.equal(g.phase, "won");
  }
});
