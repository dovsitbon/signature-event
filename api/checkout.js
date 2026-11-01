/**
 * Acompte en ligne (Stripe Checkout) — inactif tant que data/catalogue.json a "stripeEnabled": false.
 * Pour l'activer : passer stripeEnabled à true et définir STRIPE_SECRET_KEY dans les variables Vercel.
 * Les prix viennent toujours de data/catalogue.json (jamais du navigateur) ; on encaisse depositPercent % du total.
 */
import catalogue from "../data/catalogue.json" with { type: "json" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!catalogue.settings.stripeEnabled || !key) return res.status(503).json({ error: "disabled" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const lang = body.lang === "en" ? "en" : "fr";
  const pct = catalogue.settings.depositPercent / 100;
  const byId = Object.fromEntries(catalogue.products.filter((p) => p.price != null).map((p) => [p.id, p]));

  const params = new URLSearchParams({
    mode: "payment",
    locale: lang,
    success_url: `${origin(req)}/${lang}/?paid=1`,
    cancel_url: `${origin(req)}/${lang}/?cancelled=1`,
    "phone_number_collection[enabled]": "true",
  });
  let i = 0;
  for (const [id, qty] of Object.entries(body.items || {})) {
    const p = byId[id];
    const q = Math.floor(Number(qty));
    if (!p || !(q > 0 && q <= 1000)) continue;
    params.append(`line_items[${i}][quantity]`, String(q));
    params.append(`line_items[${i}][price_data][currency]`, "eur");
    params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(p.price * pct * 100)));
    params.append(`line_items[${i}][price_data][product_data][name]`, `${p.name[lang]} (${lang === "fr" ? "acompte" : "deposit"})`);
    i++;
  }
  if (!i) return res.status(400).json({ error: "empty" });
  for (const k of ["date", "place", "mode", "name", "phone", "notes"]) if (body[k]) params.append(`metadata[${k}]`, String(body[k]).slice(0, 480));

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await r.json();
  if (!r.ok) return res.status(502).json({ error: data.error?.message || "stripe" });
  return res.status(200).json({ url: data.url });
}

function origin(req) {
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
