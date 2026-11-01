# SIGNATURE EVENT · Location, décoration, traiteur

Site vitrine bilingue (FR / EN) de Signature Event, location de matériel de réception, décoration et traiteur halal sans alcool à Rouen et en Normandie (Instagram @signature_event_76).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5190/fr/
```

## Stack

Vite + Lenis (défilement fluide), HTML statique généré par langue (`scripts/generate.mjs`). Pas de framework :
chaque page arrive déjà rendue (référencement, rapidité), le JavaScript ne gère que l'intro, le panier, les filtres et la galerie.
Les animations sont en CSS (intro, apparitions au défilement) et respectent `prefers-reduced-motion`.

## Où modifier quoi

| Quoi | Fichier |
|---|---|
| Textes (FR, EN) | `locales/fr.json`, `locales/en.json` |
| Articles, prix, unités, Stripe, nettoyage | `data/catalogue.json` |
| Photos et vidéos | `assets/<catégorie>/`, puis `npm run media` |
| Photos des réalisations et leurs étiquettes | `scripts/generate.mjs` (GALLERY) |
| Styles | `src/styles/main.css` |
| Comportements (intro, sélection, devis, galerie) | `src/main.js` |

`npm run contenu` régénère `CONTENU.md` (tous les textes et le catalogue, pour validation par le client).

## Médias

`assets/raw/` contient les visuels publics de l'Instagram du client. `npm run prepare-media` détoure la photo de chaque
fiche produit (le visuel Instagram contient le titre et le prix), extrait des images fixes des reels et monte les boucles
vidéo. `npm run media` produit les versions web (AVIF/WebP en 3 tailles, vidéos MP4 + WebM sans son, logo détouré, favicon,
image de partage).

## Demandes et paiement

- « Ma sélection » est gardée dans le navigateur (localStorage) et envoyée par WhatsApp avec le récapitulatif complet.
- Envoi par email : définir `FORM_ENDPOINT` (URL Formspree) dans les variables Vercel ; le bouton apparaît au déploiement suivant.
- Acompte en ligne : passer `stripeEnabled` à `true` dans `data/catalogue.json` et ajouter `STRIPE_SECRET_KEY` dans Vercel.
  `api/checkout.js` recalcule toujours les prix côté serveur.
- `SITE_URL` : URL de production (canonicals, hreflang, sitemap).
