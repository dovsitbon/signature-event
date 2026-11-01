import { defineConfig } from "vite";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

// Les pages sont générées par scripts/generate.mjs : index.html + /fr/, /en/ (et leurs sous-pages).
const root = import.meta.dirname;
const LANGS = ["fr", "en"];
const pages = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === "index.html" ? [p] : [];
  });
const input = [path.join(root, "index.html"), ...LANGS.flatMap((l) => pages(path.join(root, l)))];

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  server: { port: 5190 },
  preview: { port: 5190 },
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: true,
    rollupOptions: { input },
  },
});
