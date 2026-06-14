/* VGA — Deal Radar · service worker
   App-shell caching so the app opens offline. Deal data is fetched
   network-first so the list stays fresh when online. */
var CACHE = "vga-deal-radar-v3";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/vga_mark.svg",
  "./assets/vga_mark_reverse.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = e.request.url;
  // Deal data: network-first (fresh when online, cached fallback offline).
  if (url.indexOf("deals.json") !== -1) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }
  // App shell: cache-first.
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
