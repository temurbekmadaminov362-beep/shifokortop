/* Shifokor top — web app (PWA) and Telegram Mini App.
   Needs i18n.js (SPEC, SPEC_ORDER, KID_ONLY, DISTRICTS, T, ru) loaded first. */
(function(){
"use strict";

const tg = window.Telegram && window.Telegram.WebApp;
const inTG = !!(tg && tg.initData);
// embed mode: the page runs inside a shared claude.ai page (no install, no service worker, no own share link)
const EMBED = !!document.querySelector('meta[name="st-mode"][content="embed"]');
// running inside the Shifokor top Android app (it shows this same site)
const IN_APP = /ShifokorTopApp/.test(navigator.userAgent);

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs){
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "svg") el.innerHTML = v;            // trusted, static icon markup only
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()){
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const ICON = {
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  kid:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 21c.8-3 2.6-5 5-5s4.2 2 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" stroke="currentColor" stroke-width="2"/></svg>',
  tg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.6l1.4 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  up:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
};
const CYR = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"x","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"i","ь":"","э":"e","ю":"yu","я":"ya","ў":"o","қ":"q","ғ":"g","ҳ":"h"};
function norm(s){
  s = String(s || "").toLowerCase();
  s = s.replace(/[а-яёўқғҳ]/g, c => (c in CYR ? CYR[c] : c));
  s = s.replace(/['ʻʼ‘’`´]/g, "");
  s = s.replace(/sh/g, "\u0001").replace(/ch/g, "\u0002").replace(/kh/g, "x").replace(/h/g, "x").replace(/\u0001/g, "sh").replace(/\u0002/g, "ch");
  s = s.replace(/\bye/g, "e").replace(/iye/g, "ie").replace(/aye/g, "ae");
  return s.replace(/\s+/g, " ").trim();
}
function initials(name){
  const p = String(name || "").replace(/[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ\s'-]/g, "").trim().split(/\s+/);
  return ((p[0] || "")[0] || "").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase();
}
function fmtDate(iso){
  const d = new Date(iso); if (isNaN(d)) return "";
  const pad = n => String(n).padStart(2, "0");
  return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
}
let toastTimer;
function toast(msg){
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function loadPref(k, dflt){ try { return localStorage.getItem(k) || dflt; } catch (_){ return dflt; } }
function savePref(k, v){ try { localStorage.setItem(k, v); } catch (_){} }

/* ---------- state ---------- */
function initialLang(){
  const saved = loadPref("st-lang", "");
  if (saved === "uz" || saved === "ru") return saved;
  const tgLang = inTG && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code;
  const nav = tgLang || navigator.language || "";
  return /^ru/i.test(nav) ? "ru" : "uz";
}
const state = {
  lang: initialLang(), mode: "all",
  status: "loading",                      // loading | ready | error
  doctors: new Map(), ratings: new Map(), reviews: new Map(),
  config: { reviewsEnabled: false, telegramLink: "" },
  q: "", spec: "", district: "", sort: "rating",
  openId: null, shown: 30, installEvent: null,
  apiOk: false                            // false when only public/ is hosted (no server.js)
};
const t = (k, ...a) => { const v = (T[state.lang] || T.uz)[k]; return typeof v === "function" ? v(...a) : (v == null ? k : v); };
const L = () => state.lang;
const kidsView = () => state.mode === "kids";

/* ---------- light / dark theme ---------- */
// No saved choice: follow the phone or computer setting (prefers-color-scheme), or Telegram's theme.
// The button saves an explicit choice in data-theme, which app.css reads.
const darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function effectiveTheme(){
  const a = document.documentElement.getAttribute("data-theme");
  if (a === "dark" || a === "light") return a;
  return darkMQ && darkMQ.matches ? "dark" : "light";
}
function applyThemePref(){
  const p = loadPref("st-theme", "");
  if (p === "dark" || p === "light") document.documentElement.setAttribute("data-theme", p);
}
function renderThemeBtn(){
  const b = document.getElementById("themeBtn"); if (!b) return;
  const dark = effectiveTheme() === "dark";
  b.innerHTML = dark ? ICON.sun : ICON.moon;            // static icon markup
  const label = dark ? t("toLight") : t("toDark");
  b.setAttribute("aria-label", label); b.title = label;
}
function toggleTheme(){
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  savePref("st-theme", next);
  renderThemeBtn();
  if (inTG) syncTgColors();
}

/* ---------- API ---------- */
// A random id for this browser: one rating per doctor per device. Nothing personal is in it.
let memDeviceId = "";
function deviceId(){
  let id = loadPref("st-device", "") || memDeviceId;
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)){
    try { id = crypto.randomUUID(); }
    catch (_){ id = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""); }
    memDeviceId = id; savePref("st-device", id);
  }
  return id;
}
async function api(path, opts){
  const o = Object.assign({ headers: {} }, opts || {});
  if (inTG) o.headers["X-Telegram-Init-Data"] = tg.initData;
  o.headers["X-Device-Id"] = deviceId();
  if (o.body && typeof o.body !== "string"){ o.body = JSON.stringify(o.body); o.headers["Content-Type"] = "application/json"; }
  const r = await fetch(path, o);
  let data = null; try { data = await r.json(); } catch (_){}
  if (!r.ok) throw Object.assign(new Error((data && data.error) || ("http_" + r.status)), { status: r.status, code: data && data.error });
  return data;
}

/* ---------- where ratings live: our own server (server.js) or Supabase (config.js) ---------- */
const CFG = window.ST_CONFIG || {};
const SB = CFG.supabaseUrl && CFG.supabaseKey ? { url: String(CFG.supabaseUrl).replace(/\/+$/, ""), key: CFG.supabaseKey } : null;
async function sbFetch(path, opts){
  const o = Object.assign({ method: "GET" }, opts || {});
  o.headers = Object.assign({ apikey: SB.key, Authorization: "Bearer " + SB.key }, o.headers || {});
  if (o.body && typeof o.body !== "string"){ o.body = JSON.stringify(o.body); o.headers["Content-Type"] = "application/json"; }
  const r = await fetch(SB.url + path, o);
  const txt = await r.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (_){}
  if (!r.ok){
    const code = (data && (data.message || data.error)) || ("http_" + r.status);
    throw Object.assign(new Error(code), { status: code === "too_many" ? 429 : r.status, code });
  }
  return data;
}
async function sha256Hex(s){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}
const backend = SB ? {
  async config(){ return { reviewsEnabled: true, live: true, telegramLink: "" }; },
  async ratings(){
    const out = {};
    for (const r of (await sbFetch("/rest/v1/ratings?select=doctor_id,avg,n")) || []) out[r.doctor_id] = [r.avg, r.n];
    return out;
  },
  async ratingOf(id){
    const rows = await sbFetch("/rest/v1/ratings?select=avg,n&doctor_id=eq." + encodeURIComponent(id));
    return rows && rows[0] ? { avg: rows[0].avg, n: rows[0].n } : { avg: 0, n: 0 };
  },
  async reviews(id){
    const rows = await sbFetch("/rest/v1/reviews?select=id,owner_hash,stars,text,updated_at&order=updated_at.desc&limit=200&doctor_id=eq." + encodeURIComponent(id));
    let mine = ""; try { mine = await sha256Hex(id + ":" + deviceId()); } catch (_){}
    return (rows || []).map(r => ({ id: r.id, stars: r.stars, text: r.text, at: r.updated_at, verified: false, mine: !!mine && r.owner_hash === mine }));
  },
  submit(id, stars, text){ return sbFetch("/rest/v1/rpc/submit_review", { method: "POST", body: { p_doctor: id, p_stars: stars, p_text: text, p_token: deviceId() } }); },
  remove(id){ return sbFetch("/rest/v1/rpc/delete_my_review", { method: "POST", body: { p_doctor: id, p_token: deviceId() } }); },
  report(id, kind, text){ return sbFetch("/rest/v1/rpc/submit_report", { method: "POST", body: { p_doctor: id, p_kind: kind, p_text: text } }); },
} : {
  config(){ return api("api/config"); },
  ratings(){ return api("api/ratings"); },
  async ratingOf(id){ const rt = await api("api/ratings"); return rt[id] ? { avg: rt[id][0], n: rt[id][1] } : { avg: 0, n: 0 }; },
  async reviews(id){ const d = await api("api/reviews?doctor=" + encodeURIComponent(id)); return (d && d.items) || []; },
  submit(id, stars, text){ return api("api/reviews", { method: "POST", body: { doctorId: id, stars, text } }); },
  remove(id){ return api("api/reviews?doctor=" + encodeURIComponent(id), { method: "DELETE" }); },
  report(id, kind, text){ return api("api/reports", { method: "POST", body: { doctorId: id, kind, text } }); },
};

/* ---------- labels ---------- */
function specLabel(code, kids){
  const s = SPEC[code]; if (!s) return code;
  const r = L() === "ru";
  return kids ? (r ? s[3] : s[2]) : (r ? s[1] : s[0]);
}
const nameOf = d => (L() === "ru" && d.nameRu ? d.nameRu : d.name);
const altNameOf = d => (L() === "ru" ? (d.nameRu ? d.name : "") : (d.nameRu || ""));
function districtLabel(v){ const r = DISTRICTS.find(x => x[0] === v); return r ? (L() === "ru" ? r[1] : r[0]) : (v || ""); }
function fmtHours(s){
  s = s || ""; if (!s) return "";
  if (s === "24/7") return t("allDay");
  if (L() !== "ru") return s;
  const map = { Du:"Пн", Se:"Вт", Ch:"Ср", Pa:"Чт", Ju:"Пт", Sh:"Сб", Ya:"Вс" };
  return s.replace(/\b(Du|Se|Ch|Pa|Ju|Sh|Ya)\b/g, m => map[m]).replace(/Dam olish kuni/g, "Выходной");
}
function money(n){ return Number(n).toLocaleString("ru-RU").replace(/ |,/g, " ") + " " + t("som"); }
const allKidSpecs = d => (d.specialties || []).length > 0 && (d.specialties || []).every(c => KID_ONLY.has(c));
const seesKids = d => d.kids === 1 || d.kids === 2 || (d.specialties || []).some(c => KID_ONLY.has(c));
const adultsOk = d => d.kids !== 1 && !allKidSpecs(d);
const inMode = d => (state.mode === "kids" ? seesKids(d) : state.mode === "adults" ? adultsOk(d) : true);
const ratingOf = id => state.ratings.get(id) || { avg: 0, n: 0 };

function hay(d){
  if (d._hay) return d._hay;
  const words = (d.specialties || []).map(c => { const s = SPEC[c]; return s ? s.join(" ") : c; }).join(" ");
  const dl = DISTRICTS.find(x => x[0] === d.district);
  d._hay = norm([d.name, d.nameRu, words, d.clinic, d.address, d.addressRu, d.landmark, d.landmarkRu, d.district, dl ? dl[1] : ""].join(" "));
  return d._hay;
}
function filtered(){
  const tokens = norm(state.q).split(" ").filter(Boolean);
  const arr = [...state.doctors.values()].filter(d => {
    if (!inMode(d)) return false;
    if (state.spec && !(d.specialties || []).includes(state.spec)) return false;
    if (state.district && d.district !== state.district) return false;
    if (tokens.length){ const H = hay(d); return tokens.every(x => H.includes(x)); }
    return true;
  });
  const by = state.sort;
  arr.sort((a, b) => {
    if (by === "rating"){
      const ra = ratingOf(a.id), rb = ratingOf(b.id);
      if (rb.avg !== ra.avg) return rb.avg - ra.avg;
      if (rb.n !== ra.n) return rb.n - ra.n;
      return (b.experience || 0) - (a.experience || 0);
    }
    if (by === "exp") return (b.experience || 0) - (a.experience || 0);
    if (by === "price") return (a.price || Infinity) - (b.price || Infinity);
    return String(nameOf(a)).localeCompare(String(nameOf(b)), L() === "ru" ? "ru" : "uz");
  });
  return arr;
}

/* ---------- small views ---------- */
function starsEl(avg, n, compact){
  if (!n) return h("span", { class: "rating none" }, t("noRating"));
  return h("span", { class: "rating", "aria-label": avg.toFixed(1) + " / 5 (" + n + ")" },
    h("span", { class: "stars", style: "--p:" + (avg / 5 * 100).toFixed(0) + "%", "aria-hidden": "true" }, "★★★★★"),
    h("span", { class: "avg" }, avg.toFixed(1)),
    compact ? null : h("span", { class: "cnt" }, "(" + n + ")"));
}
const hasCoords = d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.lat !== 0 && d.lng !== 0;
const addrQuery = d => [d.clinic, d.address, "Andijon"].filter(Boolean).join(", ");
function mapUrl(kind, d){
  if (kind === "yandex"){
    return hasCoords(d) ? "https://yandex.uz/maps/?pt=" + d.lng + "," + d.lat + "&z=17&l=map"
                        : "https://yandex.uz/maps/?text=" + encodeURIComponent(addrQuery(d));
  }
  return hasCoords(d) ? "https://www.google.com/maps/search/?api=1&query=" + d.lat + "," + d.lng
                      : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addrQuery(d));
}
const mapPill = (kind, d, label) => h("a", { class: "pill", href: mapUrl(kind, d), target: "_blank", rel: "noopener", svg: ICON.pin }, label);
function facts(d){
  const f = [];
  if (d.experience) f.push(h("span", { class: "num" }, t("yearsExp", d.experience)));
  if (d.category) f.push(t("cat")[d.category] || "");
  if (d.degree) f.push(t("deg")[d.degree] || "");
  if (d.price) f.push(h("span", { class: "num" }, money(d.price)));
  return f.filter(Boolean);
}
function kidBadge(d){
  if (kidsView()) return null;
  if (d.kids === 1 || allKidSpecs(d)) return h("span", { class: "badge", svg: ICON.kid }, t("kidsOnly"));
  if (d.kids === 2) return h("span", { class: "badge", svg: ICON.kid }, t("kidsBoth"));
  return null;
}
function hoursLine(d){
  if (d.hours) return h("p", { class: "hours-line", svg: ICON.clock }, h("span", null, t("cardHours") + ": " + fmtHours(d.hours)));
  if (d.clinicHours) return h("p", { class: "hours-line", svg: ICON.clock }, h("span", null, t("cardClinic") + ": " + fmtHours(d.clinicHours)));
  return h("p", { class: "hours-line none", svg: ICON.clock }, h("span", null, t("noHoursShort")));
}
const telHref = p => "tel:" + String(p).replace(/[^\d+]/g, "");
// the doctor's own page (built by tools/build_pages.js), in the current language
const docPageUrl = id => (L() === "ru" ? "ru/" : "") + "d/" + encodeURIComponent(id) + "/";
function phoneLine(d){
  if (d.phone) return h("p", { class: "phone-line", svg: ICON.phone }, h("span", { class: "num" }, d.phone));
  return h("p", { class: "phone-line none", svg: ICON.phone }, h("span", null, t("noPhone")));
}
const specLine = d => (d.specialties || []).map(c => specLabel(c, kidsView())).join(" · ");

/* ---------- static text ---------- */
function renderStatic(){
  document.documentElement.lang = L() === "ru" ? "ru" : "uz";
  for (const el of document.querySelectorAll("[data-i]")) el.textContent = t(el.getAttribute("data-i"));
  for (const b of document.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === L()));
  for (const b of document.querySelectorAll("#mode button")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
  $("#mode").setAttribute("aria-label", t("modeLabel"));
  $("#chips").setAttribute("aria-label", t("chipsLabel"));
  document.body.classList.toggle("kidsmode", kidsView());
  $("#q").placeholder = t("searchPh");
  const ds = $("#district");
  ds.replaceChildren(h("option", { value: "" }, t("allRegion")), ...DISTRICTS.map(x => h("option", { value: x[0] }, L() === "ru" ? x[1] : x[0])));
  ds.value = state.district;
  const so = $("#sort");
  so.replaceChildren(...[["rating","sortRating"],["exp","sortExp"],["price","sortPrice"],["name","sortName"]].map(([v, k]) => h("option", { value: v }, t(k))));
  so.value = state.sort;
  $("#foot").replaceChildren(...[
    h("p", null, h("strong", null, t("foot1T")), " ", t("foot1")),
    h("p", null, h("strong", null, t("foot2T")), " ", t("foot2")),
    h("p", null, t("foot3")),
    EMBED || IN_APP ? null : h("p", null, h("a", { href: "download/shifokortop.apk", class: "apk-link" }, t("apkLink"))),
    h("p", null, h("a", { href: "privacy.html" }, t("privacy")))].filter(Boolean));
  renderInstall();
  renderOffline();
  renderThemeBtn();
  const tt = $("#toTop"); tt.innerHTML = ICON.up; tt.append(h("span", null, t("toTop"))); tt.setAttribute("aria-label", t("toTop"));
}
function renderOffline(){
  const el = $("#offline");
  el.hidden = navigator.onLine !== false;
  el.textContent = t("offline");
}

/* ---------- install prompt ---------- */
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
function isStandalone(){ return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
function renderInstall(){
  const box = $("#install");
  if (EMBED || inTG || isStandalone() || loadPref("st-install-dismissed", "") === "1"){ box.hidden = true; return; }
  const later = h("button", { type: "button", class: "btn ghost small", onclick: () => { savePref("st-install-dismissed", "1"); box.hidden = true; } }, t("later"));
  if (state.installEvent){
    box.replaceChildren(h("p", null, t("install")), h("div", { class: "row" },
      h("button", { type: "button", class: "btn primary small", onclick: async () => {
        const ev = state.installEvent; state.installEvent = null; box.hidden = true;
        try { ev.prompt(); await ev.userChoice; } catch (_){}
      } }, t("installBtn")), later));
    box.hidden = false;
  } else if (isIOS()){
    box.replaceChildren(h("p", null, t("iosHint")), later);
    box.hidden = false;
  } else box.hidden = true;
}

/* ---------- chips ---------- */
function renderChips(){
  const counts = new Map(); let total = 0;
  for (const d of state.doctors.values()){
    if (!inMode(d)) continue; total++;
    for (const s of (d.specialties || [])) counts.set(s, (counts.get(s) || 0) + 1);
  }
  let codes = SPEC_ORDER.filter(c => counts.get(c));
  for (const c of counts.keys()) if (!codes.includes(c)) codes.push(c);
  if (kidsView()) codes = [...codes.filter(c => KID_ONLY.has(c)), ...codes.filter(c => !KID_ONLY.has(c))];
  if (state.spec && !counts.get(state.spec)) state.spec = "";
  $("#chips").replaceChildren(
    h("button", { type: "button", class: "chip", "aria-pressed": String(!state.spec), onclick: () => setSpec("") }, t("chipAll"), h("span", { class: "n" }, total)),
    ...codes.map(c => h("button", { type: "button", class: "chip", "aria-pressed": String(state.spec === c), onclick: () => setSpec(state.spec === c ? "" : c) }, specLabel(c, kidsView()), h("span", { class: "n" }, counts.get(c) || 0))));
}
function setSpec(s){ state.spec = s; state.shown = 30; renderChips(); renderList(); }
function setMode(m){ state.mode = m; state.shown = 30; renderStatic(); renderChips(); renderList(); }
function setLang(l){ state.lang = l; savePref("st-lang", l); renderStatic(); renderChips(); renderList(); if (state.openId) openDoctor(state.openId, true); }

/* ---------- list ---------- */
function card(d){
  const r = ratingOf(d.id);
  const kidCard = kidsView() || d.kids === 1 || allKidSpecs(d);
  return h("li", { class: "card" },
    h("div", { class: "av" + (kidCard ? " kid" : ""), "aria-hidden": "true" }, initials(nameOf(d))),
    h("div", { class: "c-body" },
      h("p", { class: "spec" }, specLine(d)),
      h("h3", { class: "name" }, EMBED
        ? h("button", { type: "button", class: "name-btn", onclick: () => openDoctor(d.id) }, nameOf(d))
        : h("a", { class: "name-btn", href: docPageUrl(d.id), onclick: (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); openDoctor(d.id); } }, nameOf(d))),
      h("p", { class: "where" }, [d.clinic, L() === "ru" && d.addressRu ? d.addressRu : d.address].filter(Boolean).join(" — ")),
      kidBadge(d),
      hoursLine(d),
      phoneLine(d),
      facts(d).length ? h("ul", { class: "facts" }, facts(d).map(x => h("li", null, x))) : null,
      h("div", { class: "c-rating", "data-id": d.id }, starsEl(r.avg, r.n))),
    h("div", { class: "c-actions" },
      d.phone ? h("a", { class: "act call", href: telHref(d.phone), svg: ICON.phone }, t("callShort")) : null,
      h("a", { class: "act", href: mapUrl("yandex", d), target: "_blank", rel: "noopener", svg: ICON.pin }, "Yandex"),
      h("a", { class: "act", href: mapUrl("google", d), target: "_blank", rel: "noopener", svg: ICON.pin }, "Google")));
}
function renderList(){
  const list = $("#list"), empty = $("#empty"), status = $("#status"), more = $("#moreBtn");
  status.className = "status";
  const title = state.spec ? specLabel(state.spec, kidsView()) : (kidsView() ? t("kidsDoctors") : state.mode === "adults" ? t("adultDoctors") : t("allDoctors"));
  $("#resultsTitle").textContent = state.district ? title + " · " + districtLabel(state.district) : title;
  if (state.status === "loading"){ status.textContent = t("loading"); more.hidden = true; return; }
  if (state.status === "error"){
    list.replaceChildren(); more.hidden = true; empty.hidden = true; $("#count").textContent = "";
    status.className = "status err"; status.textContent = t("loadErrApp");
    return;
  }
  status.textContent = "";
  const items = filtered();
  $("#count").textContent = t("count", items.length);
  list.replaceChildren(...items.slice(0, state.shown).map(card));
  const rest = items.length - state.shown;
  more.hidden = rest <= 0;
  if (rest > 0) more.textContent = t("more", Math.min(rest, 30));
  if (items.length){ empty.hidden = true; return; }
  empty.hidden = false;
  empty.replaceChildren(
    h("h3", null, t("emptyT", state.spec ? specLabel(state.spec, kidsView()) : "")),
    h("p", null, t("emptyP")),
    h("button", { type: "button", class: "btn ghost", onclick: clearFilters }, t("clear")));
}
function clearFilters(){
  state.q = ""; state.spec = ""; state.district = ""; state.shown = 30;
  $("#q").value = ""; $("#district").value = "";
  renderChips(); renderList();
}

/* ---------- detail sheet ---------- */
function openDoctor(id, keepScroll){
  const d = state.doctors.get(id);
  if (!d) return;
  const first = state.openId !== id;
  state.openId = id;
  const r = ratingOf(id);
  const ruL = L() === "ru";
  const info = h("dl", { class: "info" });
  const add = (label, val, wide) => { if (val) info.append(h("div", { class: wide ? "wide" : null }, h("dt", null, label), h("dd", null, val))); };
  add(t("clinic"), d.clinic);
  add(t("district"), districtLabel(d.district));
  const addr = ruL && d.addressRu ? d.addressRu : d.address;
  const land = ruL && d.landmarkRu ? d.landmarkRu : d.landmark;
  add(t("address"), [addr, land ? t("landmark") + ": " + land : ""].filter(Boolean).join(". "), true);
  info.append(h("div", { class: "wide" }, h("dt", null, t("hoursDoc")),
    d.hours ? h("dd", null, fmtHours(d.hours)) : h("dd", { class: "nodata" }, t("noHours"))));
  add(t("hoursClinic"), fmtHours(d.clinicHours));
  add(t("price"), d.price ? money(d.price) : "");
  add(t("exp"), d.experience ? t("years", d.experience) : "");
  add(t("catdeg"), [t("cat")[d.category || 0], t("deg")[d.degree || 0]].filter(Boolean).join(", "));
  info.append(h("div", { class: "wide" }, h("dt", null, t("phone")),
    d.phone
      ? h("dd", { class: "phone" },
          h("a", { class: "tel", href: telHref(d.phone) }, d.phone),
          h("button", { type: "button", class: "btn ghost small", svg: ICON.copy, onclick: (e) => copyText(d.phone, e.currentTarget, t("copied")) }, t("copy")))
      : h("dd", { class: "nodata" }, t("noPhoneLong"))));
  const srcs = d.sources || [];
  const body = h("div", { class: "sheet-body" },
    info,
    h("div", null, h("p", { class: "section-h" }, t("onMap")),
      h("div", { class: "maps" },
        h("a", { class: "btn primary", href: mapUrl("yandex", d), target: "_blank", rel: "noopener", svg: ICON.pin }, t("yandex")),
        h("a", { class: "btn ghost", href: mapUrl("google", d), target: "_blank", rel: "noopener", svg: ICON.pin }, t("google")),
        EMBED && !inTG ? null : h("button", { type: "button", class: "btn ghost", svg: ICON.share, onclick: () => shareDoctor(d) }, t("share"))),
      hasCoords(d) ? null : h("p", { class: "hint", style: "margin-top:8px" }, t("noCoords"))),
    srcs.length ? h("p", { class: "src" }, t("source") + ": ", srcs.map(s => h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name)), d.checked ? " · " + t("checked") + " " + fmtDate(d.checked) : "") : null,
    state.apiOk
      ? h("section", { "aria-labelledby": "revH" },
          h("h3", { class: "section-h", id: "revH" }, t("reviewsH")),
          h("div", { class: "rev-summary", id: "revSummary" }),
          reviewForm(d),
          h("ul", { class: "reviews", id: "revList" }))
      : h("section", { "aria-labelledby": "revH" },          // static hosting without server.js: no reviews yet
          h("h3", { class: "section-h", id: "revH" }, t("reviewsH")),
          h("p", { class: "hint" }, t("reviewsOff"))),
    state.apiOk ? reportBlock(d) : null);
  const alt = altNameOf(d);
  $("#detailSheet").replaceChildren(
    h("div", { class: "sheet-head" },
      h("div", { class: "d-title" },
        h("p", { class: "spec" }, specLine(d)),
        h("h2", { id: "dName" }, nameOf(d)),
        alt ? h("p", { class: "alt" }, alt) : null,
        kidBadge(d),
        h("div", { class: "row", id: "headStars" }, starsEl(r.avg, r.n))),
      h("button", { type: "button", class: "x", "aria-label": t("close"), svg: ICON.close, onclick: closeDoctor })),
    body,
    h("div", { class: "sheet-actions" },
      d.phone
        ? h("a", { class: "btn primary", href: telHref(d.phone), svg: ICON.phone }, t("call"))
        : h("span", { class: "act-note", svg: ICON.phone }, h("span", null, t("noPhone"))),
      h("a", { class: "btn ghost", href: mapUrl("yandex", d), target: "_blank", rel: "noopener", svg: ICON.pin }, t("onMapBtn"))));
  refreshReviews();
  if (state.apiOk && (first || !state.reviews.has(id))) loadReviews(id);
  const dlg = $("#detail");
  if (!dlg.open) dlg.showModal();
  if (!keepScroll) body.scrollTop = 0;
  if (location.hash !== "#d-" + id){ try { history.replaceState(null, "", "#d-" + id); } catch (_){ location.hash = "d-" + id; } }
  if (inTG && tg.BackButton) tg.BackButton.show();
}
function closeDoctor(){ const dlg = $("#detail"); if (dlg.open) dlg.close(); }
// formMode "force": after the viewer's own save/delete; "idle": only if they are not in the middle of writing
async function loadReviews(id, formMode){
  const list = $("#revList");
  if (list && !state.reviews.has(id)) list.replaceChildren(h("li", { class: "hint" }, t("reviewsLoading")));
  try {
    const items = await backend.reviews(id);
    state.reviews.set(id, items);
    if (items.length){
      const avg = items.reduce((s, x) => s + x.stars, 0) / items.length;
      state.ratings.set(id, { avg, n: items.length });
    } else state.ratings.delete(id);
  } catch (e){
    if (state.openId === id && $("#revList")) $("#revList").replaceChildren(h("li", { class: "hint" }, t("reviewsErr")));
    return;
  }
  if (state.openId === id){
    refreshReviews();
    const f = $("#revForm");
    if (f && (formMode === "force" || f.dataset.dirty !== "1")) f.replaceWith(reviewForm(state.doctors.get(id)));
  }
  updateRatingEls(id);
}
function refreshReviews(){
  const id = state.openId; if (!id) return;
  const sum = $("#revSummary"), list = $("#revList");
  if (!sum || !list) return;
  const items = state.reviews.get(id);
  const r = ratingOf(id);
  sum.replaceChildren(...[
    r.n ? h("span", { class: "big" }, r.avg.toFixed(1)) : null,
    starsEl(r.avg, r.n, true),
    h("span", { class: "hint" }, r.n ? t("nRated", r.n) : t("beFirst"))].filter(Boolean));
  if (items) list.replaceChildren(...items.map(rv => h("li", { class: "review" },
    h("div", { class: "meta" },
      h("span", { class: "stars", style: "--p:" + (rv.stars * 20) + "%", "aria-label": rv.stars + " / 5" }, "★★★★★"),
      rv.mine ? h("span", { class: "mine-tag" }, t("mine")) : h("span", null, t("patient")),
      rv.verified ? h("span", { class: "ver-tag", title: t("verifiedTg") }, "✓ Telegram") : null,
      h("span", { class: "num" }, fmtDate(rv.at))),
    rv.text ? h("p", null, rv.text) : null)));
  const hs = $("#headStars"); if (hs) hs.replaceChildren(starsEl(r.avg, r.n));
}
function reviewForm(d){
  const wrap = h("div", { class: "rev-form", id: "revForm" });
  if (!state.config.reviewsEnabled){ wrap.append(h("p", { class: "hint" }, t("reviewsOff"))); return wrap; }
  const dirty = () => { wrap.dataset.dirty = "1"; };
  const existing = (state.reviews.get(d.id) || []).find(x => x.mine);
  let stars = existing ? existing.stars : 0;
  const label = h("span", { class: "hint" });
  const btns = [1, 2, 3, 4, 5].map(n => h("button", { type: "button", "aria-label": String(n), "aria-pressed": "false", onclick: () => { stars = n; paint(); dirty(); try { tg.HapticFeedback.selectionChanged(); } catch (_){} } }, "★"));
  function paint(){ btns.forEach((b, i) => { b.classList.toggle("on", i < stars); b.setAttribute("aria-pressed", String(i < stars)); }); label.textContent = stars ? t("starWords")[stars] : t("pickStar"); }
  const ta = h("textarea", { id: "revText", maxlength: "800", placeholder: t("revPh") });
  ta.value = existing ? (existing.text || "") : "";
  ta.addEventListener("input", dirty);
  const delBtn = h("button", { type: "button", class: "btn ghost", hidden: !existing }, t("delMine"));
  const send = h("button", { type: "button", class: "btn primary" }, existing ? t("update") : t("send"));
  send.addEventListener("click", async () => {
    if (!stars){ toast(t("needStar")); return; }
    send.disabled = true;
    try {
      await backend.submit(d.id, stars, ta.value.trim().slice(0, 800));
      toast(t("saved")); send.textContent = t("update"); delBtn.hidden = false;
      await loadReviews(d.id, "force");
    } catch (e){ toast(e.status === 429 ? t("tooMany") : e.code === "links_not_allowed" ? t("noLinks") : t("saveFail")); }
    finally { send.disabled = false; }
  });
  delBtn.addEventListener("click", async () => {
    delBtn.disabled = true;
    try {
      await backend.remove(d.id);
      toast(t("deleted")); await loadReviews(d.id, "force");
    } catch (e){ toast(t("delFail")); }
    finally { delBtn.disabled = false; }
  });
  wrap.append(
    h("label", { for: "revText", style: "font-weight:600" }, existing ? t("yourRating") : t("rateToo")),
    h("div", { class: "row" }, h("div", { class: "starpick", role: "group" }, btns), label),
    ta,
    h("p", { class: "hint" }, t("revHint")),
    h("div", { class: "row" }, send, delBtn));
  paint();
  return wrap;
}
function reportBlock(d){
  const det = h("details", { class: "report" });
  det.append(h("summary", null, t("report")));
  const r1 = h("input", { type: "radio", name: "rkind", id: "rk1", value: "fix", checked: true });
  const r2 = h("input", { type: "radio", name: "rkind", id: "rk2", value: "remove" });
  const ta = h("textarea", { id: "repText", maxlength: "600", placeholder: t("repPh") });
  const send = h("button", { type: "button", class: "btn primary" }, t("repSend"));
  send.addEventListener("click", async () => {
    const kind = r2.checked ? "remove" : "fix";
    if (kind === "fix" && !ta.value.trim()){ toast(t("repNeed")); return; }
    send.disabled = true;
    try {
      await backend.report(d.id, kind, ta.value.trim().slice(0, 600));
      ta.value = ""; det.open = false; toast(t("repSent"));
    } catch (e){ toast(e.status === 429 ? t("tooMany") : t("repFail")); }
    finally { send.disabled = false; }
  });
  det.append(
    h("label", { class: "radio", for: "rk1" }, r1, h("span", null, t("repFix"))),
    h("label", { class: "radio", for: "rk2" }, r2, h("span", null, t("repRemove"))),
    h("label", { class: "sr", for: "repText" }, t("note")), ta,
    h("div", { class: "row" }, send));
  return det;
}
async function copyText(text, btn, okMsg){
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e){
    const el = btn && btn.parentElement && btn.parentElement.querySelector(".tel");
    if (el){ const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
    toast(t("selected"));
  }
}
async function shareDoctor(d){
  const title = nameOf(d) + " — " + specLine(d);
  // in Telegram: share a link to the bot, which answers with this doctor's card
  const tgLink = state.config.telegramLink ? state.config.telegramLink + "?startapp=d-" + d.id
    : CFG.telegramBot ? "https://t.me/" + CFG.telegramBot + "?start=d-" + d.id : "";
  if (inTG && tgLink){ tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(tgLink) + "&text=" + encodeURIComponent(title)); return; }
  const url = new URL(docPageUrl(d.id), location.href).href;   // the doctor's own page: nice previews in Telegram
  if (navigator.share){ try { await navigator.share({ title: "Shifokor top", text: title, url }); return; } catch (_){ return; } }
  try { await navigator.clipboard.writeText(url); toast(t("linkCopied")); } catch (_){ toast(url); }
}

/* ---------- routing ---------- */
// Android app: the back button first closes an open doctor card
window.__stBack = () => { if ($("#detail").open){ closeDoctor(); return true; } return false; };
function routeFromHash(){
  const m = location.hash.match(/^#d-([A-Za-z0-9-]+)$/);
  if (m && state.doctors.has(m[1])){ if (state.openId !== m[1]) openDoctor(m[1]); }
  else if (!m && $("#detail").open) closeDoctor();
}

/* ---------- Telegram ---------- */
function rgbToHex(c){ const m = String(c).match(/\d+/g); if (!m) return null; return "#" + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, "0")).join(""); }
function syncTgColors(){
  try {
    const bg = rgbToHex(getComputedStyle(document.body).backgroundColor);
    if (bg){ tg.setBackgroundColor(bg); tg.setHeaderColor(rgbToHex(getComputedStyle($(".band")).backgroundColor) || bg); }
  } catch (_){}
}
function setupTelegram(){
  if (!inTG) return;
  document.body.classList.add("tg");
  try { tg.ready(); tg.expand(); } catch (_){}
  const applyTheme = () => {
    if (!loadPref("st-theme", "") && tg.colorScheme) document.documentElement.setAttribute("data-theme", tg.colorScheme);
    syncTgColors(); renderThemeBtn();
  };
  applyTheme();
  try { tg.onEvent("themeChanged", applyTheme); } catch (_){}
  try { tg.BackButton.onClick(closeDoctor); } catch (_){}
  // open outside links (maps, sources) in the phone's browser
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[target="_blank"]');
    if (!a) return;
    e.preventDefault();
    const href = a.href;
    if (/^https:\/\/t\.me\//.test(href)) tg.openTelegramLink(href); else tg.openLink(href);
  });
}

/* ---------- boot ---------- */
function init(){
  applyThemePref();
  $("#themeBtn").addEventListener("click", toggleTheme);
  if (darkMQ){ const f = () => renderThemeBtn(); if (darkMQ.addEventListener) darkMQ.addEventListener("change", f); else if (darkMQ.addListener) darkMQ.addListener(f); }
  try { new MutationObserver(renderThemeBtn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (_){}
  let qt;
  $("#q").addEventListener("input", (e) => { clearTimeout(qt); const v = e.target.value; qt = setTimeout(() => { state.q = v; state.shown = 30; renderList(); }, 120); });
  $("#district").addEventListener("change", (e) => { state.district = e.target.value; state.shown = 30; renderList(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });
  $("#home").addEventListener("click", (e) => { e.preventDefault(); clearFilters(); });
  $("#moreBtn").addEventListener("click", () => { state.shown += 30; renderList(); });
  // phones: load the next 30 doctors by itself when the list end comes near
  if ("IntersectionObserver" in window){
    new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting) && !$("#moreBtn").hidden){ state.shown += 30; renderList(); } }, { rootMargin: "300px 0px" }).observe($("#moreBtn"));
  }
  const toTop = $("#toTop");
  toTop.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => { try { $("#q").focus({ preventScroll: true }); } catch (_){} }, 350); });
  const onScroll = () => { toTop.hidden = window.scrollY < 700; };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  for (const b of document.querySelectorAll(".lang button")) b.addEventListener("click", () => setLang(b.dataset.lang));
  for (const b of document.querySelectorAll("#mode button")) b.addEventListener("click", () => setMode(b.dataset.mode));
  const dlg = $("#detail");
  dlg.addEventListener("close", () => {
    state.openId = null;
    if (state.reloadPending){ location.reload(); return; }
    if (inTG) try { tg.BackButton.hide(); } catch (_){}
    if (location.hash.startsWith("#d-")){ try { history.replaceState(null, "", location.pathname + location.search); } catch (_){ location.hash = ""; } }
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDoctor(); });
  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("online", renderOffline);
  window.addEventListener("offline", renderOffline);
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.installEvent = e; renderInstall(); });
  window.addEventListener("appinstalled", () => { state.installEvent = null; renderInstall(); });
  setupTelegram();
  renderStatic(); renderChips(); renderList();
}
async function load(){
  try {
    const r = await fetch("data/doctors.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("http_" + r.status);
    const list = await r.json();
    state.doctors = new Map(list.filter(d => d && d.id && d.name).map(d => [d.id, d]));
    state.status = "ready";
  } catch (e){ state.status = "error"; }
  renderChips(); renderList();
  try { state.config = Object.assign(state.config, await backend.config()); state.apiOk = true; } catch (_){}
  try {
    const rt = await backend.ratings();
    for (const id in rt) state.ratings.set(id, { avg: rt[id][0], n: rt[id][1] });
    renderList();
  } catch (_){}
  connectLive();
  const start = inTG && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  if (start && /^d-[A-Za-z0-9-]+$/.test(start) && state.doctors.has(start.slice(2))) openDoctor(start.slice(2));
  else routeFromHash();
}
/* ---------- live updates ---------- */
// New ratings and a changed doctors list reach every open page within a second (Server-Sent Events).
function updateRatingEls(id){
  const r = ratingOf(id);
  const sel = '.c-rating[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
  for (const el of document.querySelectorAll(sel)) el.replaceChildren(starsEl(r.avg, r.n));
}
async function refreshRatings(){
  try {
    const rt = await backend.ratings();
    const seen = new Set(Object.keys(rt));
    for (const id of [...state.ratings.keys()]) if (!seen.has(id)){ state.ratings.delete(id); updateRatingEls(id); }
    for (const id in rt){ state.ratings.set(id, { avg: rt[id][0], n: rt[id][1] }); updateRatingEls(id); }
  } catch (_){}
}
async function reloadDoctors(){
  try {
    const r = await fetch("data/doctors.json", { cache: "no-cache" });
    if (!r.ok) return;
    const list = await r.json();
    state.doctors = new Map(list.filter(d => d && d.id && d.name).map(d => [d.id, d]));
    renderChips(); renderList();
  } catch (_){}
}
async function onRatingChanged(id){
  if (!state.doctors.has(id)) return;
  try { const r = await backend.ratingOf(id); if (r.n) state.ratings.set(id, r); else state.ratings.delete(id); } catch (_){ return; }
  updateRatingEls(id);
  if (state.openId === id) loadReviews(id, "idle");
  else state.reviews.delete(id);
}
// Supabase: live changes over its realtime channel (library loaded only when Supabase is configured)
function connectSupabaseLive(){
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  s.async = true;
  s.onload = () => {
    try {
      const client = window.supabase.createClient(SB.url, SB.key, { auth: { persistSession: false, autoRefreshToken: false } });
      let joined = false;
      client.channel("reviews-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, (p) => {
          const id = (p.new && p.new.doctor_id) || (p.old && p.old.doctor_id);
          if (id){ onRatingChanged(id); return; }
          // a deleted review arrives with its id only: refresh all ratings and the open card
          refreshRatings();
          if (state.openId) loadReviews(state.openId, "idle");
        })
        .subscribe((status) => { if (status === "SUBSCRIBED"){ if (joined) refreshRatings(); joined = true; } });
    } catch (_){}
  };
  document.head.appendChild(s);
}
function connectLive(){
  if (!state.apiOk || !state.config.live) return;
  // a quiet safety net if a network blocks the live channel
  setInterval(() => { if (document.visibilityState === "visible") refreshRatings(); }, 120e3);
  if (SB){ connectSupabaseLive(); return; }
  if (!("EventSource" in window)) return;
  const es = new EventSource("api/stream");
  let opened = false;
  es.addEventListener("open", () => { if (opened) refreshRatings(); opened = true; });   // catch up after a reconnect
  es.addEventListener("rating", (e) => {
    let m; try { m = JSON.parse(e.data); } catch (_){ return; }
    if (!m || !state.doctors.has(m.id)) return;
    if (m.n) state.ratings.set(m.id, { avg: m.avg, n: m.n }); else state.ratings.delete(m.id);
    updateRatingEls(m.id);
    if (state.openId === m.id) loadReviews(m.id, "idle");
    else state.reviews.delete(m.id);
  });
  es.addEventListener("doctors", reloadDoctors);
}

/* ---------- installed app: new versions apply by themselves ---------- */
function canReloadNow(){
  const a = document.activeElement;
  return !$("#detail").open && !state.q && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
if (!EMBED && "serviceWorker" in navigator) window.addEventListener("load", () => {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    setInterval(() => reg.update().catch(() => {}), 30 * 60e3);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  let done = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || done) return;
    done = true;
    if (canReloadNow()) location.reload(); else state.reloadPending = true;
  });
});

init();
load();
})();
