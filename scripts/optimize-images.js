import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const imageRoot = path.resolve("public/images");
const outputRoot = path.join(imageRoot, "optimized");
const supported = new Set([".jpg", ".jpeg", ".png"]);
const widths = [256, 384, 1024];

export async function optimizeImage(source) {
  const absoluteSource = path.resolve(source);
  const relative = path.relative(imageRoot, absoluteSource);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Image source must be inside ${imageRoot}`);

  const extension = path.extname(absoluteSource).toLowerCase();
  if (!supported.has(extension)) return 0;

  const sourceInfo = await stat(absoluteSource);
  let processed = 0;
  for (const width of widths) {
    const output = path.join(
      outputRoot,
      relative.slice(0, -extension.length) + `-${width}.webp`,
    );
    await mkdir(path.dirname(output), { recursive: true });
    let outputInfo = null;
    try {
      outputInfo = await stat(output);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (outputInfo && outputInfo.mtimeMs >= sourceInfo.mtimeMs) continue;

    await sharp(absoluteSource)
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
  return processed;
}

export async function optimizeDirectory(directory = imageRoot) {
  let processed = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "optimized") continue;
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      processed += await optimizeDirectory(source);
      continue;
    }
    processed += await optimizeImage(source);
  }
  return processed;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const processed = await optimizeDirectory();
  console.log(
    processed
      ? `Optimized ${processed} image${processed === 1 ? "" : "s"}.`
      : "Optimized images are up to date.",
  );
}
