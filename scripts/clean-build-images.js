import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const imageRoot = path.resolve("dist/images");
const sourceExtensions = new Set([".jpg", ".jpeg", ".png"]);
let removed = 0;

async function removeSourceCopies(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeSourceCopies(file);
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      await unlink(file);
      removed++;
    }
  }
}

await removeSourceCopies(imageRoot);
console.log(`Removed ${removed} unoptimized source image copies from dist.`);
