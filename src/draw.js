// @ts-check
import { SIZE, point } from "./maze.js";
import { position } from "./engine.js";
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r @param {string} color */
function round(c, x, y, w, h, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string} color */
function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
/** All character art is drawn locally on canvas. @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} size @param {number} [time] @param {boolean} [powered] */
export function hamster(c, x, y, size, time = 0, powered = false) {
  c.save();
  c.translate(x, y);
  c.scale(size / 100, size / 100);
  const bob = Math.sin(time * 4) * 1.5;
  c.translate(0, bob);
  if (powered) {
    c.shadowColor = "#ffc34d";
    c.shadowBlur = 12;
  }
  ellipse(c, 0, 34, 31, 5, "#00000028");
  ellipse(c, -15, 28, 11, 7, "#ec9964");
  ellipse(c, 15, 28, 11, 7, "#ec9964");
  ellipse(c, -28, -26, 14, 16, "#e39742");
  ellipse(c, 28, -26, 14, 16, "#e39742");
  ellipse(c, -28, -26, 8, 10, "#efb4a0");
  ellipse(c, 28, -26, 8, 10, "#efb4a0");
  const fur = c.createLinearGradient(0, -40, 0, 35);
  fur.addColorStop(0, "#f5be61");
  fur.addColorStop(1, "#d98d34");
  c.fillStyle = fur;
  c.beginPath();
  c.ellipse(0, -1, 39, 37, 0, 0, Math.PI * 2);
  c.fill();
  ellipse(c, 0, 11, 29, 24, "#fff0d2");
  ellipse(c, -26, 7, 12, 13, "#fff0d2");
  ellipse(c, 26, 7, 12, 13, "#fff0d2");
  ellipse(c, -16, -7, 5, 6.5, "#302419");
  ellipse(c, 16, -7, 5, 6.5, "#302419");
  ellipse(c, -17, -9, 1.6, 2, "#fff8e9");
  ellipse(c, 15, -9, 1.6, 2, "#fff8e9");
  ellipse(c, -26, 9, 6, 3.5, "#efae95");
  ellipse(c, 26, 9, 6, 3.5, "#efae95");
  ellipse(c, 0, 3, 4, 3, "#c47d6c");
  c.strokeStyle = "#805339";
  c.lineWidth = 1.5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, 6);
  c.lineTo(0, 10);
  c.quadraticCurveTo(-4, 14, -7, 10);
  c.moveTo(0, 10);
  c.quadraticCurveTo(4, 14, 7, 10);
  c.stroke();
  round(c, -3.4, 12, 6.8, 5.5, 1.5, "#fffdf5");
  ellipse(c, -15, 27, 8, 6, "#f6cc8a");
  ellipse(c, 15, 27, 8, 6, "#f6cc8a");
  c.restore();
}
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} size @param {boolean} [power] @param {number} [time] */
export function peanut(c, x, y, size, power = false, time = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.5);
  if (power) {
    c.shadowColor = "#ffbf42";
    c.shadowBlur = size * (0.8 + Math.sin(time * 4) * 0.2);
  }
  const r = power ? size * 0.48 : size * 0.35;
  ellipse(c, 0, -r * 0.45, r * 0.72, r, power ? "#ffd976" : "#eac56d");
  ellipse(c, 0, r * 0.55, r * 0.72, r, power ? "#ffd976" : "#eac56d");
  c.shadowBlur = 0;
  c.strokeStyle = "#996322";
  c.lineWidth = Math.max(1, size * 0.05);
  c.beginPath();
  c.moveTo(-r * 0.35, 0);
  c.lineTo(r * 0.35, 0);
  c.stroke();
  c.restore();
}
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} size @param {number} [time] @param {boolean} [scared] */
export function snakeIcon(c, x, y, size, time = 0, scared = false) {
  c.save();
  c.translate(x, y);
  c.scale(size / 44, size / 44);
  c.lineCap = "round";
  c.strokeStyle = scared ? "#94c5d4" : "#88b650";
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(-15, 10);
  c.bezierCurveTo(-4, 20, 7, 11, -1, 4);
  c.bezierCurveTo(-12, -5, 1, -12, 12, -6);
  c.stroke();
  ellipse(c, 12, -6, 10, 8, scared ? "#c5e0e5" : "#b2ce6e");
  ellipse(c, 15, -9, 2, 2.4, "#26311f");
  ellipse(c, 18, -5, 1.4, 1.7, "#26311f");
  c.strokeStyle = "#d27a60";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(21, -4);
  c.lineTo(26, -3 + Math.sin(time * 6));
  c.stroke();
  c.restore();
}
/** @param {CanvasRenderingContext2D} c @param {string} name @param {number} [size] */
export function icon(c, name, size = 24) {
  c.save();
  c.scale(size / 24, size / 24);
  c.strokeStyle = "#715d46";
  c.fillStyle = "#715d46";
  c.lineWidth = 1.8;
  c.lineJoin = "round";
  c.lineCap = "round";
  if (name === "trophy") {
    c.beginPath();
    c.moveTo(7, 4);
    c.lineTo(17, 4);
    c.lineTo(17, 9);
    c.bezierCurveTo(17, 16, 7, 16, 7, 9);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(7, 6);
    c.lineTo(3, 6);
    c.lineTo(3, 9);
    c.quadraticCurveTo(3, 13, 8, 12);
    c.moveTo(17, 6);
    c.lineTo(21, 6);
    c.lineTo(21, 9);
    c.quadraticCurveTo(21, 13, 16, 12);
    c.moveTo(12, 14);
    c.lineTo(12, 19);
    c.moveTo(8, 20);
    c.lineTo(16, 20);
    c.stroke();
  } else if (name === "sound" || name === "muted") {
    c.beginPath();
    c.moveTo(4, 9);
    c.lineTo(8, 9);
    c.lineTo(13, 5);
    c.lineTo(13, 19);
    c.lineTo(8, 15);
    c.lineTo(4, 15);
    c.closePath();
    c.stroke();
    c.beginPath();
    if (name === "sound") {
      c.arc(13, 12, 5, -0.8, 0.8);
      c.moveTo(20, 6);
      c.arc(13, 12, 9, -0.7, 0.7);
    } else {
      c.moveTo(17, 9);
      c.lineTo(22, 15);
      c.moveTo(22, 9);
      c.lineTo(17, 15);
    }
    c.stroke();
  } else if (name === "pause") {
    round(c, 6, 5, 4, 14, 1, "#715d46");
    round(c, 14, 5, 4, 14, 1, "#715d46");
  } else if (name === "play") {
    c.beginPath();
    c.moveTo(8, 5);
    c.lineTo(19, 12);
    c.lineTo(8, 19);
    c.closePath();
    c.fill();
  } else if (name === "heart") {
    c.fillStyle = "#f1a866";
    c.beginPath();
    c.moveTo(12, 21);
    c.bezierCurveTo(-8, 8, 7, -3, 12, 6);
    c.bezierCurveTo(18, -3, 32, 8, 12, 21);
    c.fill();
  } else if (name === "wheel") {
    c.beginPath();
    c.arc(12, 11, 9, 0, Math.PI * 2);
    c.moveTo(7, 22);
    c.lineTo(17, 22);
    c.moveTo(12, 11);
    c.lineTo(12, 22);
    c.moveTo(3, 11);
    c.lineTo(21, 11);
    c.moveTo(12, 2);
    c.lineTo(12, 20);
    c.moveTo(6, 5);
    c.lineTo(18, 17);
    c.moveTo(18, 5);
    c.lineTo(6, 17);
    c.stroke();
  } else if (name === "arrow") {
    c.beginPath();
    c.moveTo(5, 12);
    c.lineTo(19, 12);
    c.moveTo(14, 7);
    c.lineTo(19, 12);
    c.lineTo(14, 17);
    c.stroke();
  }
  c.restore();
}
/** @param {HTMLCanvasElement} canvas @param {string} name */
export function drawIcon(canvas, name) {
  const size = Number(canvas.getAttribute("width") || 24);
  canvas.width = size * 2;
  canvas.height = size * 2;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.scale(2, 2);
  icon(c, name, size);
}
/** @param {HTMLCanvasElement} canvas @param {import('./engine.js').Game} game @param {number} time @param {boolean} reduced */
export function drawGame(canvas, game, time, reduced) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const cell = canvas.width / SIZE;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "#1e211b";
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const px = x * cell,
        py = y * cell;
      if (game.grid[y][x]) {
        round(c, px + 1, py + 1, cell - 2, cell - 2, cell * 0.16, "#433b2c");
        c.fillStyle = "#433b2c";
        if (game.grid[y]?.[x + 1])
          c.fillRect(px + cell * 0.6, py + 1, cell * 0.8, cell - 2);
        if (game.grid[y + 1]?.[x])
          c.fillRect(px + 1, py + cell * 0.6, cell - 2, cell * 0.8);
        c.strokeStyle = "#665438";
        c.lineWidth = 1.1;
        c.beginPath();
        if (!game.grid[y - 1]?.[x]) {
          c.moveTo(px + 4, py + 2);
          c.lineTo(px + cell - 4, py + 2);
        }
        if (game.grid[y]?.[x - 1] === 0) {
          c.moveTo(px + 2, py + 4);
          c.lineTo(px + 2, py + cell - 4);
        }
        c.stroke();
        c.fillStyle = "#ffffff05";
        c.fillRect(px + cell * 0.32, py + cell * 0.4, 2, 2);
      }
    }
  for (const [k, value] of game.food) {
    const p = point(k);
    peanut(
      c,
      (p.x + 0.5) * cell,
      (p.y + 0.5) * cell,
      cell * (value === 50 ? 0.58 : 0.26),
      value === 50,
      reduced ? 0 : time,
    );
  }
  for (const s of game.snakes) {
    if (s.respawn > 0) continue;
    const p = position(s);
    const x = (p.x + 0.5) * cell,
      y = (p.y + 0.5) * cell;
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = cell * 0.48;
    c.strokeStyle = game.power > 0 ? "#90c0cf" : "#83a94e";
    c.beginPath();
    c.moveTo(x, y);
    const trail = [s.from, ...s.trail].slice(0, 2);
    trail.forEach((t, i) => {
      if (i < 1 || s.progress < 0.5)
        c.lineTo((t.x + 0.5) * cell, (t.y + 0.5) * cell);
    });
    c.stroke();
    ellipse(
      c,
      x,
      y,
      cell * 0.38,
      cell * 0.32,
      game.power > 0 ? "#b9e2ea" : "#b1cd71",
    );
    const angle =
      { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[
        s.direction
      ] ?? 0;
    c.translate(x, y);
    c.rotate(angle);
    ellipse(c, cell * 0.12, -cell * 0.13, cell * 0.06, cell * 0.08, "#26311f");
    ellipse(c, cell * 0.12, cell * 0.13, cell * 0.06, cell * 0.08, "#26311f");
    c.strokeStyle = "#e79775";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cell * 0.34, 0);
    c.lineTo(cell * 0.48, 0);
    c.stroke();
    c.restore();
  }
  const p = position(game.player);
  if (
    game.invincible <= 0 ||
    reduced ||
    Math.floor(time * 6) % 2 === 0 ||
    game.phase !== "playing"
  )
    hamster(
      c,
      (p.x + 0.5) * cell,
      (p.y + 0.5) * cell,
      cell * 1.08,
      0,
      game.power > 0,
    );
}
/** @param {HTMLCanvasElement} canvas @param {number} time @param {boolean} reduced */
export function drawBackground(canvas, time, reduced) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = "#956c3210";
  c.lineWidth = 1;
  const angle = reduced ? 0 : time * 0.045;
  for (let y = 80; y < h + 100; y += 230)
    for (let x = 60 + (Math.floor(y / 230) % 2) * 110; x < w + 100; x += 230) {
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      c.beginPath();
      c.arc(0, 0, 48, 0, Math.PI * 2);
      c.arc(0, 0, 43, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * 43, Math.sin(a) * 43);
      }
      c.stroke();
      c.restore();
    }
}
