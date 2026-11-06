import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await cp("src", "dist/assets", { recursive: true });
await cp("public", "dist", { recursive: true });
const html = (await readFile("index.html", "utf8")).replaceAll(
  "./src/",
  "./assets/",
);
await writeFile("dist/index.html", html);
console.log("Built dist/ with relative URLs and all local runtime assets.");
