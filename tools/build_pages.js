/* Builds the pages Google can read: one page per doctor, specialty and clinic, in Uzbek and Russian,
   plus sitemap.xml, the Russian hub (ru/) and the link block on the home page.
   Run from the repository root: node tools/build_pages.js
   Input: data/doctors.json and i18n.js. Output: d/, s/, k/, ru/, sitemap.xml, index.html (between the seo:nav markers). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = (process.env.SITE_URL || "https://temurbekmadaminov362-beep.github.io/shifokortop/").replace(/\/?$/, "/");

/* ---------- data ---------- */
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8") +
  ";this.SPEC=SPEC;this.SPEC_ORDER=SPEC_ORDER;this.KID_ONLY=KID_ONLY;this.DISTRICTS=DISTRICTS;this.T=T;", ctx);
const { SPEC, SPEC_ORDER, KID_ONLY, T } = ctx;
const doctors = JSON.parse(fs.readFileSync(path.join(ROOT, "data/doctors.json"), "utf8")).filter(d => d && d.id && d.name);

/* ---------- helpers ---------- */
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const LAT = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"x","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"i","ь":"","э":"e","ю":"yu","я":"ya","ў":"o","қ":"q","ғ":"g","ҳ":"h" };
const slug = s => String(s).toLowerCase().replace(/[а-яёўқғҳ]/g, c => LAT[c] || "").replace(/['ʻʼ‘’`«»"]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "klinika";
const kidSpec = d => (d.specialties || []).length > 0 && d.specialties.every(c => KID_ONLY.has(c));
const seesKids = d => d.kids === 1 || d.kids === 2 || (d.specialties || []).some(c => KID_ONLY.has(c));
const kidOnly = d => d.kids === 1 || kidSpec(d);
const DAY_RU = { Du: "Пн", Se: "Вт", Ch: "Ср", Pa: "Чт", Ju: "Пт", Sh: "Сб", Ya: "Вс" };
function hoursText(s, lang) {
  if (!s) return "";
  if (s === "24/7") return T[lang].allDay;
  return lang === "ru" ? s.replace(/\b(Du|Se|Ch|Pa|Ju|Sh|Ya)\b/g, m => DAY_RU[m]).replace(/Dam olish kuni/g, "Выходной") : s;
}
const DAY_SCHEMA = { Du: "Mo", Se: "Tu", Ch: "We", Pa: "Th", Ju: "Fr", Sh: "Sa", Ya: "Su" };
function openingHours(s) {           // "Du–Ju 09:00–17:00, Sh 09:00–12:00" -> ["Mo-Fr 09:00-17:00", "Sa 09:00-12:00"]
  if (!s) return null;
  if (s === "24/7") return ["Mo-Su 00:00-23:59"];
  const D = "(?:Du|Se|Ch|Pa|Ju|Sh|Ya)";
  const re = new RegExp("(" + D + "(?:\\s*[–-]\\s*" + D + "|(?:,\\s*" + D + ")*)?)\\s+(\\d\\d:\\d\\d)\\s*[–-]\\s*(\\d\\d:\\d\\d)", "g");
  const out = []; let m;
  while ((m = re.exec(s))) out.push(m[1].replace(/\s*[–-]\s*/, "-").replace(/\s*,\s*/g, ",").replace(/Du|Se|Ch|Pa|Ju|Sh|Ya/g, x => DAY_SCHEMA[x]) + " " + m[2] + "-" + m[3]);
  return out.length ? out : null;
}
const SCHEMA_SPEC = { endokrinolog: "Endocrine", nevrolog: "Neurologic", kardiolog: "Cardiovascular", terapevt: "PrimaryCare", pediatr: "Pediatric",
  neonatolog: "Pediatric", ginekolog: "Gynecologic", urolog: "Urologic", dermatolog: "Dermatology", lor: "Otolaryngologic", oftalmolog: "Optometric",
  ortoped: "Musculoskeletal", travmatolog: "Musculoskeletal", xirurg: "Surgical", neyroxirurg: "Surgical", angioxirurg: "Surgical", proktolog: "Surgical",
  mammolog: "Surgical", plastik: "PlasticSurgery", yuzjag: "Surgical", stomatolog: "Dentistry", infeksionist: "Infectious", gastroenterolog: "Gastroenterologic",
  gepatolog: "Gastroenterologic", gematolog: "Hematologic", psixiatr: "Psychiatric", onkolog: "Oncologic", revmatolog: "Rheumatologic",
  dietolog: "DietNutrition", rentgenolog: "Radiography", uzi: "Radiography", funkdiag: "Radiography", surdolog: "Otolaryngologic" };
const money = n => Number(n).toLocaleString("ru-RU").replace(/\u00a0|,/g, "\u202f");
const telHref = p => "tel:" + String(p).replace(/[^\d+]/g, "");
const hasCoords = d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.lat && d.lng;
const yandex = d => hasCoords(d) ? `https://yandex.uz/maps/?pt=${d.lng},${d.lat}&z=17&l=map` : "https://yandex.uz/maps/?text=" + encodeURIComponent([d.clinic, d.address, "Andijon"].filter(Boolean).join(", "));
const google = d => hasCoords(d) ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}` : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([d.clinic, d.address, "Andijon"].filter(Boolean).join(", "));

/* ---------- words used on the pages ---------- */
const W = {
  uz: {
    city: "Andijon", inCity: "Andijonda", home: "Shifokor top", siteDesc: "Andijon viloyati shifokorlari",
    specLede: n => `${T.uz.count(n)}. Telefon, manzil, qabul vaqti va bemorlar baholari.`,
    clinicLede: n => `${T.uz.count(n)}. Manzil, telefon va qabul vaqtlari.`,
    docTitle: (d, sp) => `${d.name} — ${sp}, Andijon`,
    docDesc: (d, sp, h) => `${sp} ${d.name}: ${[d.clinic, d.address].filter(Boolean).join(", ")}.${h ? " Qabul: " + h + "." : ""} Telefon, xaritada manzil va bemorlar baholari.`,
    specTitle: (lbl, n) => `${lbl} Andijonda: ${T.uz.count(n)}, telefon va manzil`,
    clinicTitle: (c, n) => `${c} — ${T.uz.count(n)}, manzil va telefon, Andijon`,
    noHours: "Hozircha ma'lumot yo'q. Bilsangiz, ilovada izoh qoldiring.",
    reviews: "Baholarni o'qish va baho qoldirish", openApp: "Shifokor top'da ochish",
    others: lbl => `Boshqa ${lbl.toLowerCase()} shifokorlar`, kidsLink: lbl => `${lbl} (bolalar uchun)`,
    specsH: "Yo'nalishlar bo'yicha shifokorlar", kidsH: "Bolalar shifokorlari", clinicsH: "Klinikalar",
    allSpecs: "Barcha yo'nalishlar", other: "Ruscha", otherLang: "Русский", rateLoading: "",
    rated: (a, n) => `${a.toFixed(1)} ★ — ${n} ta bemor baho bergan`, notRated: "Hali baho yo'q — birinchi bo'lib baho bering",
    clinicDoctors: "Klinika shifokorlari", phoneNo: T.uz.noPhoneLong, map: "Xaritada",
  },
  ru: {
    city: "Андижан", inCity: "в Андижане", home: "Shifokor top", siteDesc: "Врачи Андижанской области",
    specLede: n => `${T.ru.count(n)}. Телефоны, адреса, часы приёма и отзывы пациентов.`,
    clinicLede: n => `${T.ru.count(n)}. Адрес, телефон и часы приёма.`,
    docTitle: (d, sp) => `${d.nameRu || d.name} — ${sp}, Андижан`,
    docDesc: (d, sp, h) => `${sp} ${d.nameRu || d.name}: ${[d.clinic, d.addressRu || d.address].filter(Boolean).join(", ")}.${h ? " Приём: " + h + "." : ""} Телефон, адрес на карте и отзывы пациентов.`,
    specTitle: (lbl, n) => `${lbl} в Андижане: ${T.ru.count(n)}, телефоны и адреса`,
    clinicTitle: (c, n) => `${c} — ${T.ru.count(n)}, адрес и телефон, Андижан`,
    noHours: "Пока нет данных. Если знаете, напишите в отзывах в приложении.",
    reviews: "Читать отзывы и оставить оценку", openApp: "Открыть в Shifokor top",
    others: lbl => `Другие врачи: ${lbl.toLowerCase()}`, kidsLink: lbl => `${lbl} (для детей)`,
    specsH: "Врачи по специальностям", kidsH: "Детские врачи", clinicsH: "Клиники",
    allSpecs: "Все специальности", other: "O'zbekcha", otherLang: "O'zbekcha", rateLoading: "",
    rated: (a, n) => `${a.toFixed(1)} ★ — оценок: ${n}`, notRated: "Пока нет оценок — оцените первым",
    clinicDoctors: "Врачи клиники", phoneNo: T.ru.noPhoneLong, map: "На карте",
  },
};
const specLabel = (code, lang, kids) => { const s = SPEC[code]; if (!s) return code; return kids ? (lang === "ru" ? s[3] : s[2]) : (lang === "ru" ? s[1] : s[0]); };
const docSpecLine = (d, lang) => (d.specialties || []).map(c => specLabel(c, lang, kidOnly(d))).join(", ");
const nameOf = (d, lang) => lang === "ru" ? (d.nameRu || d.name) : d.name;
const altName = (d, lang) => lang === "ru" ? (d.nameRu ? d.name : "") : (d.nameRu || "");

/* ---------- groups ---------- */
const bySpec = new Map();   // code -> doctors
const byKidSpec = new Map(); // code -> doctors who see children
for (const d of doctors) for (const c of d.specialties || []) {
  if (!bySpec.has(c)) bySpec.set(c, []); bySpec.get(c).push(d);
  if (seesKids(d) && !KID_ONLY.has(c)) { if (!byKidSpec.has(c)) byKidSpec.set(c, []); byKidSpec.get(c).push(d); }
}
const specCodes = SPEC_ORDER.filter(c => bySpec.has(c)).concat([...bySpec.keys()].filter(c => !SPEC_ORDER.includes(c)));
const clinicSlug = new Map(); const byClinic = new Map();
for (const d of doctors) {
  if (!d.clinic) continue;
  let s = clinicSlug.get(d.clinic);
  if (!s) { s = slug(d.clinic); while ([...clinicSlug.values()].includes(s)) s += "-2"; clinicSlug.set(d.clinic, s); }
  if (!byClinic.has(d.clinic)) byClinic.set(d.clinic, []); byClinic.get(d.clinic).push(d);
}
const sortDocs = list => list.slice().sort((a, b) => (b.experience || 0) - (a.experience || 0) || a.name.localeCompare(b.name));

/* ---------- URLs (relative to the site root) ---------- */
const P = {
  doc: (id, lang) => (lang === "ru" ? "ru/" : "") + "d/" + id + "/",
  spec: (c, lang) => (lang === "ru" ? "ru/" : "") + "s/" + c + "/",
  kids: (c, lang) => (lang === "ru" ? "ru/" : "") + "s/" + c + "/bolalar/",
  clinic: (name, lang) => (lang === "ru" ? "ru/" : "") + "k/" + clinicSlug.get(name) + "/",
  hub: lang => lang === "ru" ? "ru/" : "",
};
const up = rel => "../".repeat(rel.split("/").filter(Boolean).length);   // from a page back to the site root

/* ---------- page shell ---------- */
function shell({ lang, rel, alt, title, desc, body, jsonld, ogType }) {
  const r = up(rel);
  const other = lang === "ru" ? "uz" : "ru";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | Shifokor top</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${rel}">
<link rel="alternate" hreflang="${lang}" href="${SITE}${rel}">
${alt ? `<link rel="alternate" hreflang="${other}" href="${SITE}${alt}">
<link rel="alternate" hreflang="x-default" href="${SITE}${lang === "uz" ? rel : alt}">` : ""}
<meta property="og:type" content="${ogType || "website"}">
<meta property="og:site_name" content="Shifokor top">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${rel}">
<meta property="og:image" content="${SITE}icons/icon-512.png">
<meta property="og:locale" content="${lang === "ru" ? "ru_RU" : "uz_UZ"}">
<meta name="theme-color" content="#1a5a9c">
<link rel="icon" type="image/png" href="${r}icons/favicon-64.png">
<link rel="apple-touch-icon" href="${r}icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap">
<link rel="stylesheet" href="${r}app.css">
<link rel="stylesheet" href="${r}pages.css">
<script>try{var t=localStorage.getItem("st-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="band">
  <div class="wrap head">
    <a class="brand" href="${r}${P.hub(lang)}">
      <svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="9" y="9" width="22" height="22" rx="2"/><rect x="9" y="9" width="22" height="22" rx="2" transform="rotate(45 20 20)"/></g><path class="brand-plus" d="M20 14v12M14 20h12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
      <span><span class="brand-name">Shifokor top</span><span class="brand-region">${esc(T[lang].region)}</span></span>
    </a>
    ${alt ? `<a class="btn ghost small" href="${r}${alt}" hreflang="${other}" lang="${other}">${W[lang].otherLang}</a>` : ""}
  </div>
</header>
<main class="wrap page">
${body}
</main>
<footer class="wrap foot">
  <p>${esc(T[lang].foot3)}</p>
  <p><a href="${r}${P.hub(lang)}">${esc(W[lang].home)}</a> · <a href="${r}privacy.html">${esc(T[lang].privacy)}</a></p>
</footer>
<script src="${r}config.js"></script>
<script src="${r}page.js"></script>
</body>
</html>
`;
}
const crumbs = (lang, r, items) => `<nav class="crumbs" aria-label="breadcrumb"><a href="${r}${P.hub(lang)}">Shifokor top</a>${items.map(([href, text]) => href ? ` › <a href="${r}${href}">${esc(text)}</a>` : ` › <span>${esc(text)}</span>`).join("")}</nav>`;
const crumbsLd = (lang, items) => ({ "@type": "BreadcrumbList", itemListElement: [[P.hub(lang), "Shifokor top"], ...items].map(([href, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + href })) });

function docCard(d, lang, r) {
  const h = d.hours ? `${lang === "ru" ? "Приём" : "Qabul"}: ${hoursText(d.hours, lang)}` : d.clinicHours ? `${lang === "ru" ? "Клиника" : "Klinika"}: ${hoursText(d.clinicHours, lang)}` : "";
  const facts = [d.experience ? T[lang].yearsExp(d.experience) : "", d.category ? T[lang].cat[d.category] : "", d.price ? money(d.price) + " " + T[lang].som : ""].filter(Boolean);
  return `<li class="pcard">
  <a class="pcard-name" href="${r}${P.doc(d.id, lang)}">${esc(nameOf(d, lang))}</a>
  <p class="spec">${esc(docSpecLine(d, lang))}</p>
  <p class="where">${esc([d.clinic, lang === "ru" && d.addressRu ? d.addressRu : d.address].filter(Boolean).join(" — "))}</p>
  ${h ? `<p class="hours-line">${esc(h)}</p>` : ""}
  ${d.phone ? `<p><a class="tel" href="${telHref(d.phone)}">${esc(d.phone)}</a></p>` : ""}
  ${facts.length ? `<p class="muted">${esc(facts.join(" · "))}</p>` : ""}
</li>`;
}

/* ---------- doctor page ---------- */
function doctorPage(d, lang) {
  const rel = P.doc(d.id, lang), alt = P.doc(d.id, lang === "ru" ? "uz" : "ru"), r = up(rel);
  const w = W[lang], t = T[lang];
  const sp = docSpecLine(d, lang);
  const addr = lang === "ru" && d.addressRu ? d.addressRu : d.address;
  const land = lang === "ru" && d.landmarkRu ? d.landmarkRu : d.landmark;
  const hDoc = hoursText(d.hours, lang), hClin = hoursText(d.clinicHours, lang);
  const first = (d.specialties || [])[0];
  const rows = [];
  const row = (k, v, raw) => rows.push(`<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`);
  if (d.clinic) row(t.clinic, `<a href="${r}${P.clinic(d.clinic, lang)}">${esc(d.clinic)}</a>`, true);
  if (addr) row(t.address, [addr, land ? t.landmark + ": " + land : ""].filter(Boolean).join(". "));
  row(t.hoursDoc, hDoc ? esc(hDoc) : `<span class="nodata">${esc(w.noHours)}</span>`, true);
  if (hClin) row(t.hoursClinic, hClin);
  row(t.phone, d.phone ? `<a class="tel" href="${telHref(d.phone)}">${esc(d.phone)}</a>` : `<span class="nodata">${esc(w.phoneNo)}</span>`, true);
  if (d.experience) row(t.exp, t.years(d.experience));
  const cd = [t.cat[d.category || 0], t.deg[d.degree || 0]].filter(Boolean).join(", ");
  if (cd) row(t.catdeg, cd);
  if (d.price) row(t.price, money(d.price) + " " + t.som);
  const badge = kidOnly(d) ? t.kidsOnly : d.kids === 2 ? t.kidsBoth : "";
  const others = first ? sortDocs((bySpec.get(first) || []).filter(x => x.id !== d.id)).slice(0, 8) : [];
  const app = `${r}#d-${d.id}`;
  const body = `${crumbs(lang, r, first ? [[P.spec(first, lang), specLabel(first, lang)], [null, nameOf(d, lang)]] : [[null, nameOf(d, lang)]])}
<article class="doc-page">
  <p class="spec">${(d.specialties || []).map(c => `<a href="${r}${P.spec(c, lang)}">${esc(specLabel(c, lang, kidOnly(d)))}</a>`).join(" · ")}</p>
  <h1>${esc(nameOf(d, lang))}</h1>
  ${altName(d, lang) ? `<p class="alt">${esc(altName(d, lang))}</p>` : ""}
  ${badge ? `<p class="badge">${esc(badge)}</p>` : ""}
  <p class="rating-line" id="rating" data-id="${esc(d.id)}" hidden></p>
  <dl class="info">${rows.join("")}</dl>
  <div class="maps">
    ${d.phone ? `<a class="btn primary" href="${telHref(d.phone)}">${esc(t.call)}</a>` : ""}
    <a class="btn ghost" href="${yandex(d)}" target="_blank" rel="noopener">${esc(t.yandex)}</a>
    <a class="btn ghost" href="${google(d)}" target="_blank" rel="noopener">${esc(t.google)}</a>
  </div>
  <p><a class="btn ghost" href="${app}">${esc(w.reviews)}</a></p>
  ${(d.sources || []).length ? `<p class="src">${esc(t.source)}: ${d.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.name)}</a>`).join(" · ")}${d.checked ? ` · ${esc(t.checked)} ${esc(d.checked.split("-").reverse().join("."))}` : ""}</p>` : ""}
</article>
${others.length ? `<section class="related"><h2>${esc(w.others(specLabel(first, lang)))}</h2><ul class="plist">${others.map(x => docCard(x, lang, r)).join("")}</ul>
<p><a href="${r}${P.spec(first, lang)}">${esc(lang === "ru" ? "Все врачи: " : "Barcha: ")}${esc(specLabel(first, lang))} →</a></p></section>` : ""}`;
  const oh = openingHours(d.hours || d.clinicHours);
  const ld = { "@context": "https://schema.org", "@graph": [Object.assign({
    "@type": "Physician", "@id": SITE + P.doc(d.id, "uz") + "#doctor", name: nameOf(d, lang), url: SITE + rel,
    description: sp, image: SITE + "icons/icon-512.png",
    address: { "@type": "PostalAddress", streetAddress: addr || undefined, addressLocality: lang === "ru" ? "Андижан" : "Andijon", addressRegion: t.region, addressCountry: "UZ" },
  },
  d.phone ? { telephone: d.phone } : {},
  hasCoords(d) ? { geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lng } } : {},
  oh ? { openingHours: oh } : {},
  (() => { const m = [...new Set((d.specialties || []).map(c => SCHEMA_SPEC[c]).filter(Boolean))]; return m.length ? { medicalSpecialty: m.map(x => "https://schema.org/" + x) } : {}; })(),
  d.clinic ? { parentOrganization: { "@type": "MedicalClinic", name: d.clinic } } : {},
  d.price ? { priceRange: money(d.price) + " UZS" } : {}),
  crumbsLd(lang, first ? [[P.spec(first, lang), specLabel(first, lang)], [rel, nameOf(d, lang)]] : [[rel, nameOf(d, lang)]])] };
  return { rel, html: shell({ lang, rel, alt, title: w.docTitle(d, sp), desc: w.docDesc(d, sp, hDoc || hClin), body, jsonld: ld, ogType: "profile" }), lastmod: d.checked };
}

/* ---------- specialty pages ---------- */
function listPage({ lang, rel, alt, h1, title, lede, list, crumbItems, extra }) {
  const r = up(rel);
  const body = `${crumbs(lang, r, crumbItems)}
<h1>${esc(h1)}</h1>
<p class="lede-page">${esc(lede)}</p>
<ul class="plist">${sortDocs(list).map(d => docCard(d, lang, r)).join("")}</ul>
${extra ? extra(r) : ""}`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "ItemList", name: h1, numberOfItems: list.length, itemListElement: sortDocs(list).map((d, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + P.doc(d.id, lang), name: nameOf(d, lang) })) },
    crumbsLd(lang, crumbItems.map(([h, n]) => [h || rel, n])) ] };
  return { rel, html: shell({ lang, rel, alt, title, desc: lede + " " + h1 + ".", body, jsonld: ld }), lastmod: list.map(d => d.checked).filter(Boolean).sort().pop() };
}
function specNav(lang, r, current) {
  return `<nav class="seo-nav inline"><h2>${esc(W[lang].allSpecs)}</h2><ul>${specCodes.filter(c => c !== current).map(c =>
    `<li><a href="${r}${P.spec(c, lang)}">${esc(specLabel(c, lang))}</a></li>`).join("")}</ul></nav>`;
}

/* ---------- build ---------- */
const pages = [];
for (const lang of ["uz", "ru"]) {
  const other = lang === "ru" ? "uz" : "ru";
  for (const d of doctors) pages.push(doctorPage(d, lang));
  for (const c of specCodes) {
    const list = bySpec.get(c);
    const lbl = specLabel(c, lang, KID_ONLY.has(c));
    pages.push(listPage({ lang, rel: P.spec(c, lang), alt: P.spec(c, other),
      h1: lang === "ru" ? `${lbl} ${W.ru.inCity}` : `${lbl} ${W.uz.inCity}`, title: W[lang].specTitle(lbl, list.length),
      lede: W[lang].specLede(list.length), list, crumbItems: [[null, lbl]],
      extra: r => (byKidSpec.has(c) ? `<p><a class="btn ghost" href="${r}${P.kids(c, lang)}">${esc(specLabel(c, lang, true))} →</a></p>` : "") + specNav(lang, r, c) }));
    if (byKidSpec.has(c)) {
      const kl = byKidSpec.get(c), klbl = specLabel(c, lang, true);
      pages.push(listPage({ lang, rel: P.kids(c, lang), alt: P.kids(c, other),
        h1: lang === "ru" ? `${klbl} ${W.ru.inCity}` : `${klbl} ${W.uz.inCity}`, title: W[lang].specTitle(klbl, kl.length),
        lede: W[lang].specLede(kl.length), list: kl, crumbItems: [[P.spec(c, lang), lbl], [null, klbl]], extra: r => specNav(lang, r, null) }));
    }
  }
  for (const [name, list] of byClinic) {
    const d0 = list[0];
    const r0 = up(P.clinic(name, lang));
    const addr = lang === "ru" && d0.addressRu ? d0.addressRu : d0.address;
    pages.push(listPage({ lang, rel: P.clinic(name, lang), alt: P.clinic(name, other),
      h1: name, title: W[lang].clinicTitle(name, list.length), lede: [addr, W[lang].clinicLede(list.length)].filter(Boolean).join(". "),
      list, crumbItems: [[null, name]],
      extra: r => `<div class="maps"><a class="btn ghost" href="${yandex(d0)}" target="_blank" rel="noopener">${esc(T[lang].yandex)}</a><a class="btn ghost" href="${google(d0)}" target="_blank" rel="noopener">${esc(T[lang].google)}</a></div>${specNav(lang, r, null)}` }));
  }
}

/* link block (home page in Uzbek, ru/ hub in Russian) */
function linkBlock(lang, r) {
  const kidCodes = specCodes.filter(c => byKidSpec.has(c) || KID_ONLY.has(c));
  return `<nav class="wrap seo-nav" aria-label="${esc(W[lang].specsH)}">
  <h2>${esc(W[lang].specsH)}</h2>
  <ul>${specCodes.map(c => `<li><a href="${r}${P.spec(c, lang)}">${esc(specLabel(c, lang, KID_ONLY.has(c)))}</a> <span class="n">${bySpec.get(c).length}</span></li>`).join("")}</ul>
  <h2>${esc(W[lang].kidsH)}</h2>
  <ul>${kidCodes.map(c => `<li><a href="${r}${KID_ONLY.has(c) ? P.spec(c, lang) : P.kids(c, lang)}">${esc(specLabel(c, lang, true))}</a></li>`).join("")}</ul>
  <h2>${esc(W[lang].clinicsH)}</h2>
  <ul>${[...byClinic.keys()].sort((a, b) => a.localeCompare(b)).map(n => `<li><a href="${r}${P.clinic(n, lang)}">${esc(n)}</a></li>`).join("")}</ul>
  <p><a href="${r}${lang === "ru" ? "" : "ru/"}" hreflang="${lang === "ru" ? "uz" : "ru"}">${lang === "ru" ? "O'zbek tilida" : "На русском языке"}</a></p>
</nav>`;
}
// Russian hub page
pages.push({ rel: "ru/", lastmod: undefined, html: shell({ lang: "ru", rel: "ru/", alt: "", title: "Врачи Андижана: специальности, клиники, телефоны и отзывы",
  desc: `${T.ru.count(doctors.length)} Андижанской области: поиск по специальности, детские врачи, адреса на карте, часы приёма, телефоны и оценки пациентов.`,
  body: `<h1>Врачи Андижана</h1><p class="lede-page">${esc(T.ru.count(doctors.length))}: поиск по специальности, детские врачи, адреса, часы приёма и телефоны.</p>
<p><a class="btn primary" href="../">Открыть поиск врачей</a></p>${linkBlock("ru", "../")}` }) });

/* ---------- write ---------- */
for (const dir of ["d", "s", "k", "ru"]) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
for (const p of pages) {
  const file = path.join(ROOT, p.rel, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, p.html);
}
// home page: link block between markers, so Google can follow links to every page
const idxFile = path.join(ROOT, "index.html");
let idx = fs.readFileSync(idxFile, "utf8");
idx = idx.replace(/<!-- seo:nav -->[\s\S]*?<!-- \/seo:nav -->/, `<!-- seo:nav -->\n${linkBlock("uz", "")}\n<!-- /seo:nav -->`);
fs.writeFileSync(idxFile, idx);
// sitemap
const today = new Date().toISOString().slice(0, 10);
const altOf = rel => rel.startsWith("ru/") ? rel.slice(3) : "ru/" + rel;
const urls = [{ rel: "", lastmod: today }, ...pages.map(p => ({ rel: p.rel, lastmod: p.lastmod || today }))];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(u => {
  const hasAlt = u.rel && (u.rel.startsWith("d/") || u.rel.startsWith("s/") || u.rel.startsWith("k/") || /^ru\/(d|s|k)\//.test(u.rel));
  const uzRel = u.rel.startsWith("ru/") ? altOf(u.rel) : u.rel, ruRel = u.rel.startsWith("ru/") ? u.rel : altOf(u.rel);
  return `  <url><loc>${SITE}${u.rel}</loc><lastmod>${u.lastmod}</lastmod>${hasAlt ? `
    <xhtml:link rel="alternate" hreflang="uz" href="${SITE}${uzRel}"/>
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE}${ruRel}"/>` : ""}</url>`;
}).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
// specialty names for the Telegram bot (it reads data/doctors.json and this file from the site)
fs.writeFileSync(path.join(ROOT, "data/specs.json"), JSON.stringify({ order: SPEC_ORDER, kidOnly: [...KID_ONLY], spec: SPEC }));
console.log(`pages: ${pages.length} (doctors ${doctors.length} x2, specialties ${specCodes.length}, kids ${byKidSpec.size}, clinics ${byClinic.size}), sitemap urls: ${urls.length}`);
