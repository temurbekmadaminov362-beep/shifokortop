/* Shifokor top — service worker.
   Bump VERSION whenever app.js, app.css, i18n.js or the icons change. */
const VERSION = "st-v9";
// the folder the app lives in: "/" on its own domain, "/shifokortop/" on GitHub Pages
const BASE = new URL(self.registration.scope).pathname;
const SHELL = [
  "./",
  "index.html",
  "app.css",
  "i18n.js",
  "config.js",
  "app.js",
  "privacy.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-64.png",
  "data/doctors.json"
];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache, so a new VERSION always stores fresh files
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req){
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (_){
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error();
  }
}
async function cacheFirst(req){
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // fonts, telegram.org: browser default
  if (url.pathname.startsWith(BASE + "api/")) return;       // reviews and ratings are always live
  if (req.mode === "navigate") { e.respondWith(networkFirst(req)); return; }
  if (url.pathname.startsWith(BASE + "data/") || url.pathname === BASE + "config.js") { e.respondWith(networkFirst(req)); return; }   // a changed list or setting shows at once
  if (url.pathname === BASE + "sw.js") return;
  e.respondWith(cacheFirst(req));
});
