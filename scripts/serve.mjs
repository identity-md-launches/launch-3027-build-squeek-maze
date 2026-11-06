import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep))
      throw new Error("Invalid path");
    let file = path;
    try {
      if ((await stat(path)).isDirectory()) file = resolve(path, "index.html");
    } catch {
      // In the source preview, public assets have the same root URLs as dist/.
      if (root !== resolve(".")) throw new Error("Not found");
      file = resolve(root, "public", "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(resolve(root, "public") + sep))
        throw new Error("Invalid path");
      await stat(file);
    }
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Preview: http://localhost:${port}`),
);
