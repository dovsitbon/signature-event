/**
 * Classe les médias bruts récupérés sur Instagram (assets/raw/) dans les dossiers du site :
 *   - photo de chaque fiche produit, détourée du visuel Instagram (titre et prix retirés) -> assets/produits/<id>.jpg
 *   - images fixes extraites des reels (ffmpeg)                                         -> assets/<catégorie>/<nom>.jpg
 *   - boucles du hero et montage « coulisses »                                          -> assets/videos/<nom>.mp4
 * À relancer seulement si assets/raw/ ou data/catalogue.json change. Ensuite : npm run media.
 *
 *   npm run prepare-media
 */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "assets", "raw");
const A = (...p) => path.join(ROOT, "assets", ...p);
const raw = (id) => path.join(RAW, `signature-event_${id}`);
const catalogue = JSON.parse(await readFile(path.join(ROOT, "data", "catalogue.json"), "utf8"));

for (const dir of ["produits", "realisations", "decoration", "traiteur", "coulisses", "videos", "logo"]) await mkdir(A(dir), { recursive: true });

/**
 * Les visuels produits d'Instagram sont des cartes crème : titre en haut, photo au centre, prix en bas.
 * On cherche le plus grand bloc de lignes « pleines » (photo) entre 12 % et 82 % de la hauteur,
 * puis ses colonnes, et on ne garde que ce rectangle.
 */
async function cropCard(src, from = 0.14) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => (y * W + x) * 3;
  const bg = [data[px(8, 8)], data[px(8, 8) + 1], data[px(8, 8) + 2]];
  const off = (x, y) => {
    const i = px(x, y);
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 30;
  };
  // Entre la fin du titre (3 lignes au plus : 13 %) et le filet du prix (82 %), tout ce qui n'est pas crème est la photo.
  const y0 = Math.round(H * from), y1 = Math.round(H * 0.8);
  let top = H, bottom = 0, left = W, right = 0;
  for (let y = y0; y < y1; y++) {
    let n = 0;
    for (let x = 0; x < W; x += 2) n += off(x, y);
    if (n * 2 > W * 0.02) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y += 2) n += off(x, y);
    if (n * 2 > (bottom - top) * 0.02) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  const inset = 3; // retire le liseré d'anticrénelage du cadre
  return sharp(src).extract({ left: left + inset, top: top + inset, width: right - left - 2 * inset, height: bottom - top - 2 * inset });
}

// Titres sur trois lignes : la photo commence plus bas.
const TALL_TITLE = { "chauffe-plat": 0.235, nappe: 0.235 };
let products = 0;
for (const p of catalogue.products) {
  if (!p.source) continue;
  await (await cropCard(`${raw(p.source)}.jpg`, TALL_TITLE[p.id])).jpeg({ quality: 92 }).toFile(A("produits", `${p.id}.jpg`));
  products++;
}

// Photos déjà « propres » (sans carte texte) : copiées telles quelles.
const COPY = [
  ["DZnMNpNik_3_1", "realisations", "anniversaire-papillons"],
  ["DZnMNpNik_3_2", "realisations", "table-rose-poudre"],
  ["DZnMNpNik_3_3", "realisations", "table-rose-poudre-detail"],
  ["DeCRVJoocrN", "traiteur", "bar-a-pancakes"],
];
for (const [id, dir, name] of COPY) await copyFile(`${raw(id)}.jpg`, A(dir, `${name}.jpg`));

// Affiche traiteur : on n'en garde que la photo du buffet (le reste est du texte).
await sharp(`${raw("Dca92jxodYg")}.jpg`).extract({ left: 800, top: 40, width: 640, height: 500 }).jpeg({ quality: 92 }).toFile(A("traiteur", "buffet-affiche.jpg"));
await copyFile(path.join(RAW, "signature-event_logo.jpg"), A("logo", "logo.jpg"));

// [reel, seconde, dossier, nom]. Les reels sont verticaux ; certains contiennent une bande noire (rognée ensuite).
const FRAMES = [
  ["DeKqIUUouLD", 17.5, "decoration", "coin-maries-oriental"],
  ["DeKqIUUouLD", 25, "realisations", "salle-turquoise-tables-rondes"],
  ["DeKqIUUouLD", 32.5, "realisations", "salle-turquoise-dressage"],
  ["DeKqIUUouLD", 50, "realisations", "salle-turquoise-tables-longues"],
  ["DeKqIUUouLD", 5, "realisations", "salle-turquoise-chaises"],
  ["Der4nFsog6y", 2.5, "realisations", "tente-tapis-entree"],
  ["Der4nFsog6y", 20, "realisations", "tente-tables-bordeaux"],
  ["Der4nFsog6y", 25, "realisations", "tente-tables-chaises"],
  ["Der4nFsog6y", 30, "decoration", "coin-maries-tente"],
  ["Der4nFsog6y", 32.5, "decoration", "serviette-bordeaux"],
  ["Dem2Ik0IEHx", 2.5, "realisations", "chaises-napoleon-bordeaux"],
  ["Dem2Ik0IEHx", 7.5, "realisations", "salle-miroir-bordeaux"],
  ["Dem2iXEIqi7", 0.2, "realisations", "table-ballons-ourson"],
  ["De4qFn2siKy", 1.5, "decoration", "coin-photo-arches-fleurs"],
  ["De4qFn2siKy", 2.6, "decoration", "coin-photo-arche-prenom"],
  ["DfIcV1moosp", 28, "decoration", "maison-apres"],
  ["DfIcV1moosp", 15, "realisations", "mariage-maison-tables"],
  ["Da-1GnFIRAq", 0.5, "coulisses", "piles-assiettes"],
  ["Da-1GnFIRAq", 2.5, "coulisses", "fleurs-caisses"],
  ["Da-1GnFIRAq", 5, "coulisses", "chaises-chargement"],
  ["Da-1GnFIRAq", 13, "decoration", "salle-avant"],
  ["Da-1GnFIRAq", 15, "coulisses", "mise-en-place"],
  ["Da-1GnFIRAq", 22.5, "decoration", "salle-apres"],
  ["Da-1GnFIRAq", 32.5, "coulisses", "detail-table"],
  ["Da-1GnFIRAq", 37.5, "realisations", "salle-rose-bleu"],
];

/** Rogne les bandes noires (vidéo paysage incrustée dans un reel vertical). */
async function trimBlack(file) {
  const src = await readFile(file); // lu en mémoire : sous Windows, sharp garde sinon le fichier ouvert
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 0; y < info.height; y++) {
    let s = 0;
    // colonnes centrales seulement : le filigrane TikTok est dans les coins
    const x0 = Math.round(info.width * 0.15), x1 = Math.round(info.width * 0.75);
    for (let x = x0; x < x1; x += 4) s += data[y * info.width + x];
    rows.push(s / ((x1 - x0) / 4) > 18);
  }
  const top = rows.indexOf(true), bottom = rows.lastIndexOf(true);
  if (top <= 0 && bottom >= info.height - 1) return;
  await writeFile(file, await sharp(src).extract({ left: 0, top, width: info.width, height: bottom - top + 1 }).jpeg({ quality: 92 }).toBuffer());
}

for (const [src, t, dir, name] of FRAMES) {
  const out = A(dir, `${name}.jpg`);
  execFileSync(ffmpeg, ["-v", "error", "-y", "-ss", String(t), "-i", `${raw(src)}.mp4`, "-frames:v", "1", "-q:v", "2", out]);
  await trimBlack(out);
}

// Boucles du hero : un plan de 5 s par reel (bureau : triptyque ; mobile : la première seulement).
const HERO = { "hero-a": ["DeKqIUUouLD", 23.5], "hero-b": ["Dem2Ik0IEHx", 1.5], "hero-c": ["Der4nFsog6y", 19] };
const vf = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1";
for (const [out, [src, t]] of Object.entries(HERO)) {
  execFileSync(ffmpeg, ["-v", "error", "-y", "-ss", String(t), "-i", `${raw(src)}.mp4`, "-t", "5", "-an", "-vf", vf,
    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", A("videos", `${out}.mp4`)]);
}

// Coulisses : du chargement à la table dressée, en six plans de 2 s.
const BACKSTAGE = [0, 5, 7.5, 15, 22.5, 27.5];
const parts = BACKSTAGE.map((t, i) => {
  const p = path.join(tmpdir(), `se-coulisses-${i}.mp4`);
  execFileSync(ffmpeg, ["-v", "error", "-y", "-ss", String(t), "-i", `${raw("Da-1GnFIRAq")}.mp4`, "-t", "2", "-an", "-vf", vf,
    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", p]);
  return p;
});
execFileSync(ffmpeg, ["-v", "error", "-y", ...parts.flatMap((p) => ["-i", p]),
  "-filter_complex", `${parts.map((_, i) => `[${i}:v]`).join("")}concat=n=${parts.length}:v=1:a=0[v]`,
  "-map", "[v]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", A("videos", "coulisses.mp4")]);

console.log(`${products} produits, ${COPY.length + FRAMES.length} photos, ${Object.keys(HERO).length + 1} vidéos.`);
