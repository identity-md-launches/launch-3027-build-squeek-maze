import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
    : "playwright"
);
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        "<!doctype html><html><head><title>Canvas art generator</title></head><body></body></html>",
      );
      return;
    }
    const file = resolve("." + pathname);
    res.setHeader(
      "Content-Type",
      extname(file) === ".js"
        ? "text/javascript"
        : extname(file) === ".woff2"
          ? "font/woff2"
          : "text/html",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const images = await page.evaluate(async () => {
    const { hamster, peanut, snakeIcon } = await import("./src/draw.js");
    const favicon = document.createElement("canvas");
    favicon.width = 64;
    favicon.height = 64;
    const f = favicon.getContext("2d");
    f.fillStyle = "#faf6ec";
    f.beginPath();
    f.roundRect(0, 0, 64, 64, 14);
    f.fill();
    hamster(f, 32, 33, 68);
    const og = document.createElement("canvas");
    og.width = 1200;
    og.height = 630;
    const c = og.getContext("2d");
    const font = new FontFace("Nunito", "url(./public/nunito-latin.woff2)", {
      weight: "400 800",
    });
    await font.load();
    document.fonts.add(font);
    c.fillStyle = "#faf6ec";
    c.fillRect(0, 0, 1200, 630);
    c.fillStyle = "#eee3cd";
    c.beginPath();
    c.arc(960, 310, 340, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#332a20";
    c.font = "800 96px Nunito";
    c.fillText("Squeek", 80, 240);
    c.fillStyle = "#b26816";
    c.fillText("Maze.", 80, 340);
    c.fillStyle = "#75634c";
    c.font = "400 28px Nunito";
    c.fillText("50 mazes. One brave hamster.", 84, 405);
    c.fillStyle = "#f5a436";
    c.beginPath();
    c.roundRect(84, 454, 286, 64, 14);
    c.fill();
    c.fillStyle = "#332a20";
    c.font = "800 25px Nunito";
    c.fillText("Ready, little runner?", 112, 495);
    c.fillStyle = "#75634c";
    c.font = "600 22px Nunito";
    c.fillText("The Squeekchain arcade", 84, 104);
    hamster(c, 922, 300, 390);
    peanut(c, 727, 133, 46);
    peanut(c, 1081, 474, 40);
    snakeIcon(c, 775, 492, 76);
    return {
      favicon: favicon.toDataURL("image/png"),
      og: og.toDataURL("image/png"),
    };
  });
  await writeFile(
    "public/favicon.png",
    Buffer.from(images.favicon.split(",")[1], "base64"),
  );
  await writeFile(
    "public/og-image.png",
    Buffer.from(images.og.split(",")[1], "base64"),
  );
  console.log("Canvas-drawn favicon and 1200×630 share image generated.");
} finally {
  await browser.close();
  server.close();
}
