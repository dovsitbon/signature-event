/**
 * Écrit CONTENU.md : tous les textes du site en français et en anglais, côte à côte, le catalogue complet,
 * les points à valider et les informations à demander au client. Sources : locales/*.json, data/catalogue.json.
 *
 *   npm run contenu
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = async (p) => JSON.parse(await readFile(path.join(ROOT, p), "utf8"));
const fr = await read("locales/fr.json");
const en = await read("locales/en.json");
const cat = await read("data/catalogue.json");

const SECTIONS = {
  meta: "Référencement (titre et description Google)",
  intro: "Intro animée",
  hero: "Haut de page",
  trust: "Bandeau confiance",
  services: "01 · Nos services",
  catalogue: "02 · Catalogue de location",
  decor: "03 · Décoration",
  catering: "04 · Traiteur et animations gourmandes",
  backstage: "05 · Coulisses",
  work: "06 · Réalisations",
  steps: "07 · Comment ça marche",
  reviews: "08 · Avis clients",
  faq: "09 · FAQ (réponses à valider)",
  contact: "10 · Contact et devis",
  cart: "Ma sélection (panier de location)",
  footer: "Pied de page",
  legal: "Mentions légales",
  wa: "WhatsApp",
  media: "Descriptions des photos (texte alternatif)",
};

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
function rows(a, b, prefix = "") {
  if (typeof a !== "object" || a === null) return [`| ${prefix} | ${cell(a)} | ${cell(b ?? "")} |`];
  return Object.keys(a).flatMap((k) => rows(a[k], b?.[k], prefix ? `${prefix}.${k}` : k));
}
const euro = (n) => `${(Number.isInteger(n) ? String(n) : n.toFixed(2)).replace(".", ",")} €`;

let md = `# SIGNATURE EVENT · Contenu du site (FR / EN)

Document de validation pour le client. Chaque ligne correspond à un texte du site ; la colonne de gauche indique où il apparaît.
Pour modifier un texte : \`locales/fr.json\` et \`locales/en.json\`. Produits et prix : \`data/catalogue.json\`. Puis \`npm run build\`.

## Catalogue de location

| Catégorie | Article | Dimensions | Prix | Unité | Visuel Instagram |
|---|---|---|---|---|---|
${cat.products.map((p) => `| ${cat.categories.find((c) => c.id === p.category).name.fr} | ${p.name.fr} / ${p.name.en} | ${p.dims || ""} | ${p.price == null ? "sur demande" : `${p.from ? "à partir de " : ""}${euro(p.price)}`} | ${fr.catalogue.units[p.unit]} | ${p.source} |`).join("\n")}

Nettoyage de la vaisselle : ${cat.settings.cleaning.clean} € si rendue propre, ${cat.settings.cleaning.dirty} € si rendue sale.

`;
for (const [key, title] of Object.entries(SECTIONS)) {
  md += `## ${title}\n\n| Emplacement | Français | English |\n|---|---|---|\n${rows(fr[key], en[key]).join("\n")}\n\n`;
}

md += `## Écarts entre le brief et les visuels Instagram (à trancher)

Les prix affichés sur le site sont ceux des visuels Instagram du client quand ils diffèrent du brief :

- **Tonnelle / barnum 8 × 6 m** : le brief indique « sur demande », le visuel affiche **110 € l'unité**. Le site affiche 110 €.
- **Miroir personnalisable** : le brief indique « sur demande », le visuel affiche **35 €**. Le site affiche 35 €.
- **Numéros de table** : le brief indique « 1 à 20 », le visuel indique « de 1 à 10 ». Le site ne mentionne pas la plage.
- **Mur à cocktails** : deux visuels différents. Mur coloré à 5 étagères **80 €** (DXe6k79DPQs) et mur blanc « Servez-vous » **65 €** (DY2pO7DoSYX). Les deux sont au catalogue.
- **DUI0Bm-DAbe** : le brief l'associe au nettoyage de la vaisselle, mais le visuel présente des **nappes blanches rondes ou rectangulaires à 5 € l'unité**. Ajoutées au catalogue ; le nettoyage (5 € / 8 €) est indiqué en note et dans la FAQ, sans unité claire (par commande ? par lot ?).
- **Verre à eau** : 0,30 € (visuel et brief concordent). Le verre Crystal à eau/vin est à 0,35 €.

## Points à valider avec le client

- **Réponses de la FAQ** : rédigées prudemment (caution « peut être demandée », frais de livraison « sur le devis »). Toutes à relire.
- **Étiquettes des réalisations** (Mariage, Anniversaire, Baptême, Mariage à la maison) : attribuées d'après les photos. À corriger dans \`scripts/generate.mjs\` (GALLERY). Le filtre « Gender reveal » apparaîtra dès qu'une photo portera cette étiquette.
- **Traiteur** : aucun plat n'est cité (aucun menu connu). Seule la photo du buffet de l'affiche est utilisée.
- **Bar à pancakes** : description générique (pancakes préparés sur place, garnitures). À ajuster.
- **Avis clients** : aucun avis inventé. Emplacement prêt dans la section « Vos retours » (commentaire \`À REMPLIR\` dans \`scripts/generate.mjs\`, fonction reviews).
- **Photos provisoires** : trois fiches ont une photo de moins de 500 px (flûte en verre, flûte plastique, miroir) et portent le commentaire \`photo HD à demander au client\`.
- **Couverture Instagram** : 44 publications sur 64 ont été récupérées (celles listées dans le brief). Les 20 autres n'ont pas pu être identifiées automatiquement ; si le client veut les voir dans la galerie, les envoyer.

## Informations manquantes à demander

1. Prix des articles « sur demande » : fauteuil des mariés, coin mariés avec décor à LED.
2. Caution : montant, forme (chèque, empreinte), conditions de restitution.
3. Livraison : zone exacte, frais (forfait ou au kilomètre), minimum de commande éventuel, prix de l'installation et de la désinstallation.
4. Conditions de location : durée (journée, week-end), retrait et retour, casse et perte, annulation, acompte.
5. Traiteur : menus, formules et tarifs par personne, nombre minimum d'invités.
6. Bar à pancakes et bar à gourmandises : tarifs et contenu.
7. Adresse ou dépôt (pour le retrait sur place et la fiche Google Business Profile).
8. Vrais avis clients (texte, prénom, type d'événement), avec leur accord : la story « Vos retours ».
9. SIRET, raison sociale et adresse du siège pour les mentions légales.
10. Adresse email de réception des demandes (pour activer l'envoi par email via Formspree : variable \`FORM_ENDPOINT\`).
11. Compte Stripe et pourcentage d'acompte si le paiement en ligne est souhaité (actuellement ${cat.settings.depositPercent} % par défaut, désactivé).
12. Photos HD des articles et vidéos originales sans filigrane TikTok/Instagram ; logo en SVG ou PNG haute définition.
`;

await writeFile(path.join(ROOT, "CONTENU.md"), md);
console.log("CONTENU.md écrit.");
