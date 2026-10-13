import {
  mkdir,
  copyFile,
  cp,
  readdir,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
export async function manifest() {
  const items = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(e.name)) {
        const rel = path
          .relative(root, p)
          .split(path.sep)
          .map(encodeURIComponent)
          .join("/");
        items.push({
          id: `free-${rel}`,
          title: path
            .basename(e.name, path.extname(e.name))
            .replace(/[-_]/g, " "),
          url: rel,
          type: /\.(mp4|webm)$/i.test(e.name) ? "video" : "image",
          createdAt: 0,
        });
      }
    }
  }
  await walk(path.join(root, "larp-stuff"));
  await writeFile(
    path.join(root, "larp-stuff/manifest.json"),
    JSON.stringify(items, null, 2),
  );
  return items;
}
if (process.argv[1] === import.meta.filename) {
  await manifest();
  await rm(path.join(root, "dist"), { recursive: true, force: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  for (const f of ["index.html", "styles.css", "app.js", "config.js"])
    await copyFile(path.join(root, f), path.join(root, "dist", f));
  await cp(path.join(root, "assets"), path.join(root, "dist/assets"), {
    recursive: true,
  });
  await cp(path.join(root, "larp-stuff"), path.join(root, "dist/larp-stuff"), {
    recursive: true,
    filter: (p) => !p.endsWith("README.md"),
  });
  await writeFile(path.join(root, "dist/.nojekyll"), "");
  console.log("Built GitHub Pages site in dist/");
}
