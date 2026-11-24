import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { optimizeImage } from "./scripts/optimize-images.js";

const imageRoot = path.resolve("public/images");
const imageExtensions = [".jpg", ".jpeg", ".png"];
const optimizedWidths = new Set([256, 384, 1024]);

function optimizeMissingImages() {
  const inFlight = new Map();

  return {
    name: "optimize-missing-images",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }

        const pathname = new URL(req.url ?? "/", "http://vite.local").pathname;
        const match = pathname.match(
          /^\/images\/optimized\/(.+)-(\d+)\.webp$/,
        );
        if (!match || !optimizedWidths.has(Number(match[2]))) {
          next();
          return;
        }

        let relativeStem;
        try {
          relativeStem = decodeURIComponent(match[1]);
        } catch {
          next();
          return;
        }

        const sourceStem = path.resolve(imageRoot, relativeStem);
        const relative = path.relative(imageRoot, sourceStem);
        if (
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        ) {
          next();
          return;
        }

        const output = path.join(
          imageRoot,
          "optimized",
          `${relative}-${match[2]}.webp`,
        );
        const prepareImage = async () => {
          for (const extension of imageExtensions) {
            const source = sourceStem + extension;
            let info;
            try {
              info = await stat(source);
            } catch (error) {
              if (error.code === "ENOENT") continue;
              throw error;
            }
            if (!info.isFile()) continue;

            let job = inFlight.get(source);
            if (!job) {
              job = optimizeImage(source);
              inFlight.set(source, job);
            }
            try {
              await job;
            } finally {
              if (inFlight.get(source) === job) inFlight.delete(source);
            }
            return true;
          }
          return false;
        };

        prepareImage()
          .then(async (sourceFound) => {
            if (!sourceFound) {
              next();
              return;
            }

            const image = await readFile(output);
            res.statusCode = 200;
            res.setHeader("Content-Type", "image/webp");
            res.setHeader("Content-Length", image.length);
            res.setHeader("Cache-Control", "no-store");
            res.end(req.method === "HEAD" ? undefined : image);
          })
          .catch((error) => {
            server.config.logger.error(
              `[image optimizer] Failed to prepare ${pathname}: ${error instanceof Error ? error.message : String(error)}`,
            );
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Failed to prepare optimized image.");
          });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), optimizeMissingImages()],
});
