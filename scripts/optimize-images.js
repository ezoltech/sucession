import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageRoot = path.resolve("public/images");
const outputRoot = path.join(imageRoot, "optimized");
const supported = new Set([".jpg", ".jpeg", ".png"]);
const widths = [256, 384, 1024];
let processed = 0;

async function optimizeDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "optimized") continue;
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await optimizeDirectory(source);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!supported.has(extension)) continue;

    const relative = path.relative(imageRoot, source);
    const sourceInfo = await stat(source);
    for (const width of widths) {
      const output = path.join(
        outputRoot,
        relative.slice(0, -extension.length) + `-${width}.webp`,
      );
      await mkdir(path.dirname(output), { recursive: true });
      const outputInfo = await stat(output).catch(() => null);
      if (outputInfo && outputInfo.mtimeMs >= sourceInfo.mtimeMs) continue;

      await sharp(source)
        .rotate()
        .resize({
          width,
          height: width,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 4 })
        .toFile(output);
      processed++;
    }
  }
}

await optimizeDirectory(imageRoot);
console.log(
  processed
    ? `Optimized ${processed} image${processed === 1 ? "" : "s"}.`
    : "Optimized images are up to date.",
);
