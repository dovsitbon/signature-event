/**
 * Comportements du site : intro, défilement fluide, menu, langue, apparitions au défilement, vidéos,
 * catalogue (filtres, quantités), « Ma sélection » (localStorage → WhatsApp / email / Stripe plus tard),
 * formulaire de devis, avant/après, galerie et visionneuse.
 */
import Lenis from "lenis";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;
root.classList.add("js");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const { products: PRODUCTS, cfg: CFG } = JSON.parse($("#se-data").textContent);
const T = CFG.t;
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const money = (n) => {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return CFG.lang === "fr" ? `${s.replace(".", ",")} €` : `€${s}`;
};
const niceDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v)
  ? new Date(`${v}T12:00`).toLocaleDateString(CFG.lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  : v);
const SEP = CFG.lang === "fr" ? " : " : ": "; // espace avant les deux-points en français seulement
const waUrl = (text) => `https://wa.me/${CFG.wa}?text=${encodeURIComponent(text)}`;

/* ---------- intro (une fois par session) ---------- */
const intro = $("[data-intro]");
if (intro && root.classList.contains("intro-on")) {
  let done = false;
  const open = () => {
    if (done) return;
    done = true;
    try { sessionStorage.setItem("se-intro", "1"); } catch {}
    intro.classList.add("is-opening");
    setTimeout(() => { root.classList.remove("intro-on"); intro.remove(); }, 950);
  };
  setTimeout(open, 2150);
  $("[data-intro-skip]").addEventListener("click", () => {
    // Passer : on saute aussi les délais du hero.
    root.style.setProperty("--skip", "1");
    $$(".hero__content > *, .hero__media").forEach((el) => (el.style.animationDelay = "0s"));
    open();
  });
} else intro?.remove();

/* ---------- défilement fluide ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id.length > 1 && document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(target, { offset: -70 });
    history.replaceState(null, "", id);
  }));
}

/* ---------- en-tête ---------- */
const header = $("[data-header]");
const onScroll = () => header.classList.toggle("is-solid", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const burger = $("[data-menu-toggle]");
const menu = $("#menu");
function closeMenu() {
  if (!burger || burger.getAttribute("aria-expanded") !== "true") return;
  burger.setAttribute("aria-expanded", "false");
  menu.hidden = true;
  header.classList.remove("is-menu");
  lenis?.start();
}
burger?.addEventListener("click", () => {
  const open = burger.getAttribute("aria-expanded") !== "true";
  if (!open) return closeMenu();
  burger.setAttribute("aria-expanded", "true");
  menu.hidden = false;
  header.classList.add("is-solid", "is-menu");
  lenis?.stop();
});
$$("#menu a").forEach((a) => a.addEventListener("click", closeMenu));

// Langue choisie mémorisée (la racine / redirige ensuite vers elle).
store.set("se-lang", CFG.lang);
$$("[data-lang]").forEach((a) => a.addEventListener("click", () => store.set("se-lang", a.dataset.lang)));

/* ---------- apparitions au défilement ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
}), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
$$(".reveal").forEach((el) => io.observe(el));

/* ---------- vidéos : lecture seulement à l'écran ---------- */
const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting && getComputedStyle(v).display !== "none" && !v.dataset.userPaused) {
    if (v.preload === "none") { v.preload = "auto"; v.load(); }
    v.play().catch(() => {});
  } else v.pause();
}), { threshold: 0.15 });
if (!reduced) $$("video[data-autoplay]").forEach((v) => vio.observe(v));

// Bouton pause de la vidéo des coulisses (boucle de plus de 5 s).
$$("[data-video-toggle]").forEach((b) => b.addEventListener("click", () => {
  const v = b.parentElement.querySelector("video");
  const paused = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", String(paused));
  b.setAttribute("aria-label", paused ? b.dataset.play : b.dataset.pause);
  if (paused) { v.dataset.userPaused = "1"; v.pause(); } else { delete v.dataset.userPaused; v.play().catch(() => {}); }
}));

/* ---------- toast ---------- */
const toastEl = $("[data-toast]");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
}

/* ---------- quantités ---------- */
const clampQty = (n) => Math.max(1, Math.min(999, Math.floor(Number(n)) || 1));
document.addEventListener("click", (e) => {
  const step = e.target.closest("[data-step]");
  if (!step) return;
  const input = step.parentElement.querySelector("input");
  input.value = clampQty(Number(input.value) + Number(step.dataset.step));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

/* ---------- catalogue : filtres ---------- */
const grid = $("[data-grid]");
if (grid) {
  const buttons = $$("[data-filters] button");
  const apply = (cat) => {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === cat)));
    $$(".product", grid).forEach((p) => {
      const show = cat === "all" || p.dataset.cat === cat;
      p.classList.toggle("is-hidden", !show);
      if (show) p.classList.add("is-in");
    });
    const url = new URL(location.href);
    cat === "all" ? url.searchParams.delete("cat") : url.searchParams.set("cat", cat);
    history.replaceState(null, "", url);
  };
  buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.filter)));
  const initial = new URLSearchParams(location.search).get("cat");
  if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial);
  // Lien direct vers une fiche (#chaise-napoleon-crystal) : on la met en évidence.
  const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (target?.classList.contains("product")) {
    target.classList.add("is-target", "is-in");
    setTimeout(() => lenis ? lenis.scrollTo(target, { offset: -100, immediate: true }) : target.scrollIntoView(), 60);
  }
}

/* ---------- Ma sélection ---------- */
let cart = store.get("se-selection", {});
for (const id of Object.keys(cart)) if (!PRODUCTS[id]) delete cart[id];
const drawer = $("[data-cart]");
const panel = $(".drawer__panel", drawer);
const list = $("[data-cart-list]");
const countEl = $("[data-cart-count]");
const cartForm = $("[data-cart-form]");
const statusEl = $("[data-cart-status]");
let lastFocus = null;

const qtyLabel = (p, q) => (CFG.qtyUnits[p.unit] ? `${q} ${CFG.qtyUnits[p.unit]}` : `× ${q}`);
const total = () => Object.entries(cart).reduce((s, [id, q]) => s + PRODUCTS[id].price * q, 0);

function renderCart() {
  const ids = Object.keys(cart);
  countEl.hidden = !ids.length;
  countEl.textContent = ids.length; // nombre d'articles différents, pas de pièces
  $("[data-cart-empty]").hidden = !!ids.length;
  $$("[data-cart-filled]").forEach((el) => (el.hidden = !ids.length));
  list.innerHTML = ids.map((id) => {
    const p = PRODUCTS[id];
    return `<li data-id="${id}">
      <img src="${p.img}" alt="" width="64" height="64" loading="lazy">
      <div><h3>${p.name}</h3><p>${money(p.price)} ${p.unitLabel}</p>
        <div class="qty"><button type="button" data-step="-1" aria-label="${CFG.less}">−</button><input type="number" min="1" max="999" value="${cart[id]}" aria-label="${p.name}" data-cart-qty><button type="button" data-step="1" aria-label="${CFG.more}">+</button></div>
      </div>
      <div class="cart__line"><strong>${money(p.price * cart[id])}</strong><button type="button" data-remove>${T.remove}</button></div>
    </li>`;
  }).join("");
  $("[data-cart-total]").textContent = money(total());
  store.set("se-selection", cart);
}

list.addEventListener("change", (e) => {
  if (!e.target.matches("[data-cart-qty]")) return;
  const id = e.target.closest("li").dataset.id;
  cart[id] = clampQty(e.target.value);
  renderCart();
  $(`li[data-id="${id}"] [data-cart-qty]`, list)?.focus();
});
list.addEventListener("click", (e) => {
  if (!e.target.matches("[data-remove]")) return;
  delete cart[e.target.closest("li").dataset.id];
  renderCart();
});

function openCart() {
  lastFocus = document.activeElement;
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("is-open"));
  lenis?.stop();
  panel.focus();
}
function closeCart() {
  drawer.classList.remove("is-open");
  lenis?.start();
  setTimeout(() => { drawer.hidden = true; lastFocus?.focus(); }, 500);
}
$$("[data-cart-open]").forEach((b) => b.addEventListener("click", openCart));
$$("[data-cart-close]", drawer).forEach((b) => b.addEventListener("click", closeCart));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !drawer.hidden) closeCart();
  if (e.key === "Tab" && !drawer.hidden) trapFocus(e, panel);
});

function trapFocus(e, box) {
  const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((el) => el.offsetParent);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (!add) return;
  const id = add.dataset.add;
  const q = clampQty($("input", add.closest(".product__actions")).value);
  cart[id] = PRODUCTS[id].unit === "guest" ? q : (cart[id] || 0) + q;
  renderCart();
  countEl.classList.remove("bump");
  void countEl.offsetWidth;
  countEl.classList.add("bump");
  add.classList.add("is-added");
  const label = $("span", add);
  label.textContent = CFG.addedLabel;
  setTimeout(() => { add.classList.remove("is-added"); label.textContent = add.dataset.label; }, 1600);
  toast(fill(T.added, { name: PRODUCTS[id].name }));
});
$$("[data-add]").forEach((b) => (b.dataset.label = $("span", b).textContent));

// Les champs du formulaire de sélection sont gardés en mémoire (pas besoin de les ressaisir).
const saved = store.get("se-event", {});
for (const [k, v] of Object.entries(saved)) {
  const el = cartForm.elements[k];
  if (!el) continue;
  if (el instanceof RadioNodeList) $$(`[name="${k}"]`, cartForm).forEach((r) => (r.checked = r.value === v));
  else el.value = v;
}
cartForm.addEventListener("input", () => store.set("se-event", Object.fromEntries(new FormData(cartForm))));

document.addEventListener("input", (e) => { if (e.target.getAttribute?.("aria-invalid") === "true" && e.target.value.trim()) e.target.setAttribute("aria-invalid", "false"); });
function validate(form) {
  let first = null;
  $$("[required]", form).forEach((el) => {
    const bad = !el.value.trim();
    el.setAttribute("aria-invalid", String(bad));
    if (bad && !first) first = el;
  });
  first?.focus();
  return !first;
}

function cartMessage(data) {
  const lines = Object.entries(cart).map(([id, q]) => {
    const p = PRODUCTS[id];
    return `• ${p.name}${SEP}${qtyLabel(p, q)} (${money(p.price)} ${p.unitLabel}) = ${money(p.price * q)}`;
  });
  const L = T.waLabels;
  return [
    T.waIntro, "", ...lines, "", `${T.waTotal}${SEP}${money(total())}`, "",
    `${L.date}${SEP}${niceDate(data.date)}`, `${L.place}${SEP}${data.place}`, `${L.mode}${SEP}${data.mode}`,
    `${L.name}${SEP}${data.name}`, `${L.phone}${SEP}${data.phone}`, data.notes ? `${L.notes}${SEP}${data.notes}` : "",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
}

cartForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!Object.keys(cart).length || !validate(cartForm)) return;
  const data = Object.fromEntries(new FormData(cartForm));
  const mode = e.submitter?.dataset.send || "wa";
  const text = cartMessage(data);

  if (mode === "wa") {
    window.open(waUrl(text), "_blank", "noopener");
    return;
  }
  statusEl.textContent = T.sending;
  try {
    if (mode === "mail") {
      // Formspree (ou équivalent) : FORM_ENDPOINT défini au build.
      const r = await fetch(CFG.form, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ...data, _subject: "Signature Event — demande de réservation", message: text }) });
      if (!r.ok) throw new Error(r.status);
      statusEl.textContent = T.sent;
    } else if (mode === "pay") {
      // Acompte Stripe (désactivé tant que stripeEnabled vaut false dans data/catalogue.json).
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: CFG.lang, items: cart, ...data }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error);
      location.href = j.url;
    }
  } catch {
    statusEl.textContent = T.error;
  }
});
renderCart();

/* ---------- formulaire de devis (WhatsApp) ---------- */
const contactForm = $("[data-contact-form]");
if (contactForm) {
  $$("[data-service]").forEach((a) => a.addEventListener("click", () => {
    const box = $(`[data-service-box="${a.dataset.service}"]`, contactForm);
    if (box) box.checked = true;
  }));
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(contactForm)) return;
    const f = new FormData(contactForm);
    const labels = CFG.contact;
    const get = (k) => (k === "date" ? niceDate(f.get(k)) : f.getAll(k).filter(Boolean).join(", "));
    const lines = [labels.intro, ""];
    for (const k of ["type", "date", "place", "guests", "services", "name", "phone", "message"]) {
      const v = get(k);
      if (v) lines.push(`${labels.labels[k]}${SEP}${v}`);
    }
    window.open(waUrl(lines.join("\n")), "_blank", "noopener");
  });
}

/* ---------- avant / après ---------- */
$$("[data-compare]").forEach((frame) => {
  const input = $("input", frame);
  const set = () => frame.style.setProperty("--pos", `${input.value}%`);
  input.addEventListener("input", set);
  set();
});

/* ---------- réalisations : filtres et visionneuse ---------- */
const gallery = $("[data-gallery]");
if (gallery) {
  const chips = $$("[data-work-filters] button");
  chips.forEach((c) => c.addEventListener("click", () => {
    chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    $$(".masonry__item", gallery).forEach((it) => {
      const show = c.dataset.filter === "all" || it.dataset.cat === c.dataset.filter;
      it.classList.toggle("is-hidden", !show);
      if (show) it.classList.add("is-in");
    });
  }));

  const lb = $("[data-lightbox]");
  const img = $("[data-lb-img]", lb);
  const cap = $("[data-lb-cap]", lb);
  let items = [], idx = 0, opener = null;
  const show = (i) => {
    idx = (i + items.length) % items.length;
    const b = items[idx];
    img.src = b.dataset.full;
    img.alt = b.dataset.caption;
    cap.textContent = b.dataset.caption;
  };
  const close = () => { lb.hidden = true; lenis?.start(); opener?.focus(); };
  gallery.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-full]");
    if (!b) return;
    items = $$(".masonry__item:not(.is-hidden) button[data-full]", gallery);
    opener = b;
    show(items.indexOf(b));
    lb.hidden = false;
    lenis?.stop();
    $("[data-lb-close]", lb).focus();
  });
  $("[data-lb-close]", lb).addEventListener("click", close);
  $("[data-lb-prev]", lb).addEventListener("click", () => show(idx - 1));
  $("[data-lb-next]", lb).addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
    if (e.key === "Tab") trapFocus(e, lb);
  });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}
