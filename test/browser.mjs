// Production-export interaction checks. Uses its own bounded foreground preview.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
const modulePath = (value, fallback) =>
  value ? pathToFileURL(resolve(value)).href : fallback;
const { chromium } = await import(
  modulePath(process.env.PLAYWRIGHT_MODULE, "playwright")
);
const { default: AxeBuilder } = await import(
  modulePath(process.env.AXE_MODULE, "@axe-core/playwright")
);
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/preview/")) throw new Error("Invalid mount");
    let path = resolve(
      root,
      "." + decodeURIComponent(url.pathname.slice("/preview".length)),
    );
    if (!path.startsWith(root + sep) && path !== root)
      throw new Error("Invalid path");
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const output = resolve("artifacts/screenshots");
await mkdir(output, { recursive: true });
const checks = [],
  issues = [],
  a11y = [];
let overlayContrast = [],
  liveObservation = null;
const check = (name, detail = "") => {
  checks.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ": " + detail : ""}`);
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
let mode = "running";
const fixture = () => ({
  measurement: {
    freshness: "online",
    observedAt: new Date().toISOString(),
    staleAfterSeconds: 120,
    rpmMilli: mode === "sleeping" ? 0 : 12000,
  },
});
async function audit(page, state) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  a11y.push({
    state,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  assert.deepEqual(
    result.violations.map((v) => v.id),
    [],
    `Accessibility: ${state}`,
  );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route(
    "https://api.squeekchain.com/v1/status",
    async (route) => {
      if (mode === "offline") await route.abort("internetdisconnected");
      else
        await route.fulfill({
          json: fixture(),
          headers: { "access-control-allow-origin": "*" },
        });
    },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      issues.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  overlayContrast = await page.evaluate(() => {
    const rgb = (value) => value.match(/[\d.]+/g).map(Number);
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const canvas = document.querySelector("#maze"),
      ctx = canvas.getContext("2d"),
      bounds = canvas.getBoundingClientRect();
    const overlay = rgb(
      getComputedStyle(document.querySelector("#game-overlay")).backgroundColor,
    );
    return ["#menu-title", "#menu-screen > p", "#menu-screen > .menu-meta"].map(
      (selector) => {
        const node = document.querySelector(selector),
          rect = node.getBoundingClientRect(),
          foreground = rgb(getComputedStyle(node).color);
        let minimum = Infinity;
        for (let y = rect.top; y < rect.bottom; y += 4)
          for (let x = rect.left; x < rect.right; x += 4) {
            const pixel = ctx.getImageData(
              Math.floor(((x - bounds.left) / bounds.width) * canvas.width),
              Math.floor(((y - bounds.top) / bounds.height) * canvas.height),
              1,
              1,
            ).data;
            const background = overlay
              .slice(0, 3)
              .map((v, i) => v * overlay[3] + pixel[i] * (1 - overlay[3]));
            minimum = Math.min(minimum, contrast(foreground, background));
          }
        return {
          selector,
          minimumSampledContrast: Math.round(minimum * 100) / 100,
          method:
            "Actual maze canvas pixels composed with the computed translucent overlay, sampled every 4 CSS pixels under the text box.",
        };
      },
    );
  });
  assert.ok(
    overlayContrast.every((pair) => pair.minimumSampledContrast >= 4.5),
  );
  check(
    "canvas overlay text contrast",
    overlayContrast
      .map((pair) => `${pair.selector}: ${pair.minimumSampledContrast}:1`)
      .join("; "),
  );
  await page.waitForFunction(
    () => document.querySelector("#status-label").textContent === "RUNNING",
  );
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.boost,
    ),
    true,
  );
  check(
    "live running status enables the boost",
    "fresh API-shaped response intercepted by the test",
  );
  await page.screenshot({
    path: resolve(output, "desktop-menu.png"),
    fullPage: true,
  });
  await audit(page, "desktop menu");
  for (const [width, height] of [
    [320, 780],
    [390, 844],
    [850, 1000],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Overflow at ${width}`,
    );
    const button = await page.locator("#play-button").boundingBox();
    assert.ok(
      button.y >= 0 && button.y + button.height <= height,
      `Play must be on the first screen at ${width}`,
    );
    await page.screenshot({
      path: resolve(output, `menu-${width}.png`),
      fullPage: width !== 390,
    });
  }
  check(
    "responsive menu",
    "320, 390, 850 and 1440px; no horizontal overflow and Play visible",
  );
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await page.waitForSelector("#empty-scores:not([hidden])");
  await page.locator("#leaderboard-play").click();
  assert.equal(await page.locator("#countdown-screen").isVisible(), true);
  await page.locator(".brand").click();
  await page.waitForSelector("#menu-screen:not([hidden])");
  check("empty leaderboard and its Play action return to a fresh run");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Tab");
  await page.locator("#play-button").focus();
  assert.equal(
    await page
      .locator("#play-button")
      .evaluate((e) => getComputedStyle(e).outlineStyle),
    "solid",
  );
  await page.screenshot({ path: resolve(output, "mobile-focus.png") });
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector("#game-overlay").hidden,
  );
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector("#score-value").textContent.replaceAll(",", ""),
      ) > 0,
  );
  check("keyboard start, countdown, movement and peanut scoring");
  await page.keyboard.press("p");
  await page.waitForFunction(
    () => !document.querySelector("#paused-screen").hidden,
  );
  const frozen = await page.evaluate(async () => {
    const g = (await import("./assets/main.js")).game;
    return JSON.stringify([g.player, g.power, g.score]);
  });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(async () => {
      const g = (await import("./assets/main.js")).game;
      return JSON.stringify([g.player, g.power, g.score]);
    }),
    frozen,
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "resume-button",
  );
  await audit(page, "paused game");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector("#game-overlay").hidden,
  );
  await page.keyboard.press("w");
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.queuedDirection,
    ),
    "up",
  );
  check(
    "pause freezes state, focus moves to Resume, Escape resumes, WASD works",
  );
  await page.locator("#maze").dispatchEvent("pointerdown", {
    clientX: 150,
    clientY: 400,
    pointerId: 1,
    pointerType: "touch",
  });
  await page.locator("#maze").dispatchEvent("pointermove", {
    clientX: 200,
    clientY: 400,
    pointerId: 1,
    pointerType: "touch",
  });
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.queuedDirection,
    ),
    "right",
  );
  await page.locator("#maze").dispatchEvent("pointerup", { pointerId: 1 });
  await page.getByRole("button", { name: "Move left", exact: true }).click();
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.queuedDirection,
    ),
    "left",
  );
  check(
    "mobile swipe and direction buttons",
    "synthetic touch pointer events and real DOM button click",
  );
  await page.locator("#help-button").click();
  assert.equal(
    await page.locator("#help-dialog").evaluate((e) => e.open),
    true,
  );
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.phase,
    ),
    "paused",
  );
  await audit(page, "instructions dialog");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector("#game-overlay").hidden,
  );
  check(
    "instructions dialog pauses and resumes the run; keyboard dismisses it",
  );
  await page.getByRole("button", { name: "Enable sound", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Mute sound", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  assert.equal(
    await page.locator("#motion-button").textContent(),
    "Play animation",
  );
  const still = await page
    .locator("#background")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator("#background").evaluate((c) => c.toDataURL()),
    still,
  );
  await page.locator("#motion-button").click();
  const moving = await page
    .locator("#background")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(150);
  assert.notEqual(
    await page.locator("#background").evaluate((c) => c.toDataURL()),
    moving,
  );
  await page.locator("#motion-button").click();
  check(
    "sound control and reduced-motion initial state",
    "sound state checked; audible output not assessed",
  );
  await page.keyboard.press("p");
  await page.locator("#finish-button").click();
  await page.locator("#player-name").fill("   ");
  await page.locator("#save-button").click();
  assert.equal(
    await page.locator("#player-name").getAttribute("aria-invalid"),
    "true",
  );
  await page.locator("#player-name").fill("<b>Peanut</b>");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#save-button").textContent(), "Saved");
  await audit(page, "game over and saved score");
  await page.screenshot({ path: resolve(output, "mobile-result.png") });
  const resultBounds = await page.locator("#result-screen").boundingBox(),
    boardBounds = await page.locator("#board-wrap").boundingBox();
  assert.ok(
    resultBounds.height <= boardBounds.height,
    "Result screen must fit the board",
  );
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await page.waitForSelector("#score-rows tr");
  assert.equal(
    await page
      .locator("#score-rows tr:first-child td:nth-child(2)")
      .textContent(),
    "<b>Peanut</b>",
  );
  assert.equal(await page.locator("#score-rows b").count(), 0);
  await audit(page, "leaderboard");
  await page.reload();
  await page.waitForSelector("#score-rows tr");
  await page.screenshot({
    path: resolve(output, "mobile-leaderboard.png"),
    fullPage: true,
  });
  check(
    "name validation, save-once behavior, safe name rendering and persisted leaderboard",
  );
  await page.locator("#back-button").click();
  await page.locator("#play-button").click();
  await page.waitForFunction(
    () => document.querySelector("#game-overlay").hidden,
  );
  assert.equal(await page.locator("#score-value").textContent(), "0");
  // Controlled fixtures exercise rare UI states; full progression is tested via real engine movement in the Node suite.
  await page.evaluate(async () => {
    const { game } = await import("./assets/main.js");
    game.level = 31;
    game.loadLevel();
    game.phase = "playing";
    game.onEvent("ready");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({
    path: resolve(output, "desktop-playing.png"),
    fullPage: true,
  });
  await page.keyboard.press("p");
  await page.screenshot({
    path: resolve(output, "desktop-level-31.png"),
    fullPage: true,
  });
  await page.evaluate(async () => {
    const { game } = await import("./assets/main.js");
    game.phase = "playing";
    game.food.clear();
    const k = game.player.tile.y * 21 + game.player.tile.x;
    game.food.set(k, 10);
    game.eat();
  });
  await page.waitForSelector("#complete-screen:not([hidden])");
  await page.screenshot({
    path: resolve(output, "desktop-level-complete.png"),
  });
  await page.evaluate(async () => {
    const { game } = await import("./assets/main.js");
    game.level = 50;
    game.loadLevel();
    game.phase = "playing";
    game.food.clear();
    game.food.set(game.player.tile.y * 21 + game.player.tile.x, 10);
    game.eat();
  });
  await page.waitForFunction(() =>
    document.querySelector("#result-title").textContent.includes("Squeektoshi"),
  );
  await page.screenshot({ path: resolve(output, "desktop-win.png") });
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.phase,
    ),
    "won",
  );
  await page.setViewportSize({ width: 320, height: 780 });
  const winBounds = await page.locator("#result-screen").boundingBox(),
    winBoard = await page.locator("#board-wrap").boundingBox();
  assert.ok(
    winBounds.height <= winBoard.height,
    "Win screen must fit at 320px",
  );
  await page.screenshot({ path: resolve(output, "small-win.png") });
  check(
    "restart, level 31, transition and level 50 win screen",
    "rare states use controlled engine fixtures",
  );
  mode = "sleeping";
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#status-label").textContent === "SLEEPING",
  );
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.boost,
    ),
    false,
  );
  mode = "offline";
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector("#status-label").textContent === "off the radar",
  );
  assert.equal(
    await page.evaluate(
      async () => (await import("./assets/main.js")).game.boost,
    ),
    false,
  );
  await page.locator("#play-button").click();
  await page.waitForFunction(
    () => document.querySelector("#game-overlay").hidden,
  );
  check(
    "sleeping and unavailable status disable the boost; game works offline",
  );
  // Simulate a quota/security failure after a playable run, then retry.
  await page.keyboard.press("p");
  await page.locator("#finish-button").click();
  await page.locator("#player-name").fill("RetryHamster");
  await page.evaluate(() => {
    window.savedSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked for test");
    };
  });
  await page.locator("#save-button").click();
  assert.match(
    await page.locator("#save-message").textContent(),
    /unavailable/,
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.savedSetItem;
  });
  await page.locator("#save-button").click();
  assert.equal(await page.locator("#save-button").textContent(), "Saved");
  check("unavailable storage shows a useful error and Save can be retried");
  await page.setViewportSize({ width: 320, height: 780 });
  const smallResult = await page.locator("#result-screen").boundingBox(),
    smallBoard = await page.locator("#board-wrap").boundingBox();
  assert.ok(
    smallResult.height <= smallBoard.height,
    "320px result screen must fit",
  );
  await page.screenshot({
    path: resolve(output, "small-result.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  check("320px result reflow and RTL overflow smoke check");
  await page.evaluate(() => {
    document.documentElement.dir = "ltr";
  });
  await page.locator("#menu-button").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    scrollTo(0, 0);
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "200% enlarged text should reflow",
  );
  const enlarged = await page.locator("#menu-screen").boundingBox(),
    enlargedBoard = await page.locator("#board-wrap").boundingBox();
  assert.ok(
    enlarged.height <= enlargedBoard.height,
    "Enlarged menu must not be clipped",
  );
  await page.screenshot({
    path: resolve(output, "mobile-text-200.png"),
    fullPage: true,
  });
  check(
    "200% root text enlargement reflows without horizontal scrolling or clipped menu",
    "CSS text enlargement, not native browser zoom",
  );
  assert.deepEqual(issues, []);
  check("no JavaScript errors or failed local resources");
  await context.close();
  // Observe the actual endpoint once. External availability is recorded, not fabricated.
  const liveContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const livePage = await liveContext.newPage();
  let httpStatus = null;
  livePage.on("response", (response) => {
    if (response.url() === "https://api.squeekchain.com/v1/status")
      httpStatus = response.status();
  });
  await livePage.goto(url);
  await livePage.waitForFunction(
    () => document.querySelector("#live-status").dataset.state !== "checking",
    undefined,
    { timeout: 9000 },
  );
  liveObservation = await livePage.evaluate(async () => ({
    state: document.querySelector("#live-status").dataset.state,
    boost: (await import("./assets/main.js")).game.boost,
  }));
  liveObservation.httpStatus = httpStatus;
  assert.equal(await livePage.locator("#play-button").isVisible(), true);
  await livePage.screenshot({
    path: resolve(output, "mobile-live-status.png"),
  });
  check("unmocked live endpoint observation", JSON.stringify(liveObservation));
  await liveContext.close();
} catch (error) {
  checks.push({
    name: "interaction suite",
    passed: false,
    detail: String(error.stack || error),
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        checks,
        a11y,
        overlayContrast,
        liveObservation,
        issues,
        limits: [
          "Deterministic API interception, not a live API reliability test.",
          "Synthetic touch input, not a physical mobile device.",
          "No human screen-reader session, native browser zoom, or audible sound assessment.",
          "Rare level UI states use controlled engine fixtures.",
        ],
      },
      null,
      2,
    ),
  );
  await browser.close();
  await new Promise((r) => server.close(r));
}
