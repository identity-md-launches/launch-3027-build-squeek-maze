// @ts-check
import { Game } from "./engine.js";
import {
  drawGame,
  drawBackground,
  hamster,
  peanut,
  snakeIcon,
  drawIcon,
  icon,
} from "./draw.js";
import { loadScores, saveScore } from "./storage.js";
import { watchStatus } from "./status.js";
import { Sound } from "./audio.js";

/** @template {HTMLElement} T @param {string} id @returns {T} */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: ${id}`);
  return /** @type {T} */ (node);
}
/** @param {string} id @param {string} text */
function text(id, text) {
  const node = el(id);
  if (node.textContent !== text) node.textContent = text;
}
/** @type {HTMLCanvasElement} */ const maze = el("maze");
/** @type {HTMLCanvasElement} */ const background = el("background");
/** @type {HTMLDialogElement} */ const help = el("help-dialog");
/** @type {HTMLInputElement} */ const nameInput = el("player-name");
/** @type {HTMLProgressElement} */ const progress = el("level-progress");
/** @type {HTMLButtonElement} */ const pauseButton = el("pause-button");
/** @type {HTMLButtonElement} */ const saveButton = el("save-button");
/** @type {HTMLButtonElement} */ const soundButton = el("sound-button");
export const game = new Game();
const sound = new Sound();
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
let animationEnabled = !reducedQuery.matches;
let view = "game";
let lastPhase = "";
let lastLives = -1;
let lastDecor = -1;
let best = loadScores()[0]?.score || 0;
let lastFrame = performance.now();
let wasPlayingBeforeHelp = false;

document
  .querySelectorAll("canvas[data-icon]")
  .forEach((node) =>
    drawIcon(
      /** @type {HTMLCanvasElement} */ (node),
      /** @type {HTMLElement} */ (node).dataset.icon || "",
    ),
  );

/** @param {string} id @param {(c: CanvasRenderingContext2D, w: number, h: number) => void} draw */
function art(id, draw) {
  /** @type {HTMLCanvasElement} */ const canvas = el(id);
  const w = Number(canvas.getAttribute("width")),
    h = Number(canvas.getAttribute("height"));
  canvas.width = w * 2;
  canvas.height = h * 2;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.scale(2, 2);
  draw(c, w, h);
}
art("brand-hamster", (c, w, h) => hamster(c, w / 2, h / 2, 48));
art("peanut-icon", (c, w, h) => peanut(c, w / 2, h / 2, 23));
art("bean-icon", (c, w, h) => peanut(c, w / 2, h / 2, 24, true));
art("snake-icon", (c, w, h) => snakeIcon(c, w / 2, h / 2, 34));
art("wheel-hamster", (c, w, h) => {
  c.save();
  c.translate(8, 2);
  icon(c, "wheel", 56);
  c.restore();
  hamster(c, w / 2, h / 2 + 7, 45);
});
// Set dimensions once. Redraw in logical pixels without accumulating transforms.
for (const id of ["menu-hamster", "celebration-hamster"]) {
  /** @type {HTMLCanvasElement} */ const canvas = el(id);
  canvas.width = 320;
  canvas.height = 280;
}
function resizeBackground() {
  background.width = innerWidth;
  background.height = innerHeight;
  lastDecor = -1;
}
addEventListener("resize", resizeBackground, { passive: true });
resizeBackground();

function updateMotion() {
  text(
    "motion-button",
    animationEnabled ? "Pause animation" : "Play animation",
  );
  el("motion-button").setAttribute("aria-pressed", String(animationEnabled));
  lastDecor = -1;
}
reducedQuery.addEventListener("change", () => {
  animationEnabled = !reducedQuery.matches;
  updateMotion();
});
el("motion-button").addEventListener("click", () => {
  animationEnabled = !animationEnabled;
  updateMotion();
});
updateMotion();

function updateLives() {
  if (lastLives === game.lives) return;
  lastLives = game.lives;
  /** @type {HTMLCanvasElement} */ const canvas = el("lives-canvas");
  canvas.width = 144;
  canvas.height = 48;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.scale(2, 2);
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(i * 24, 0);
    c.globalAlpha = i < game.lives ? 1 : 0.16;
    icon(c, "heart", 22);
    c.restore();
  }
  el("lives-value").setAttribute(
    "aria-label",
    `${game.lives} ${game.lives === 1 ? "life" : "lives"}`,
  );
}
function updateHud() {
  const levelHTML = `${String(game.level).padStart(2, "0")} <small>/ 50</small>`;
  if (el("level-value").innerHTML !== levelHTML)
    el("level-value").innerHTML = levelHTML;
  text("score-value", game.score.toLocaleString());
  text("best-value", best.toLocaleString());
  text("progress-value", `${game.total - game.food.size} / ${game.total}`);
  progress.max = game.total;
  progress.value = game.total - game.food.size;
  updateLives();
  pauseButton.disabled = !["playing", "paused"].includes(game.phase);
  pauseButton.setAttribute(
    "aria-label",
    game.phase === "paused" ? "Resume game" : "Pause game",
  );
  pauseButton.title =
    game.phase === "paused" ? "Resume game (P)" : "Pause game (P)";
  const hint =
    game.phase === "gameOver" || game.phase === "won"
      ? "Your next adventure is one play away"
      : game.power > 0
        ? `Power bean · ${game.power.toFixed(1)}s left`
        : game.boost
          ? "Wheel boost active · +10% speed"
          : game.phase === "menu"
            ? "A snack-sized adventure awaits"
            : "Follow the peanuts. Trust your paws.";
  const node = el("game-hint");
  if (node.textContent !== hint) {
    node.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "tiny-dot";
    dot.setAttribute("aria-hidden", "true");
    node.append(dot, hint);
  }
}
const screens = ["menu", "countdown", "paused", "complete", "hit", "result"];
function updateOverlay() {
  const phase = game.phase;
  if (lastPhase !== phase) {
    lastPhase = phase;
    el("game-overlay").hidden = phase === "playing";
    const screen = {
      menu: "menu",
      countdown: "countdown",
      paused: "paused",
      hit: "hit",
      levelComplete: "complete",
      gameOver: "result",
      won: "result",
      playing: "",
    }[phase];
    screens.forEach((id) => {
      el(`${id}-screen`).hidden = id !== screen;
    });
    el("board-wrap").classList.toggle(
      "showing-result",
      phase === "gameOver" || phase === "won",
    );
    if (phase === "gameOver" || phase === "won") {
      text(
        "result-title",
        phase === "won"
          ? "Congratulations, Squeektoshi!"
          : "Game over, little legend.",
      );
      text(
        "result-detail",
        phase === "won"
          ? "All 50 mazes. Every last peanut. Congratulations!"
          : "Every great run starts with a peanut.",
      );
      text("final-score", game.score.toLocaleString());
      text("final-level", `· Level ${game.level}`);
      nameInput.value = "";
      nameInput.disabled = false;
      saveButton.disabled = false;
      saveButton.textContent = "Save";
      nameInput.removeAttribute("aria-invalid");
      text("save-message", "Saved on this browser only.");
      nameInput.focus({ preventScroll: true });
    } else if (phase === "paused" && view === "game" && !help.open)
      el("resume-button").focus({ preventScroll: true });
  }
  if (phase === "countdown") {
    text("countdown-number", String(Math.max(1, Math.ceil(game.timer))));
    text("countdown-title", `Level ${game.level}`);
    text(
      "countdown-detail",
      `${game.config.name} · ${game.config.snakes} ${game.config.snakes === 1 ? "snake" : "snakes"}`,
    );
  }
  if (phase === "hit")
    text(
      "hit-detail",
      `${game.lives} ${game.lives === 1 ? "life" : "lives"} left. You’ve got this.`,
    );
  if (phase === "levelComplete")
    text(
      "complete-detail",
      `Level ${game.level} complete · +${game.level * 100} bonus`,
    );
}
/** @param {string} event */
function onGameEvent(event) {
  sound.play(event);
  updateHud();
  updateOverlay();
  const messages = {
    start: "Get ready. Level 1 starts in 3 seconds.",
    ready: `Level ${game.level}. Go!`,
    power: `Power bean! You can eat snakes for ${game.config.powerDuration} seconds.`,
    snake: "Snake eaten. 200 bonus points.",
    hit: `Caught by a snake. ${game.lives} ${game.lives === 1 ? "life" : "lives"} left.`,
    gameOver: `Game over. Final score ${game.score}. Enter your name to save your score.`,
    won: `Congratulations! All 50 levels complete. Final score ${game.score}.`,
    levelComplete: `Level ${game.level} complete. ${game.level * 100} bonus points.`,
    nextLevel: `Get ready for level ${game.level}.`,
    pause: "Game paused.",
    resume: "Game resumed.",
    menu: "Main menu.",
  };
  if (event in messages)
    text("announcer", messages[/** @type {keyof typeof messages} */ (event)]);
}
game.onEvent = onGameEvent;

function renderLeaderboard() {
  const scores = loadScores();
  el("empty-scores").hidden = scores.length > 0;
  el("score-table-wrap").hidden = scores.length === 0;
  const rows = el("score-rows");
  rows.replaceChildren();
  scores.forEach((entry, i) => {
    const row = document.createElement("tr");
    [
      String(i + 1).padStart(2, "0"),
      entry.name,
      String(entry.level),
      entry.score.toLocaleString(),
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });
}
function route() {
  const leaderboard = location.hash === "#leaderboard";
  view = leaderboard ? "leaderboard" : "game";
  if (leaderboard) {
    game.pause();
    renderLeaderboard();
  }
  el("game-view").hidden = leaderboard;
  el("leaderboard-view").hidden = !leaderboard;
  el("under-game").hidden = leaderboard;
  const nav = document.querySelector("nav a");
  if (leaderboard) nav?.setAttribute("aria-current", "page");
  else nav?.removeAttribute("aria-current");
  if (leaderboard) el("leaderboard-title").focus({ preventScroll: true });
  else if (game.phase === "paused")
    el("resume-button").focus({ preventScroll: true });
  updateOverlay();
}
addEventListener("hashchange", route);
function showGame() {
  if (location.hash) location.hash = "";
  else route();
}
function startGame() {
  view = "game";
  showGame();
  el("game-view").hidden = false;
  el("leaderboard-view").hidden = true;
  sound.unlock();
  game.start();
  maze.focus({ preventScroll: true });
  const cabinet = document.querySelector(".arcade");
  if (cabinet && cabinet.getBoundingClientRect().bottom > innerHeight)
    cabinet.scrollIntoView({ block: "start", behavior: "instant" });
}
for (const id of ["play-button", "again-button", "leaderboard-play"])
  el(id).addEventListener("click", startGame);
el("resume-button").addEventListener("click", () => {
  game.resume();
  maze.focus({ preventScroll: true });
});
el("finish-button").addEventListener("click", () => {
  game.phase = "gameOver";
  onGameEvent("gameOver");
});
el("menu-button").addEventListener("click", () => {
  game.menu();
  el("play-button").focus({ preventScroll: true });
});
document.querySelector(".brand")?.addEventListener("click", () => {
  game.menu();
  showGame();
});
el("back-button").addEventListener("click", showGame);
pauseButton.addEventListener("click", () => {
  if (game.phase === "paused") {
    game.resume();
    maze.focus({ preventScroll: true });
  } else game.pause();
});
soundButton.addEventListener("click", () => {
  sound.unlock();
  sound.enabled = !sound.enabled;
  soundButton.setAttribute("aria-pressed", String(sound.enabled));
  soundButton.setAttribute(
    "aria-label",
    sound.enabled ? "Mute sound" : "Enable sound",
  );
  soundButton.title = sound.enabled ? "Mute sound" : "Enable sound";
  /** @type {HTMLCanvasElement} */ const canvas = el("sound-icon");
  canvas.setAttribute("width", "20");
  drawIcon(canvas, sound.enabled ? "sound" : "muted");
  if (sound.enabled) sound.play("start");
});
el("score-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (saveButton.disabled) return;
  if (!nameInput.value.trim()) {
    nameInput.setAttribute("aria-invalid", "true");
    text("save-message", "Enter a name to save your score.");
    nameInput.focus();
    return;
  }
  nameInput.removeAttribute("aria-invalid");
  if (saveScore(nameInput.value, game.score, game.level)) {
    saveButton.disabled = true;
    nameInput.disabled = true;
    saveButton.textContent = "Saved";
    text("save-message", "Score saved. Find it on the leaderboard.");
    best = loadScores()[0]?.score || 0;
    updateHud();
  } else
    text(
      "save-message",
      "Storage is unavailable. Allow site storage, then try Save again.",
    );
});
nameInput.addEventListener("input", () =>
  nameInput.removeAttribute("aria-invalid"),
);
el("help-button").addEventListener("click", () => {
  wasPlayingBeforeHelp = game.phase === "playing";
  if (wasPlayingBeforeHelp) game.pause();
  help.showModal();
});
for (const id of ["close-help", "got-it-button"])
  el(id).addEventListener("click", () => help.close());
help.addEventListener("close", () => {
  if (wasPlayingBeforeHelp && view === "game" && !document.hidden) {
    game.resume();
    maze.focus({ preventScroll: true });
  }
});
help.addEventListener("click", (event) => {
  if (event.target === help) {
    const r = help.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      help.close();
  }
});

const keys = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
  w: "up",
  d: "right",
  s: "down",
  a: "left",
};
addEventListener("keydown", (event) => {
  if (
    view !== "game" ||
    help.open ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    /** @type {HTMLElement} */ (event.target)?.isContentEditable
  )
    return;
  const name = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (
    (name === "p" || name === "Escape") &&
    (game.phase === "playing" || game.phase === "paused")
  ) {
    event.preventDefault();
    if (event.repeat) return;
    if (game.phase === "paused") {
      game.resume();
      maze.focus({ preventScroll: true });
    } else game.pause();
  }
  const dir = keys[/** @type {keyof typeof keys} */ (name)];
  if (dir && ["playing", "countdown", "hit"].includes(game.phase)) {
    event.preventDefault();
    game.turn(dir);
  }
});
let pointerStart = { x: 0, y: 0 };
let pointerActive = false;
maze.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
  pointerActive = true;
  maze.setPointerCapture(event.pointerId);
});
maze.addEventListener("pointermove", (event) => {
  if (!pointerActive) return;
  const dx = event.clientX - pointerStart.x,
    dy = event.clientY - pointerStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
  game.turn(
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "down"
        : "up",
  );
  pointerStart = { x: event.clientX, y: event.clientY };
});
maze.addEventListener("pointerup", () => {
  pointerActive = false;
});
maze.addEventListener("pointercancel", () => {
  pointerActive = false;
});
document
  .querySelectorAll("button[data-direction]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      game.turn(/** @type {HTMLElement} */ (button).dataset.direction || ""),
    ),
  );
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
  else restartStatus();
  lastFrame = performance.now();
});
addEventListener("blur", () => game.pause());
/** @param {import('./status.js').WheelStatus} status */
function applyStatus(status) {
  const previous = el("live-status").dataset.state;
  el("live-status").dataset.state = status.state;
  game.boost = status.state === "running";
  text(
    "status-label",
    {
      running: "RUNNING",
      sleeping: "SLEEPING",
      unavailable: "off the radar",
      checking: "checking in",
    }[status.state],
  );
  text(
    "status-detail",
    status.state === "running"
      ? "+10% speed boost is on"
      : status.state === "sleeping"
        ? "Resting up at standard speed"
        : status.state === "unavailable"
          ? "Live status unavailable · standard speed"
          : "Connecting to the real hamster",
  );
  if (previous !== status.state && game.phase === "playing")
    text(
      "announcer",
      status.state === "running"
        ? "Squeektoshi is running. 10% speed boost active."
        : "Standard movement speed.",
    );
}
let stopWatching = watchStatus(applyStatus);
function restartStatus() {
  stopWatching();
  game.boost = false;
  applyStatus({ state: "checking", rpm: 0 });
  stopWatching = watchStatus(applyStatus);
}
addEventListener("pagehide", () => {
  stopWatching();
  game.boost = false;
});
addEventListener("pageshow", (event) => {
  if (event.persisted) restartStatus();
});

function frame(now = performance.now()) {
  const dt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!document.hidden && view === "game" && !help.open) game.update(dt);
  updateHud();
  updateOverlay();
  drawGame(maze, game, now / 1000, !animationEnabled);
  const decorTick = animationEnabled ? Math.floor(now / 50) : 0;
  if (decorTick !== lastDecor) {
    lastDecor = decorTick;
    const time = animationEnabled ? now / 1000 : 0;
    drawBackground(background, time, !animationEnabled);
    for (const id of ["menu-hamster", "celebration-hamster"]) {
      /** @type {HTMLCanvasElement} */ const canvas = el(id);
      const c = canvas.getContext("2d");
      if (!c) continue;
      c.clearRect(0, 0, 320, 280);
      const glow = c.createRadialGradient(160, 150, 10, 160, 150, 110);
      glow.addColorStop(0, "#f5a43618");
      glow.addColorStop(1, "#f5a43600");
      c.fillStyle = glow;
      c.fillRect(0, 0, 320, 280);
      hamster(c, 160, 150, 228, time);
      peanut(c, 75, 190 + Math.sin(time * 2) * 4, 18);
      peanut(c, 258, 95 + Math.sin(time * 2 + 1) * 4, 16);
    }
  }
  requestAnimationFrame(frame);
}
route();
updateHud();
updateOverlay();
requestAnimationFrame(frame);
