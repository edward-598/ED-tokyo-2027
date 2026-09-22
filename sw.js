/*
  簡易 Service Worker
  讓已經開過的主要檔案，在沒有網路時也有機會正常開啟。
  若之後更新很多檔案，可把 CACHE_NAME 從 v1 改成 v2，讓瀏覽器重新快取。
*/
const CACHE_NAME = "tokyo-2027-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/storage.js",
  "./js/calendar.js",
  "./js/app.js",
  "./data/training.json",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
