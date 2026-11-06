import assert from "node:assert/strict";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";

async function filesAt(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (e) =>
        e.isDirectory() ? filesAt(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
      ),
    )
  ).flat();
}
const files = await filesAt("dist");
const html = await readFile("dist/index.html", "utf8");
let assetsChecked = 0;
for (const match of html.matchAll(/(?:src|href|content)="(\.\/[^"#]+)"/g)) {
  await stat(resolve("dist", match[1]));
  assetsChecked++;
}
assert.ok(!html.includes('src="/'));
assert.ok(!html.includes('href="/'));
for (const file of files) {
  assert.ok(
    !/node_modules|\.tgz$|\.zip$|\.map$|\.gitmodules/.test(file),
    `Packaging artifact: ${file}`,
  );
  if (!file.endsWith(".js") && !file.endsWith(".css")) continue;
  const sourcePath = file.replace("dist/assets/", "src/");
  assert.equal(
    await readFile(file, "utf8"),
    await readFile(sourcePath, "utf8"),
    `Stale export: ${file}`,
  );
  if (file.endsWith(".js")) {
    const js = await readFile(file, "utf8");
    for (const m of js.matchAll(/from\s+["'](\.[^"']+)["']/g))
      await stat(resolve(dirname(file), m[1]));
  }
}
const delivered = [
  ".gitignore",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "README.md",
  "DESIGN.md",
];
for (const dir of ["src", "public", "dist", "scripts", "artifacts"])
  delivered.push(...(await filesAt(dir)));
delivered.push(
  ...(await readdir("test"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => `test/${f}`),
);
let bytes = 0;
for (const file of delivered)
  if (file !== "artifacts/export-check.json") bytes += (await stat(file)).size;
assert.ok(bytes < 8388608, `Submission is too big: ${bytes}`);
const result = {
  passed: true,
  localAssetReferencesChecked: assetsChecked,
  productionFiles: files.length,
  productionBytes: (await Promise.all(files.map((f) => stat(f)))).reduce(
    (n, s) => n + s.size,
    0,
  ),
  submittedBytesExcludingThisReport: bytes,
  limitBytes: 8388608,
  relativeAssetURLs: true,
  sourceMatchesExport: true,
  dependencyArchives: false,
};
await writeFile(
  "artifacts/export-check.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
