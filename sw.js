/* 離線快取：只快取網頁本身、腳本與字型；資料庫請求一律不快取。 */
const C = "gp-shell-v2";
// 每個頁面各自快取：首頁存成 "./"，其他頁面（例如 game.html）用自己的網址
const pageKey = (u) => (/\/(index\.html)?$/.test(u.pathname) ? "./" : u.origin + u.pathname);
const PRE = [
  "./",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.js",
  "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;900&family=Noto+Sans+TC:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => Promise.all(PRE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname.endsWith("supabase.co")) return;
  const sameOrigin = u.origin === self.location.origin;
  const cdn = u.hostname === "cdn.jsdelivr.net" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !cdn) return;
  if (r.mode === "navigate" || (sameOrigin && !u.pathname.endsWith("sw.js"))) {
    // 網頁本身：有網路就拿最新的，沒網路用快取
    e.respondWith(fetch(r).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(C).then((c) => c.put(r.mode === "navigate" ? pageKey(u) : r, copy)); }
      return res;
    }).catch(() => caches.match(r.mode === "navigate" ? pageKey(u) : r, { ignoreSearch: true }).then((m) => m || caches.match("./"))));
    return;
  }
  // 腳本與字型：先用快取，背景更新
  e.respondWith(caches.open(C).then((c) => c.match(r).then((m) => {
    const net = fetch(r).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()); return res; }).catch(() => m);
    return m || net;
  })));
});
