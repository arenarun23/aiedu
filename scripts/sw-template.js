/* AIEDU 오프라인 서비스 워커 (허브 빌드가 자동 생성: scripts/sw-gen.mjs)
 *  - 이 서비스 폴더의 파일과 글꼴만 저장·응답한다. 그 밖(/api, 외부 필기 인식 등)은 건드리지 않는다.
 *  - 학생 기록(localStorage·IndexedDB)은 서비스 워커가 접근하지 않는다. 지우는 것은 '이 서비스의 예전 파일 저장본'뿐이다.
 *  - 버전(VERSION)은 파일 내용에서 계산한다. 서비스가 바뀌면 sw.js 가 달라져 브라우저가 새 버전을 설치하고,
 *    새 파일을 모두 받은 뒤(받다가 실패하면 기존 버전 유지) 예전 저장본을 지운다.
 */
const ID = '__ID__';
const VERSION = '__VERSION__';
const CACHE = 'aiedu-' + ID + '-' + VERSION;
const PREFIX = 'aiedu-' + ID + '-';
const FONTS = 'aiedu-fonts';            // 글꼴 조각은 파일 이름이 고정이라 서비스끼리 공유·유지
const BASE = new URL('./', self.location).pathname;   // 예: /game/
const FILES = __FILES__;                // 이 서비스 파일(BASE 기준 상대경로)
const FONT_FILES = __FONT_FILES__;      // 글꼴(절대경로)
const SHARED = __SHARED__;              // 허브 공용 파일(이용 기록·등록 스크립트, 절대경로) — 서비스 버전과 함께 저장·갱신
const OWN = new Set([...FILES.map((f) => BASE + f), ...SHARED]);
const FONT_SET = new Set(FONT_FILES);

async function putAll(cacheName, urls, only) {
  const c = await caches.open(cacheName);
  const todo = [];
  for (const u of urls) { if (only && (await c.match(u))) continue; todo.push(u); }
  for (let i = 0; i < todo.length; i += 12) {
    await Promise.all(todo.slice(i, i + 12).map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (!res.ok) throw new Error('받기 실패: ' + u);
      await c.put(u, res);
    }));
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await putAll(CACHE, [...FILES.map((f) => BASE + f), ...SHARED], false);
    try { await putAll(FONTS, FONT_FILES, true); } catch (_) { /* 글꼴은 못 받아도 설치는 성공 */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function networkFirst(e, req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await timeout(fetch(req), 3500);
    if (res && res.ok) e.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (_) {
    return (await cache.match(key)) || Response.error();
  }
}

async function fontFirst(e, req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) e.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (_) { return Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  let p = url.pathname;
  if (FONT_SET.has(p)) return void e.respondWith(p.endsWith('.woff2') ? fontFirst(e, req) : networkFirstFont(e, req));
  if (p === BASE.slice(0, -1)) p = BASE;
  if (p.endsWith('/') && p.startsWith(BASE)) p += 'index.html';
  if (!OWN.has(p)) return;                               // 목록에 없는 요청(/api 등)은 그대로 통과
  e.respondWith(networkFirst(e, req, p));
});

// 글꼴 CSS: 네트워크 우선, 실패하면 글꼴 저장본
async function networkFirstFont(e, req) {
  const cache = await caches.open(FONTS);
  try {
    const res = await timeout(fetch(req), 3500);
    if (res && res.ok) e.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (_) { return (await cache.match(req)) || Response.error(); }
}
