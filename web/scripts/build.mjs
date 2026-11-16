import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "game.js",
  "storage.js",
  "backup.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];
await mkdir(path.join(destination, "icons"), { recursive: true });
await mkdir(path.join(destination, "assets"), { recursive: true });
for (const file of files)
  await copyFile(path.join(root, file), path.join(destination, file));
await copyFile(
  path.join(root, "../assets/words.txt"),
  path.join(destination, "assets/words.txt"),
);
const hash = createHash("sha256");
for (const file of [...files, "assets/words.txt"])
  hash.update(await readFile(path.join(destination, file)));
const worker = await readFile(path.join(root, "sw.js"), "utf8");
hash.update(worker);
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  path.join(destination, "sw.js"),
  worker.replaceAll("__BUILD_VERSION__", version),
);
console.log(`Built TypeRush ${version} in web/dist (no dependencies).`);
