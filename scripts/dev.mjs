import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { manifest } from "./build.mjs";
await manifest();
const root = path.resolve(import.meta.dirname, "..");
const types = {
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      const rel = path.relative(root, file);
      if (
        rel.startsWith("..") ||
        rel.split(path.sep).some((x) => x.startsWith(".")) ||
        (!["index.html", "styles.css", "app.js", "config.js"].includes(rel) &&
          !rel.startsWith("larp-stuff/") &&
          !rel.startsWith("assets/"))
      ) {
        res.writeHead(404).end("Not found");
        return;
      }
      const data = await readFile(file);
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
        })
        .end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(Number(process.env.PORT) || 5173, "0.0.0.0", () =>
    console.log("Larpin dev server on port " + (process.env.PORT || 5173)),
  );
