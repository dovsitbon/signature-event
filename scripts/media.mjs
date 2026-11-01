/**
 * Prépare les visuels du dossier assets/ pour le web (à relancer après tout ajout de photo ou de vidéo) :
 *   - photos -> public/media/<catégorie>/<nom>-<largeur>.avif|webp (480, 960, 1440 px max)
 *   - vidéos -> public/media/videos/<nom>.mp4 (H.264) + .webm (VP9), sans son, 540 px de large, + affiche .webp
 *   - logo   -> logo doré détouré (PNG transparent), monogramme plein et son contour (intro), favicon, icônes, image Open Graph
 * Écrit src/data/media-sizes.json (dimensions lues par le générateur de pages).
 *
 *   npm run media
 */
import { readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "public", "media");
const WIDTHS = [480, 960, 1440];
const PHOTO_DIRS = ["produits", "realisations", "decoration", "traiteur", "coulisses"];

const sizes = {};
const fresh = async (src, out) => {
  try {
    return (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs;
  } catch {
    return false;
  }
};

for (const dir of PHOTO_DIRS) {
  const files = (await readdir(path.join(ASSETS, dir)).catch(() => [])).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  await mkdir(path.join(OUT, dir), { recursive: true });
  for (const file of files) {
    const name = file.replace(/\.[^.]+$/, "");
    const src = path.join(ASSETS, dir, file);
    const meta = await sharp(src).metadata();
    const widths = [...new Set(WIDTHS.map((w) => Math.min(w, meta.width)))];
    for (const w of widths) {
      const base = path.join(OUT, dir, `${name}-${w}`);
      if (await fresh(src, `${base}.webp`)) continue;
      const img = sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
      await img.clone().avif({ quality: 52, effort: 5 }).toFile(`${base}.avif`);
      await img.clone().webp({ quality: 76 }).toFile(`${base}.webp`);
    }
    sizes[`${dir}/${name}`] = { w: meta.width, h: meta.height, widths };
  }
}

await mkdir(path.join(OUT, "videos"), { recursive: true });
for (const file of (await readdir(path.join(ASSETS, "videos")).catch(() => [])).filter((f) => f.endsWith(".mp4"))) {
  const name = file.replace(/\.mp4$/, "");
  const src = path.join(ASSETS, "videos", file);
  const base = path.join(OUT, "videos", name);
  if (!(await fresh(src, `${base}.webm`))) {
    const input = ["-v", "error", "-y", "-i", src, "-an", "-vf", "scale=540:-2,fps=30"];
    execFileSync(ffmpeg, [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${base}.mp4`]);
    execFileSync(ffmpeg, [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "37", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", `${base}.webm`]);
    const poster = path.join(tmpdir(), `se-${name}.jpg`);
    execFileSync(ffmpeg, ["-v", "error", "-y", "-ss", "0.2", "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "2", poster]);
    await sharp(poster).webp({ quality: 72 }).toFile(`${base}.webp`);
  }
  const m = await sharp(`${base}.webp`).metadata();
  sizes[`videos/${name}`] = { w: m.width, h: m.height };
}

/*
 * Logo : or sur noir. L'or devient opaque et le noir transparent (alpha = luminosité),
 * pour poser le logo sur n'importe quel fond sombre sans « carré » noir.
 */
const LOGO = path.join(ASSETS, "logo", "logo.jpg");
async function goldOnTransparent(region, width) {
  const { data, info } = await sharp(LOGO).extract(region).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = Math.min(255, Math.max(0, (Math.max(r, g, b) - 22) * 1.6));
    // couleur « dé-assombrie » : on retire le noir pour que les bords ne grisent pas
    const k = a ? 255 / Math.max(r, g, b, 1) : 0;
    out[j] = Math.min(255, r * k * 0.86); out[j + 1] = Math.min(255, g * k * 0.86); out[j + 2] = Math.min(255, b * k * 0.86); out[j + 3] = a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}
await mkdir(path.join(OUT, "logo"), { recursive: true });
const FULL = { left: 40, top: 160, width: 1000, height: 740 };
const MONO = { left: 285, top: 170, width: 560, height: 462 };
await (await goldOnTransparent(FULL, 520)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "logo", "logo-or.png"));
await (await goldOnTransparent(FULL, 520)).webp({ quality: 90, alphaQuality: 90 }).toFile(path.join(OUT, "logo", "logo-or.webp"));
const mono = await (await goldOnTransparent(MONO, 560)).png().toBuffer();
await sharp(mono).webp({ quality: 92, alphaQuality: 95 }).toFile(path.join(OUT, "logo", "monogramme.webp"));

// Contour du monogramme (pour le tracé de l'intro) : bord de l'alpha, épaissi d'un pixel.
{
  const { data, info } = await sharp(mono).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3] > 110;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const me = A(x, y);
    const edge = me !== A(x - 1, y) || me !== A(x + 1, y) || me !== A(x, y - 1) || me !== A(x, y + 1);
    if (!edge) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const j = ((y + dy) * W + x + dx) * 4;
      out[j] = 226; out[j + 1] = 200; out[j + 2] = 142; out[j + 3] = 255;
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).blur(0.4).webp({ quality: 92, alphaQuality: 95 }).toFile(path.join(OUT, "logo", "monogramme-trait.webp"));
}

// Favicon et icônes : monogramme sur noir.
const icon = async (size, pad) => {
  const m = await sharp(mono).resize({ width: Math.round(size * (1 - pad * 2)) }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#0E0E0E" } }).composite([{ input: m, gravity: "center" }]);
};
await (await icon(64, 0.08)).png().toFile(path.join(ROOT, "public", "favicon.png"));
await writeFile(path.join(ROOT, "public", "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0E0E0E"/><image href="data:image/png;base64,${(await (await icon(128, 0.1)).png().toBuffer()).toString("base64")}" width="64" height="64"/></svg>`);
for (const [file, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  await (await icon(size, 0.14)).png().toFile(path.join(ROOT, "public", file));
}

// Image de partage 1200x630 : logo à gauche, salle dressée à droite.
const ogLogo = await (await goldOnTransparent(FULL, 460)).png().toBuffer();
const ogPhoto = await sharp(path.join(ASSETS, "realisations", "chaises-napoleon-bordeaux.jpg")).resize(560, 630, { fit: "cover" }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#0E0E0E" } })
  .composite([{ input: ogLogo, left: 90, top: 145 }, { input: ogPhoto, left: 640, top: 0 }])
  .jpeg({ quality: 84 }).toFile(path.join(ROOT, "public", "og.jpg"));

await mkdir(path.join(ROOT, "src", "data"), { recursive: true });
await writeFile(path.join(ROOT, "src", "data", "media-sizes.json"), JSON.stringify(sizes, null, 1));
console.log(`${Object.keys(sizes).length} médias prêts.`);
