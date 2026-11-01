/**
 * Génère les pages statiques du site, une par langue :
 *   /index.html (redirection vers la langue du navigateur), /fr/…, /en/…
 *   + public/sitemap.xml, public/robots.txt, public/llms.txt
 * Textes : locales/<langue>.json — Produits et prix : data/catalogue.json — Médias : src/data/media-sizes.json (npm run media).
 *
 *   npm run gen   (lancé automatiquement par npm run dev et npm run build)
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = (process.env.SITE_URL || "https://signature-event.vercel.app").replace(/\/$/, "");
const FORM_ENDPOINT = process.env.FORM_ENDPOINT || "";
const LANGS = ["fr", "en"];
const read = async (p) => JSON.parse(await readFile(path.join(ROOT, p), "utf8"));
const L = { fr: await read("locales/fr.json"), en: await read("locales/en.json") };
const CAT = await read("data/catalogue.json");
const SIZES = await read("src/data/media-sizes.json");

const PHONE = "07 83 53 58 11";
// Polices chargées sans bloquer le rendu (le texte s'affiche d'abord dans la police de secours).
const FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&family=Pinyon+Script&display=swap";
const PHONE_INTL = "+33783535811";
const WA = `https://wa.me/${CAT.settings.whatsapp}`;
const INSTAGRAM = "https://www.instagram.com/signature_event_76/";
const TIKTOK = "https://www.tiktok.com/@signatureevent76";

// Pages et leurs adresses dans chaque langue.
const PAGES = {
  home: { fr: "", en: "" },
  location: { fr: "location/", en: "hire/" },
  decoration: { fr: "decoration/", en: "decor/" },
  traiteur: { fr: "traiteur/", en: "catering/" },
  realisations: { fr: "realisations/", en: "our-work/" },
  legal: { fr: "mentions-legales/", en: "legal-notice/" },
};
const href = (lang, page, hash = "") => `/${lang}/${PAGES[page][lang]}${hash}`;

// Réalisations : photo, catégories (filtres de la galerie). Étiquettes déduites des photos, à valider (CONTENU.md).
const GALLERY = [
  ["realisations/salle-turquoise-tables-rondes", "mariage", { fr: "Mariage, salle aux boiseries turquoise", en: "Wedding, turquoise-panelled venue" }],
  ["realisations/anniversaire-papillons", "anniversaire", { fr: "Anniversaire, arche de ballons et papillons", en: "Birthday, balloon arch and butterflies" }],
  ["realisations/tente-tables-bordeaux", "mariage", { fr: "Mariage sous tente, tables bordeaux", en: "Marquee wedding, burgundy tables" }],
  ["realisations/chaises-napoleon-bordeaux", "mariage", { fr: "Chaises Napoléon Crystal et nappes bordeaux", en: "Napoleon Crystal chairs and burgundy cloths" }],
  ["realisations/table-ballons-ourson", "bapteme", { fr: "Baptême, ballons or et vert", en: "Christening, gold and green balloons" }],
  ["realisations/mariage-maison-tables", "mariage-maison", { fr: "Mariage à la maison, en petit comité", en: "Small wedding at home" }],
  ["realisations/table-rose-poudre", "anniversaire", { fr: "Table rose poudré, assiettes liseré or", en: "Dusty pink table, gold-rim plates" }],
  ["realisations/salle-turquoise-tables-longues", "mariage", { fr: "Tables d'honneur dans la lumière", en: "Long tables in the afternoon light" }],
  ["realisations/tente-tapis-entree", "mariage", { fr: "Entrée de tente, tapis et cordons dorés", en: "Marquee entrance, rug and gold ropes" }],
  ["realisations/salle-rose-bleu", "mariage", { fr: "Tables rose et bleu nuit", en: "Pink and midnight-blue tables" }],
  ["realisations/salle-turquoise-dressage", "mariage", { fr: "Dressage, vaisselle et verres Crystal", en: "Place settings, crystal glassware" }],
  ["decoration/maison-apres", "mariage-maison", { fr: "Salon transformé pour un mariage", en: "Living room set for a wedding" }],
  ["realisations/salle-miroir-bordeaux", "mariage", { fr: "Salle aux miroirs, tables bordeaux", en: "Mirrored room, burgundy tables" }],
  ["realisations/table-rose-poudre-detail", "anniversaire", { fr: "Détail de table, fleurs et chemin rose", en: "Table detail, flowers and pink runner" }],
  ["realisations/tente-tables-chaises", "mariage", { fr: "Tables rondes sous tente", en: "Round tables in a marquee" }],
  ["realisations/salle-turquoise-chaises", "mariage", { fr: "Chaises blanches sur parquet", en: "White chairs on parquet" }],
];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const price = (n, lang) => {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return lang === "fr" ? `${s.replace(".", ",")} €` : `€${s}`;
};

/** Image responsive (AVIF + WebP) à partir des tailles produites par npm run media. */
function pic(key, alt, { sizes = "100vw", cls = "", eager = false, ratio = false } = {}) {
  const m = SIZES[key];
  if (!m) throw new Error(`Média manquant : ${key} (lancer npm run prepare-media puis npm run media)`);
  const set = (ext) => m.widths.map((w) => `/media/${key}-${w}.${ext} ${w}w`).join(", ");
  const last = m.widths[m.widths.length - 1];
  const style = ratio ? ` style="aspect-ratio:${m.w}/${m.h}"` : "";
  return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><img src="/media/${key}-${last}.webp" srcset="${set("webp")}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}"${style} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}
const big = (key) => `/media/${key}-${SIZES[key].widths[SIZES[key].widths.length - 1]}.webp`;

const video = (name, label, cls = "") => {
  const m = SIZES[`videos/${name}`];
  return `<video class="${cls}" muted loop playsinline preload="none" poster="/media/videos/${name}.webp" width="${m.w}" height="${m.h}" data-autoplay${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}><source src="/media/videos/${name}.webm" type="video/webm"><source src="/media/videos/${name}.mp4" type="video/mp4"></video>`;
};

const icon = {
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.6A8.3 8.3 0 0 1 7.8 19L4 20l1-3.7a8.3 8.3 0 1 1 15-4.7Z"/><path d="M9 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.6 1 1.4 1.8 2.5 2.4.2.1.4.1.5 0l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.2-.7 1.5-.5.3-1.4.6-2.6.2-1.3-.4-2.7-1.4-3.8-2.6-1-1.1-1.6-2.3-1.8-3.2-.1-.8.2-1.5.5-1.9Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>',
  tt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.3 5 4.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
};

const kicker = (n, text) => `<p class="kicker"><span class="kicker__n">${n}</span><span class="kicker__line" aria-hidden="true"></span>${esc(text)}</p>`;
const waLink = (text) => `${WA}?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------------ sections */

function head(lang, page) {
  const t = L[lang];
  const meta = t.meta[page];
  const url = `${SITE}${href(lang, page)}`;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${href(l, page)}">`).join("");
  const ld = [business(lang)];
  if (page === "home") ld.push(faqLd(lang));
  if (page !== "home") ld.push(breadcrumb(lang, page));
  if (page === "location") ld.push(offersLd(lang));
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
${alternates}<link rel="alternate" hreflang="x-default" href="${SITE}${href("fr", page)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Signature Event">
<meta property="og:locale" content="${t.locale}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0E0E">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONTS}">
<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTS}"></noscript>
<link rel="stylesheet" href="/src/styles/main.css">
${page === "home" ? `<script>try{if(!sessionStorage.getItem("se-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("intro-on")}catch(e){}</script>\n` : ""}${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>`;
}

function business(lang) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EventPlanner"],
    "@id": `${SITE}/#business`,
    name: "Signature Event",
    alternateName: "SignatureEvent76",
    slogan: L[lang].intro.tagline,
    description: L[lang].meta.home.description,
    url: `${SITE}/${lang}/`,
    logo: `${SITE}/icon-512.png`,
    image: `${SITE}/og.jpg`,
    telephone: PHONE_INTL,
    priceRange: "€",
    address: { "@type": "PostalAddress", addressLocality: "Rouen", postalCode: "76000", addressRegion: "Normandie", addressCountry: "FR" },
    areaServed: [{ "@type": "City", name: "Rouen" }, { "@type": "AdministrativeArea", name: "Normandie" }],
    sameAs: [INSTAGRAM, TIKTOK],
    knowsLanguage: ["fr", "en"],
  };
}
function faqLd(lang) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: L[lang].faq.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}
function breadcrumb(lang, page) {
  const t = L[lang];
  const names = { location: t.nav.rental, decoration: t.nav.decor, traiteur: t.nav.catering, realisations: t.nav.work, legal: t.footer.legal };
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.nav.home, item: `${SITE}/${lang}/` },
      { "@type": "ListItem", position: 2, name: names[page], item: `${SITE}${href(lang, page)}` },
    ],
  };
}
function offersLd(lang) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: L[lang].catalogue.pageTitle,
    itemListElement: CAT.products.filter((p) => p.price != null).map((p) => ({
      "@type": "Offer",
      price: p.price,
      priceCurrency: "EUR",
      businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
      itemOffered: { "@type": "Product", name: p.name[lang], image: `${SITE}${big(`produits/${p.id}`)}` },
      seller: { "@id": `${SITE}/#business` },
    })),
  };
}

function header(lang, page) {
  const t = L[lang];
  const links = [["home", t.nav.home], ["location", t.nav.rental], ["decoration", t.nav.decor], ["traiteur", t.nav.catering], ["realisations", t.nav.work]];
  const nav = links.map(([p, label]) => `<li><a href="${href(lang, p)}"${p === page ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("")
    + `<li><a href="${href(lang, "home", "#contact")}">${esc(t.nav.contact)}</a></li>`;
  const switcher = `<div class="lang" role="group" aria-label="${esc(t.nav.langLabel)}">${LANGS.map((l, i) => `${i ? '<span aria-hidden="true">·</span>' : ""}<a href="${href(l, page)}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === lang ? ' aria-current="true"' : ""}>${l.toUpperCase()}</a>`).join("")}</div>`;
  return `<a class="skip" href="#main">${esc(t.nav.skip)}</a>
<header class="header${page === "home" ? " header--over" : ""}" data-header>
  <div class="header__inner">
    <a class="header__logo" href="/${lang}/" aria-label="Signature Event, ${esc(t.nav.home)}">
      <img src="/media/logo/monogramme.webp" width="560" height="462" alt="">
      <span class="header__word" aria-hidden="true" translate="no"><span class="script">Signature</span> <span class="caps">Event</span></span>
    </a>
    <nav class="header__nav" aria-label="${esc(t.nav.main)}"><ul>${nav}</ul></nav>
    <div class="header__tools">
      ${switcher}
      <button class="header__cart" type="button" data-cart-open aria-label="${esc(t.nav.cart)}">${icon.bag}<span class="header__count" data-cart-count hidden>0</span></button>
      <a class="btn btn--gold btn--sm header__cta" href="${href(lang, "home", "#contact")}">${esc(t.nav.quote)}</a>
      <button class="header__burger" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle><span class="sr">${esc(t.nav.menu)}</span><i></i><i></i></button>
    </div>
  </div>
  <div class="menu" id="menu" hidden>
    <ul>${nav}</ul>
    ${switcher}
    <a class="btn btn--gold" href="${href(lang, "home", "#contact")}">${esc(t.nav.quote)}</a>
    <a class="menu__phone" href="tel:${PHONE_INTL}">${icon.phone}${PHONE}</a>
  </div>
</header>`;
}

function intro(lang) {
  const t = L[lang].intro;
  const words = t.tagline.split(" ").map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(" ");
  // Le tracé est un masque : six coups de plume larges qui découvrent le contour réel du logo.
  const strokes = [
    "M330 42C250 0 120 18 118 104C116 190 380 280 548 392",
    "M300 268C160 250 10 320 30 400C55 470 260 470 330 420",
    "M268 150V448",
    "M262 150H430",
    "M262 292H405",
    "M262 444H448",
  ].map((d, i) => `<path d="${d}" pathLength="1" style="--d:${i}"/>`).join("");
  return `<div class="intro" data-intro aria-hidden="true">
  <div class="intro__curtain intro__curtain--l"></div><div class="intro__curtain intro__curtain--r"></div>
  <div class="intro__stage">
    <div class="intro__logo">
    <svg class="intro__mono" viewBox="0 0 560 462" role="presentation">
      <defs><mask id="pen" maskUnits="userSpaceOnUse"><g fill="none" stroke="#fff" stroke-width="74" stroke-linecap="round" stroke-linejoin="round">${strokes}</g></mask></defs>
      <image class="intro__line" href="/media/logo/monogramme-trait.webp" width="560" height="462" mask="url(#pen)"/>
      <image class="intro__fill" href="/media/logo/monogramme.webp" width="560" height="462"/>
    </svg>
    <div class="intro__shine"></div>
    </div>
    <p class="intro__brand"><span class="script">Signature</span><span class="caps">Event</span></p>
    <p class="intro__tagline">${words}</p>
  </div>
  <button class="intro__skip" type="button" data-intro-skip>${esc(t.skip)}</button>
</div>`;
}

function hero(lang) {
  const t = L[lang].hero;
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media">
    ${video("hero-a", "", "hero__video")}
    ${video("hero-b", "", "hero__video hero__video--desk")}
    ${video("hero-c", "", "hero__video hero__video--desk")}
  </div>
  <div class="hero__shade"></div>
  <div class="hero__content">
    <h1 id="hero-title" class="hero__eyebrow">${esc(t.eyebrow)}</h1>
    <p class="hero__title">${esc(t.title)}</p>
    <p class="hero__sub">${esc(t.sub)}</p>
    <div class="hero__ctas">
      <a class="btn btn--gold" href="${href(lang, "location")}">${esc(t.ctaCatalogue)}</a>
      <a class="btn btn--ghost" href="#contact">${esc(t.ctaQuote)}</a>
    </div>
  </div>
  <a class="hero__scroll" href="#services"><span>${esc(t.scroll)}</span><i aria-hidden="true"></i></a>
</section>`;
}

function trust(lang) {
  return `<div class="trust"><ul>${L[lang].trust.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`;
}

function services(lang, n) {
  const t = L[lang].services;
  const alts = L[lang].media.services;
  const targets = [href(lang, "location"), href(lang, "decoration"), href(lang, "traiteur"), href(lang, "traiteur", "#animations")];
  const imgs = ["realisations/chaises-napoleon-bordeaux", "decoration/coin-maries-oriental", "traiteur/buffet-affiche", "traiteur/bar-a-pancakes"];
  return `<section class="section section--light services" id="services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="section__head reveal">
      ${kicker(n, t.kicker)}
      <h2 id="services-title" class="h2">${esc(t.title)}</h2>
      <p class="lead">${esc(t.intro)}</p>
    </div>
    <div class="services__grid">
      ${t.items.map((s, i) => `<a class="service reveal" href="${targets[i]}" style="--d:${i}">
        <div class="service__media">${pic(imgs[i], alts[i], { sizes: "(min-width: 1000px) 25vw, (min-width: 640px) 50vw, 100vw" })}</div>
        <span class="service__n">0${i + 1}</span>
        <h3 class="service__title">${esc(s.title)}</h3>
        <p class="service__text">${esc(s.text)}</p>
        <span class="link">${esc(s.link)}${icon.arrow}</span>
      </a>`).join("")}
    </div>
  </div>
</section>`;
}

function productCard(p, lang, i = 0) {
  const t = L[lang].catalogue;
  const key = `produits/${p.id}`;
  const cat = CAT.categories.find((c) => c.id === p.category).name[lang];
  const low = SIZES[key].w < 500;
  const details = [p.description[lang], p.dims].filter(Boolean).join(" · ");
  const priceHtml = p.price == null
    ? `<p class="product__price product__price--ask">${esc(t.onRequest)}</p>`
    : `<p class="product__price">${p.from ? `<small>${esc(t.from)}</small> ` : ""}<strong>${price(p.price, lang)}</strong> <small>${esc(t.units[p.unit])}</small></p>`;
  const actions = p.price == null
    ? `<a class="btn btn--line btn--block" href="${waLink(fill(L[lang].cart.askPriceMsg, { name: p.name[lang] }))}" target="_blank" rel="noopener">${esc(t.askPrice)}</a>`
    : `<div class="qty" data-qty>
          <button type="button" data-step="-1" aria-label="${esc(t.less)}">−</button>
          <input type="number" inputmode="numeric" min="1" max="999" value="${p.unit === "guest" ? 50 : 1}" aria-label="${esc(t.qty)} : ${esc(p.name[lang])}">
          <button type="button" data-step="1" aria-label="${esc(t.more)}">+</button>
        </div>
        <button class="btn btn--dark product__add" type="button" data-add="${p.id}"><span>${esc(t.add)}</span></button>`;
  return `<article class="product reveal" data-cat="${p.category}" style="--d:${i % 4}">
      ${low ? "<!-- photo HD à demander au client -->" : ""}
      <div class="product__media">${pic(key, p.name[lang], { sizes: "(min-width: 1200px) 22vw, (min-width: 700px) 30vw, 46vw" })}</div>
      <div class="product__body">
        <p class="product__cat">${esc(cat)}</p>
        <h3 class="product__name">${esc(p.name[lang])}</h3>
        <p class="product__desc">${esc(details)}</p>
        ${priceHtml}
        <div class="product__actions">${actions}</div>
      </div>
    </article>`;
}

/** Accueil : les articles phares en liste numérotée, puis les catégories avec leur nombre d'articles. */
function cataloguePreview(lang, n) {
  const t = L[lang].catalogue;
  const featured = CAT.products.filter((p) => p.featured);
  const [first, ...rest] = featured;
  const counts = Object.fromEntries(CAT.categories.map((c) => [c.id, CAT.products.filter((p) => p.category === c.id).length]));
  const catImg = { mobilier: "produits/chaise-napoleon-crystal", decoration: "produits/arche-coeur", vaisselle: "produits/pack-vaisselle", traiteur: "produits/chauffe-plat" };
  return `<section class="section section--ivory preview" id="location" aria-labelledby="catalogue-title">
  <div class="wrap">
    <div class="section__head section__head--split reveal">
      <div>${kicker(n, t.kicker)}<h2 id="catalogue-title" class="h2">${esc(t.title)}</h2></div>
      <p class="lead">${esc(t.intro)}</p>
    </div>
    <p class="eyebrow reveal">${esc(t.featuredKicker)}</p>
    <div class="feature">
      <a class="feature__main reveal" href="${href(lang, "location", `#${first.id}`)}">
        <span class="feature__n">01</span>
        <div class="feature__media">${pic(`produits/${first.id}`, first.name[lang], { sizes: "(min-width: 900px) 40vw, 90vw" })}</div>
        <div class="feature__text">
          <h3>${esc(first.name[lang])}</h3>
          <p>${esc(first.description[lang])}</p>
          <p class="feature__price">${price(first.price, lang)} <small>${esc(t.units[first.unit])}</small></p>
        </div>
      </a>
      <ol class="feature__list">
        ${rest.map((p, i) => `<li class="reveal" style="--d:${i}"><a href="${href(lang, "location", `#${p.id}`)}">
          <div class="feature__thumb">${pic(`produits/${p.id}`, p.name[lang], { sizes: "120px" })}</div>
          <span class="feature__n">0${i + 2}</span>
          <span class="feature__name">${esc(p.name[lang])}</span>
          <span class="feature__price">${p.price == null ? esc(t.onRequest) : `${p.from ? esc(t.from) + " " : ""}${price(p.price, lang)}`}</span>
        </a></li>`).join("")}
      </ol>
    </div>
    <ul class="cats">
      ${CAT.categories.map((c, i) => `<li class="reveal" style="--d:${i}"><a href="${href(lang, "location", `?cat=${c.id}`)}">
        <div class="cats__media">${pic(catImg[c.id], "", { sizes: "(min-width: 900px) 22vw, 45vw" })}</div>
        <span class="cats__count">${esc(fill(t.count, { n: counts[c.id] }))}</span>
        <span class="cats__name">${esc(c.name[lang])}</span>
      </a></li>`).join("")}
    </ul>
    <p class="center reveal"><a class="btn btn--dark" href="${href(lang, "location")}">${esc(t.seeAll)}</a></p>
  </div>
</section>`;
}

/** Page Location : filtres par catégorie (avec compteurs) et grille de toutes les fiches. */
function catalogueFull(lang) {
  const t = L[lang].catalogue;
  const count = (id) => CAT.products.filter((p) => !id || p.category === id).length;
  const filters = [[null, t.all], ...CAT.categories.map((c) => [c.id, c.name[lang]])]
    .map(([id, label]) => `<li><button type="button" data-filter="${id || "all"}" aria-pressed="${id ? "false" : "true"}">${esc(label)}<span>${count(id)}</span></button></li>`).join("");
  return `<section class="section section--ivory catalogue" aria-labelledby="catalogue-title">
  <h2 id="catalogue-title" class="sr">${esc(t.title)}</h2>
  <div class="wrap catalogue__layout">
    <aside class="catalogue__side">
      <p class="eyebrow">${esc(t.filters)}</p>
      <ul class="filters" data-filters>${filters}</ul>
      <p class="catalogue__note">${esc(fill(t.cleaning, CAT.settings.cleaning))}</p>
    </aside>
    <div class="catalogue__grid" data-grid>
      ${CAT.products.map((p, i) => productCard(p, lang, i).replace('<article class="product', `<article id="${p.id}" class="product`)).join("\n")}
    </div>
  </div>
</section>`;
}

function beforeAfter(lang, before, after, label, alts, i) {
  const t = L[lang].decor;
  return `<figure class="compare reveal" style="--d:${i}">
    <div class="compare__frame" data-compare style="--pos:50%">
      ${pic(after, alts[1], { sizes: "(min-width: 900px) 40vw, 92vw", cls: "compare__img" })}
      <div class="compare__before">${pic(before, alts[0], { sizes: "(min-width: 900px) 40vw, 92vw", cls: "compare__img" })}</div>
      <span class="compare__tag compare__tag--b">${esc(t.before)}</span><span class="compare__tag compare__tag--a">${esc(t.after)}</span>
      <span class="compare__handle" aria-hidden="true"></span>
      <input type="range" min="0" max="100" value="50" aria-label="${esc(t.compareLabel)} : ${esc(label)}">
    </div>
    <figcaption><span>${esc(label)}</span><span>${esc(t.compare)}</span></figcaption>
  </figure>`;
}

function decor(lang, n, full = false) {
  const t = L[lang].decor;
  const m = L[lang].media;
  const imgs = ["decoration/coin-maries-oriental", "decoration/coin-maries-tente", "decoration/coin-photo-arches-fleurs", "decoration/coin-photo-arche-prenom", "produits/coin-maries-led", "produits/arche-coeur", "decoration/serviette-bordeaux", "realisations/table-rose-poudre-detail"];
  const shown = full ? imgs.length : 5;
  return `<section class="section section--light decor" id="decoration" aria-labelledby="decor-title">
  <div class="wrap">
    ${full ? "" : `<div class="section__head section__head--split reveal">
      <div>${kicker(n, t.kicker)}<h2 id="decor-title" class="h2">${esc(t.title)}</h2></div>
      <p class="lead">${esc(t.intro)}</p>
    </div>`}
    ${full ? `<h2 id="decor-title" class="sr">${esc(t.title)}</h2>` : ""}
    <div class="compare__row">
      ${beforeAfter(lang, "decoration/salle-avant", "decoration/salle-apres", t.pairs[0], m.pairs[0], 0)}
      <div class="decor__list reveal" style="--d:1">
        <p class="eyebrow">${esc(t.listTitle)}</p>
        <ul>${t.list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="decor__note"><span class="script">${esc(t.note)}</span></p>
      </div>
    </div>
    <div class="mosaic${full ? " mosaic--full" : ""}">
      ${imgs.slice(0, shown).map((k, i) => `<figure class="mosaic__item reveal" style="--d:${i % 3}">
        ${pic(k, m.decor[i], { sizes: "(min-width: 900px) 33vw, 50vw" })}
        <figcaption>${esc(t.items[i])}</figcaption>
      </figure>`).join("")}
    </div>
    <p class="center reveal"><a class="btn btn--dark" href="${full ? "#contact" : href(lang, "decoration")}">${esc(full ? t.cta : L[lang].services.items[1].link)}</a></p>
  </div>
</section>`;
}

function catering(lang, n, full = false) {
  const t = L[lang].catering;
  const m = L[lang].media.catering;
  return `<section class="section section--dark catering" id="traiteur" aria-labelledby="catering-title">
  <div class="wrap">
    <div class="catering__intro">
      <div class="catering__media reveal">${pic("traiteur/buffet-affiche", m[0], { sizes: "(min-width: 900px) 45vw, 92vw" })}</div>
      <div class="catering__text reveal">
        ${full ? "" : kicker(n, t.kicker)}
        <h2 id="catering-title" class="h2">${esc(t.title)}</h2>
        <p class="lead">${esc(t.intro)}</p>
        <ul class="badges"><li>${esc(t.halal)}</li><li>${esc(t.noAlcohol)}</li></ul>
        <p class="muted">${esc(t.menu)}</p>
        <a class="btn btn--gold" href="#contact" data-service="2">${esc(t.cta)}</a>
      </div>
    </div>
    <div class="pancake" id="animations">
      <div class="pancake__text reveal">
        <p class="pancake__badge">${esc(t.pancakeBadge)}</p>
        <h3 class="h3">${esc(t.pancakeTitle)}</h3>
        <p>${esc(t.pancakeText)}</p>
        <hr class="rule">
        <h3 class="h4">${esc(t.sweetsTitle)}</h3>
        <p>${esc(t.sweetsText)}</p>
      </div>
      <div class="pancake__media reveal">${pic("traiteur/bar-a-pancakes", m[1], { sizes: "(min-width: 900px) 50vw, 92vw" })}</div>
      <div class="pancake__side reveal">${pic("produits/bar-gourmandises", t.sweetsTitle, { sizes: "(min-width: 900px) 22vw, 60vw" })}</div>
    </div>
  </div>
</section>`;
}

function backstage(lang, n) {
  const t = L[lang].backstage;
  const m = L[lang].media.backstage;
  const imgs = ["coulisses/piles-assiettes", "coulisses/chaises-chargement", "coulisses/mise-en-place", "coulisses/detail-table"];
  const alts = [m[0], m[2], m[3], m[4]];
  return `<section class="section section--black backstage" aria-labelledby="backstage-title">
  <div class="wrap backstage__grid">
    <div class="backstage__text reveal">
      ${kicker(n, t.kicker)}
      <h2 id="backstage-title" class="backstage__title"><span>${esc(t.seen)}</span><em>${esc(t.unseen)}</em></h2>
      <p class="lead">${esc(t.text)}</p>
      <ol class="backstage__steps">${t.steps.map((s, i) => `<li><span>0${i + 1}</span>${esc(s)}</li>`).join("")}</ol>
    </div>
    <div class="backstage__video reveal">${video("coulisses", t.video)}<button class="backstage__toggle" type="button" aria-pressed="false" aria-label="${esc(t.pause)}" data-pause="${esc(t.pause)}" data-play="${esc(t.play)}" data-video-toggle><svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/></svg><svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg></button></div>
    <div class="backstage__strip">${imgs.map((k, i) => `<figure class="reveal" style="--d:${i}">${pic(k, alts[i], { sizes: "(min-width: 900px) 15vw, 45vw" })}</figure>`).join("")}</div>
  </div>
</section>`;
}

function work(lang, n, full = false) {
  const t = L[lang].work;
  const items = full ? GALLERY : GALLERY.slice(0, 9);
  const cats = Object.keys(t.filters).filter((c) => c === "all" || items.some(([, cat]) => cat === c));
  return `<section class="section section--ivory work" id="realisations" aria-labelledby="work-title">
  <div class="wrap">
    ${full ? `<h2 id="work-title" class="sr">${esc(t.title)}</h2>` : `<div class="section__head section__head--split reveal">
      <div>${kicker(n, t.kicker)}<h2 id="work-title" class="h2">${esc(t.title)}</h2></div>
      <p class="lead">${esc(t.intro)}</p>
    </div>`}
    <ul class="chips" data-work-filters>${cats.map((c) => `<li><button type="button" data-filter="${c}" aria-pressed="${c === "all"}">${esc(t.filters[c])}</button></li>`).join("")}</ul>
    <div class="masonry" data-gallery>
      ${items.map(([k, cat, cap], i) => `<figure class="masonry__item reveal" data-cat="${cat}">
        <button type="button" data-full="${big(k)}" data-caption="${esc(cap[lang])}" aria-label="${esc(t.open)} : ${esc(cap[lang])}">
          ${pic(k, cap[lang], { sizes: "(min-width: 1000px) 31vw, (min-width: 600px) 46vw, 92vw", ratio: true })}
        </button>
        <figcaption><span>${esc(t.filters[cat])}</span>${esc(cap[lang])}</figcaption>
      </figure>`).join("")}
    </div>
    ${full ? `<p class="center reveal"><a class="btn btn--line" href="${INSTAGRAM}" target="_blank" rel="noopener">${icon.ig}@signature_event_76</a></p>` : `<p class="center reveal"><a class="btn btn--dark" href="${href(lang, "realisations")}">${esc(t.seeAll)}</a></p>`}
  </div>
</section>`;
}

function steps(lang, n) {
  const t = L[lang].steps;
  return `<section class="section section--light steps" aria-labelledby="steps-title">
  <div class="wrap">
    <div class="section__head section__head--center reveal">${kicker(n, t.kicker)}<h2 id="steps-title" class="h2">${esc(t.title)}</h2></div>
    <ol class="steps__list">${t.items.map((s, i) => `<li class="reveal" style="--d:${i}"><span class="steps__n">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("")}</ol>
  </div>
</section>`;
}

function reviews(lang, n) {
  const t = L[lang].reviews;
  return `<section class="section section--ivory reviews" aria-labelledby="reviews-title">
  <div class="wrap">
    <div class="section__head section__head--center reveal">${kicker(n, t.kicker)}<h2 id="reviews-title" class="h2">${esc(t.title)}</h2><p class="lead">${esc(t.intro)}</p></div>
    <div class="reviews__list">
      <!-- À REMPLIR avec de vrais avis clients -->
      <!-- Modèle :
      <figure class="review"><blockquote>« Texte de l'avis »</blockquote><figcaption>Prénom · Mariage, juin 2026</figcaption></figure>
      -->
    </div>
    <p class="center reveal"><a class="btn btn--line" href="${INSTAGRAM}" target="_blank" rel="noopener">${icon.ig}${esc(t.link)}</a></p>
  </div>
</section>`;
}

function faq(lang, n) {
  const t = L[lang].faq;
  return `<section class="section section--light faq" id="faq" aria-labelledby="faq-title">
  <div class="wrap faq__grid">
    <div class="reveal">${kicker(n, t.kicker)}<h2 id="faq-title" class="h2">${esc(t.title)}</h2></div>
    <div class="faq__list">
      ${t.items.map((i) => `<details class="reveal"><summary>${esc(i.q)}<i aria-hidden="true"></i></summary><p>${esc(i.a)}</p></details>`).join("")}
    </div>
  </div>
</section>`;
}

function contact(lang, n) {
  const t = L[lang].contact;
  return `<section class="section section--dark contact" id="contact" aria-labelledby="contact-title">
  <div class="wrap contact__grid">
    <div class="contact__aside reveal">
      ${kicker(n, t.kicker)}
      <h2 id="contact-title" class="h2">${esc(t.title)}</h2>
      <p class="lead">${esc(t.intro)}</p>
      <dl class="contact__info">
        <div><dt>${esc(t.callUs)}</dt><dd><a href="tel:${PHONE_INTL}">${icon.phone}${PHONE}</a></dd></div>
        <div><dt>WhatsApp</dt><dd><a href="${waLink(L[lang].wa.default)}" target="_blank" rel="noopener">${icon.wa}${PHONE}</a></dd></div>
        <div><dt>${esc(t.follow)}</dt><dd><a href="${INSTAGRAM}" target="_blank" rel="noopener">${icon.ig}Instagram</a><a href="${TIKTOK}" target="_blank" rel="noopener">${icon.tt}TikTok</a></dd></div>
        <div><dt>Zone</dt><dd>${esc(t.zone)}</dd></div>
      </dl>
    </div>
    <form class="form contact__form reveal" data-contact-form novalidate>
      <div class="field"><label for="c-type">${esc(t.type)}</label><select id="c-type" name="type" required><option value=""></option>${t.types.map((x) => `<option>${esc(x)}</option>`).join("")}</select></div>
      <div class="field field--half"><label for="c-date">${esc(t.date)}</label><input id="c-date" name="date" type="date"></div>
      <div class="field field--half"><label for="c-guests">${esc(t.guests)}</label><input id="c-guests" name="guests" type="number" min="1" inputmode="numeric"></div>
      <div class="field"><label for="c-place">${esc(t.place)}</label><input id="c-place" name="place" autocomplete="address-level2"></div>
      <fieldset class="field"><legend>${esc(t.services)}</legend><div class="checks">${t.serviceOptions.map((s, i) => `<label><input type="checkbox" name="services" value="${esc(s)}" data-service-box="${i}"><span>${esc(s)}</span></label>`).join("")}</div></fieldset>
      <div class="field"><label for="c-message">${esc(t.message)}</label><textarea id="c-message" name="message" rows="4" placeholder="${esc(t.messagePh)}"></textarea></div>
      <div class="field field--half"><label for="c-name">${esc(t.name)}</label><input id="c-name" name="name" autocomplete="name" required></div>
      <div class="field field--half"><label for="c-phone">${esc(t.phone)}</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" required></div>
      <button class="btn btn--gold btn--block" type="submit">${icon.wa}${esc(t.send)}</button>
    </form>
  </div>
</section>`;
}

function pageHead(lang, page, n) {
  const t = L[lang];
  const map = { location: t.catalogue, decoration: t.decor, traiteur: t.catering, realisations: t.work };
  const s = map[page];
  return `<section class="pagehead">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/${lang}/">${esc(t.nav.home)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(s.kicker)}</span></nav>
    ${kicker(n, s.kicker)}
    <h1 class="h1">${esc(s.pageTitle)}</h1>
    <p class="lead">${esc(s.pageIntro)}</p>
  </div>
</section>`;
}

function cart(lang) {
  const t = L[lang].cart;
  const data = Object.fromEntries(CAT.products.filter((p) => p.price != null).map((p) => [p.id, {
    name: p.name[lang], price: p.price, unit: p.unit, unitLabel: L[lang].catalogue.units[p.unit], img: `/media/produits/${p.id}-480.webp`,
  }]));
  const cfg = {
    lang, wa: CAT.settings.whatsapp, form: FORM_ENDPOINT, stripe: CAT.settings.stripeEnabled, t,
    qtyUnits: L[lang].catalogue.qtyUnits, addedLabel: L[lang].catalogue.added, less: L[lang].catalogue.less, more: L[lang].catalogue.more,
    contact: { intro: L[lang].contact.waIntro, labels: L[lang].contact.waLabels },
  };
  return `<div class="drawer" id="cart" data-cart hidden>
  <div class="drawer__scrim" data-cart-close></div>
  <aside class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">
    <div class="drawer__head"><h2 id="cart-title" class="h3">${esc(t.title)}</h2><button class="iconbtn" type="button" data-cart-close aria-label="${esc(L[lang].nav.close)}">${icon.close}</button></div>
    <div class="drawer__body">
      <div class="cart__empty" data-cart-empty><p>${esc(t.empty)}</p><a class="btn btn--line" href="${href(lang, "location")}">${esc(t.browse)}</a></div>
      <ul class="cart__list" data-cart-list></ul>
      <div class="cart__total" data-cart-filled hidden><p><span>${esc(t.total)}</span><strong data-cart-total></strong></p><small>${esc(t.totalNote)}</small></div>
      <form class="form cart__form" data-cart-form data-cart-filled hidden novalidate>
        <p class="eyebrow">${esc(t.event)}</p>
        <div class="field field--half"><label for="k-date">${esc(t.date)}</label><input id="k-date" name="date" type="date" required></div>
        <div class="field field--half"><label for="k-place">${esc(t.place)}</label><input id="k-place" name="place" required></div>
        <fieldset class="field"><legend>${esc(t.mode)}</legend><div class="checks checks--radio">
          <label><input type="radio" name="mode" value="${esc(t.delivery)}" checked><span>${esc(t.delivery)}</span></label>
          <label><input type="radio" name="mode" value="${esc(t.pickup)}"><span>${esc(t.pickup)}</span></label>
        </div></fieldset>
        <div class="field field--half"><label for="k-name">${esc(t.name)}</label><input id="k-name" name="name" autocomplete="name" required></div>
        <div class="field field--half"><label for="k-phone">${esc(t.phone)}</label><input id="k-phone" name="phone" type="tel" autocomplete="tel" required></div>
        <div class="field"><label for="k-notes">${esc(t.notes)}</label><textarea id="k-notes" name="notes" rows="2"></textarea></div>
        <button class="btn btn--gold btn--block" type="submit" data-send="wa">${icon.wa}<span>${esc(t.sendWa)} <small>${esc(t.sendWaSub)}</small></span></button>
        ${FORM_ENDPOINT ? `<button class="btn btn--line btn--block" type="submit" data-send="mail">${esc(t.sendMail)}</button>` : ""}
        ${CAT.settings.stripeEnabled ? `<button class="btn btn--line btn--block" type="submit" data-send="pay">${esc(t.pay)}</button>` : ""}
        <p class="form__status" data-cart-status role="status"></p>
      </form>
    </div>
  </aside>
</div>
<script type="application/json" id="se-data">${JSON.stringify({ products: data, cfg }).replace(/</g, "\\u003c")}</script>`;
}

function lightbox(lang) {
  const t = L[lang].work;
  return `<div class="lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-label="${esc(t.kicker)}">
  <button class="lightbox__close iconbtn" type="button" data-lb-close aria-label="${esc(t.close)}">${icon.close}</button>
  <button class="lightbox__nav lightbox__nav--prev iconbtn" type="button" data-lb-prev aria-label="${esc(t.prev)}">${icon.prev}</button>
  <figure><img alt="" data-lb-img><figcaption data-lb-cap></figcaption></figure>
  <button class="lightbox__nav lightbox__nav--next iconbtn" type="button" data-lb-next aria-label="${esc(t.next)}">${icon.next}</button>
</div>`;
}

function footer(lang) {
  const t = L[lang];
  const f = t.footer;
  const links = [["location", t.nav.rental], ["decoration", t.nav.decor], ["traiteur", t.nav.catering], ["realisations", t.nav.work]];
  return `<footer class="footer">
  <div class="wrap">
    <div class="footer__top">
      <div class="footer__brand">
        <img src="/media/logo/logo-or.webp" width="520" height="385" alt="Signature Event" loading="lazy">
        <p class="footer__sig">${esc(f.signature)}</p>
      </div>
      <p class="footer__slogan"><span class="script">${esc(f.slogan)}</span></p>
    </div>
    <hr class="rule">
    <div class="footer__cols">
      <div><p class="eyebrow">${esc(f.explore)}</p><ul>${links.map(([p, l]) => `<li><a href="${href(lang, p)}">${esc(l)}</a></li>`).join("")}<li><a href="${href(lang, "home", "#faq")}">FAQ</a></li></ul></div>
      <div><p class="eyebrow">${esc(f.contact)}</p><ul>
        <li><a href="tel:${PHONE_INTL}">${PHONE}</a></li>
        <li><a href="${waLink(t.wa.default)}" target="_blank" rel="noopener">WhatsApp</a></li>
        <li><a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram</a></li>
        <li><a href="${TIKTOK}" target="_blank" rel="noopener">TikTok</a></li>
      </ul></div>
      <div><p class="eyebrow">Zone</p><p>${esc(f.zone)}</p><p class="footer__events">${esc(f.events)}</p></div>
    </div>
    <div class="footer__bottom">
      <p>© ${new Date().getFullYear()} Signature Event. ${esc(f.rights)}</p>
      <a href="${href(lang, "legal")}">${esc(f.legal)}</a>
    </div>
  </div>
</footer>
<a class="wafloat" href="${waLink(t.wa.default)}" target="_blank" rel="noopener" aria-label="${esc(t.wa.float)}">${icon.wa}</a>
<div class="toast" data-toast role="status" aria-live="polite"></div>
<script type="module" src="/src/main.js"></script>
</body>
</html>`;
}

function legal(lang) {
  const t = L[lang].legal;
  return `<section class="pagehead pagehead--short"><div class="wrap"><h1 class="h1">${esc(t.title)}</h1></div></section>
<section class="section section--light legal"><div class="wrap prose">
  <h2 class="h4">${esc(t.editorTitle)}</h2><p>${esc(t.editor)}</p>
  <h2 class="h4">${esc(t.hostTitle)}</h2><p>${esc(t.host)}</p>
  <h2 class="h4">${esc(t.dataTitle)}</h2><p>${esc(t.data)}</p>
  <h2 class="h4">${esc(t.photosTitle)}</h2><p>${esc(t.photos)}</p>
  <p><a class="link" href="/${lang}/">${esc(t.back)}${icon.arrow}</a></p>
</div></section>`;
}

/* ------------------------------------------------------------------ pages */

const num = (i) => String(i).padStart(2, "0");
function body(lang, page) {
  switch (page) {
    case "home":
      return intro(lang) + hero(lang) + trust(lang) + services(lang, "01") + cataloguePreview(lang, "02") + decor(lang, "03") + catering(lang, "04")
        + backstage(lang, "05") + work(lang, "06") + steps(lang, "07") + reviews(lang, "08") + faq(lang, "09") + contact(lang, "10");
    case "location":
      return pageHead(lang, page, "01") + catalogueFull(lang) + steps(lang, "02") + contact(lang, "03");
    case "decoration":
      return pageHead(lang, page, "01") + decor(lang, "", true) + backstage(lang, "02") + contact(lang, "03");
    case "traiteur":
      return pageHead(lang, page, "01") + catering(lang, "", true) + steps(lang, "02") + contact(lang, "03");
    case "realisations":
      return pageHead(lang, page, "01") + work(lang, "", true) + contact(lang, "02");
    case "legal":
      return legal(lang);
  }
}

const pages = [];
for (const lang of LANGS) {
  await rm(path.join(ROOT, lang), { recursive: true, force: true });
  for (const page of Object.keys(PAGES)) {
    const dir = path.join(ROOT, lang, PAGES[page][lang]);
    await mkdir(dir, { recursive: true });
    const html = `${head(lang, page)}
<body class="page-${page}">
${header(lang, page)}
<main id="main">
${body(lang, page)}
</main>
${cart(lang)}
${page === "home" || page === "realisations" ? lightbox(lang) : ""}
${footer(lang)}`;
    await writeFile(path.join(dir, "index.html"), html);
    pages.push(href(lang, page));
  }
}

// Racine : redirige vers la langue mémorisée, sinon celle du navigateur (français par défaut).
await writeFile(path.join(ROOT, "index.html"), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(L.fr.meta.home.title)}</title>
<meta name="description" content="${esc(L.fr.meta.home.description)}">
<link rel="canonical" href="${SITE}/fr/">
${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${SITE}/fr/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0E0E0E">
<script>
  var l = "fr";
  try { l = localStorage.getItem("se-lang") || ((navigator.language || "fr").slice(0, 2) === "fr" ? "fr" : "en"); } catch (e) {}
  location.replace("/" + (l === "en" ? "en" : "fr") + "/" + location.hash);
</script>
<style>body{background:#0E0E0E;color:#F7F4EE;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#E2C88E}</style>
</head>
<body><p><a href="/fr/">Français</a> · <a href="/en/">English</a></p></body>
</html>
`);

const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(ROOT, "public", "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.keys(PAGES).flatMap((page) => LANGS.map((lang) => `<url><loc>${SITE}${href(lang, page)}</loc><lastmod>${today}</lastmod>${LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${href(l, page)}"/>`).join("")}</url>`)).join("\n")}
</urlset>
`);
await writeFile(path.join(ROOT, "public", "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

const fr = L.fr;
await writeFile(path.join(ROOT, "public", "llms.txt"), `# Signature Event

> ${fr.intro.tagline} Location de matériel de réception, décoration de salle et traiteur halal sans alcool à Rouen et dans toute la Normandie, avec installation et désinstallation clé en main.

Signature Event (Instagram @signature_event_76) équipe et décore mariages, fiançailles, baptêmes, anniversaires, gender reveal, baby showers, mariages à la maison et événements professionnels. Un seul prestataire pour la location, la décoration et le traiteur.

## Location (prix publics)
${CAT.categories.map((c) => `### ${c.name.fr}\n${CAT.products.filter((p) => p.category === c.id).map((p) => `- ${p.name.fr}${p.dims ? ` (${p.dims})` : ""} : ${p.price == null ? "sur demande" : `${p.from ? "à partir de " : ""}${price(p.price, "fr")} ${fr.catalogue.units[p.unit]}`}`).join("\n")}`).join("\n")}
- Nettoyage de la vaisselle : ${CAT.settings.cleaning.clean} € si rendue propre, ${CAT.settings.cleaning.dirty} € si rendue sale.

## Services
- Décoration : coin mariés à LED, arches fleuries et de ballons, coin photo, tables dressées.
- Traiteur halal et sans alcool, menus sur devis.
- Animations gourmandes : bar à pancakes, bar à gourmandises.

## Contact
- Téléphone et WhatsApp : ${PHONE} (${PHONE_INTL})
- WhatsApp : ${WA}
- Instagram : ${INSTAGRAM}
- TikTok : ${TIKTOK}

## Pages
${pages.map((p) => `- ${SITE}${p}`).join("\n")}
`);

console.log(`${pages.length} pages générées.`);
