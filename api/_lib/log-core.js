// 이용 기록 수집(handleLog)과 관리자 API(handleAdmin)의 핵심 로직. Vercel·로컬 시험 모두 같은 코드를 쓴다.
//
// 개인정보 최소화 원칙(바꾸려면 먼저 사용자·학교 개인정보 담당자와 상의):
//   · 저장: 익명 기기 ID(무작위), 기기 종류·OS·브라우저·화면 크기, 국가·시·도 코드, 서비스별 열기·시작·완료 횟수·이용 시간·터치 횟수
//   · 저장하지 않음: IP, 원문 User-Agent, 시·군·구, 아이가 입력한 낱말·필기·음성, 이름·계정
//   · 보관: 기본 90일(Redis 만료로 자동 삭제)
//   · 서버 스위치 LOGGING_ENABLED=1 이 아니면 아무것도 기록하지 않는다.
import { sha256, hmacHex, safeEqual, parseCookies, parseJson, clampInt, kstDay, daysAgo, parseUA, safeTok } from './util.js';

export const SERVICES = ['hub', 'flagmap', 'hangul', 'hanja', 'calcul', 'word', 'game', 'miro'];   // 서비스를 추가하면 여기에도 넣는다(또는 환경변수 EXTRA_SERVICES)
export const EVENTS = ['open', 'tick', 'start', 'finish', 'use'];
const P = 'aiedu:';
const out = (status, body, headers = {}) => ({ status, body, headers });
const silent = () => out(204);

const retentionDays = (env) => clampInt(env.LOG_RETENTION_DAYS || 90, 1, 365) ?? 90;
const services = (env) => [...SERVICES, ...String(env.EXTRA_SERVICES || '').split(',').map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,20}$/.test(s))];

// ---- 요청 횟수 제한: 저장소가 있으면 저장소로, 없으면 이 프로세스 메모리로 ----
const local = new Map();
async function counter(store, key, ttl, now) {
  if (store) {
    const r = await store.exec([['INCR', key], ['EXPIRE', key, ttl, 'NX']]);
    return Number(r[0]);
  }
  const e = local.get(key);
  if (!e || e.exp <= now) { local.set(key, { n: 1, exp: now + ttl * 1000 }); if (local.size > 5000) for (const [k, v] of local) if (v.exp <= now) local.delete(k); return 1; }
  return ++e.n;
}

const sameOrigin = (h) => {
  if (h['sec-fetch-site'] === 'same-origin') return true;
  try { return !!h.origin && new URL(h.origin).host === h.host; } catch { return false; }
};
const ipHash = (ctx, day) => sha256((ctx.ip || '') + '|' + day + '|' + (ctx.env.ADMIN_LINK_TOKEN || 'x')).slice(0, 16);   // 매일 바뀌는 해시(저장하지 않고 횟수 제한에만 사용)

// ============================ 수집 ============================
export async function handleLog(ctx) {
  const { env, headers, now } = ctx;
  if (ctx.method !== 'POST') return out(405, 'method', { Allow: 'POST' });
  if (env.LOGGING_ENABLED !== '1' || !ctx.store) return silent();
  if (!sameOrigin(headers)) return silent();
  if (ctx.body == null) return silent();
  const b = parseJson(ctx.body);
  if (!b) return silent();

  // 입력 검증: 허용 목록에 없으면 조용히 버린다(오류 내용을 알려 주지 않음)
  const id = typeof b.d === 'string' && /^[a-f0-9]{24}$/.test(b.d) ? b.d : null;
  const svc = typeof b.s === 'string' && services(env).includes(b.s) ? b.s : null;
  const evt = typeof b.e === 'string' && EVENTS.includes(b.e) ? b.e : null;
  if (!id || !svc || !evt) return silent();
  const tag = typeof b.g === 'string' && /^[a-z0-9_-]{1,20}$/.test(b.g) ? b.g : '';
  const secs = evt === 'tick' && Number.isInteger(b.t) && b.t >= 1 && b.t <= 120 ? b.t : 0;     // 범위 밖은 보정하지 않고 버린다
  const taps = clampInt(b.a ?? 0, 0, 3000) ?? 0;
  const w = clampInt(b.w, 100, 10000), h = clampInt(b.h, 100, 10000);
  if (evt === 'tick' && !secs) return silent();

  const store = ctx.store, day = kstDay(now), hour = Math.floor(now / 3600000);
  const ip = ipHash(ctx, day);
  const cap = clampInt(env.LOG_DAILY_CAP || 50000, 100, 1000000) ?? 50000;
  const [c1, c2, c3] = await Promise.all([counter(store, `${P}cap:${day}`, 172800, now), counter(store, `${P}rl:dev:${id}:${hour}`, 3700, now), counter(store, `${P}rl:ip:${ip}:${hour}`, 3700, now)]);
  if (c1 > cap || c2 > 300 || c3 > 5000) return silent();

  const ttl = retentionDays(env) * 86400;
  const ua = parseUA(headers['user-agent']);
  const country = safeTok(headers['x-vercel-ip-country'], 2) || '-';
  const region = safeTok(headers['x-vercel-ip-country-region'], 8) || '-';          // 시·도 수준(시·군·구는 저장하지 않음)
  const screen = w && h ? `${Math.round(w / 10) * 10}x${Math.round(h / 10) * 10}` : '-';
  const dev = `${P}dev:${id}`, ev = `${P}ev:${id}`, dk = `${P}day:${day}`;
  const cmds = [
    ['HSETNX', dev, 'first', now],
    ['HSET', dev, 'last', now, 'device', ua.device, 'os', ua.os, 'browser', ua.browser, 'screen', screen, 'country', country, 'region', region],
    ['EXPIRE', dev, ttl],
    ['ZADD', `${P}devs`, now, id],
    ['ZREMRANGEBYSCORE', `${P}devs`, 0, now - ttl * 1000],
    ['EXPIRE', `${P}devs`, ttl],
    ['SADD', `${P}daydev:${day}`, id], ['EXPIRE', `${P}daydev:${day}`, ttl],
    ['SADD', `${P}daydev:${day}:${svc}`, id], ['EXPIRE', `${P}daydev:${day}:${svc}`, ttl],
  ];
  if (evt === 'tick') {
    cmds.push(['HINCRBY', dev, `sec:${svc}`, secs], ['HINCRBY', dev, `tap:${svc}`, taps], ['HINCRBY', dk, `sec:${svc}`, secs], ['HINCRBY', dk, `tap:${svc}`, taps]);
  } else {
    if (evt === 'open') cmds.push(['HINCRBY', dev, 'visits', 1], ['HINCRBY', dev, `open:${svc}`, 1]);
    cmds.push(['HINCRBY', dk, `${evt}:${svc}`, 1], ['LPUSH', ev, `${now}|${svc}|${evt}|${tag}`], ['LTRIM', ev, 0, 199], ['EXPIRE', ev, ttl]);
  }
  cmds.push(['EXPIRE', dk, ttl]);
  try { await store.exec(cmds); } catch { /* 기록 실패는 사용자에게 영향이 없어야 한다 */ }
  return silent();
}

// ============================ 관리자 ============================
const COOKIE_MAX = 30 * 86400;
const cookieName = (https) => (https ? '__Host-aiedu_admin' : 'aiedu_admin');
const adminToken = (env) => (typeof env.ADMIN_LINK_TOKEN === 'string' && env.ADMIN_LINK_TOKEN.length >= 32 ? env.ADMIN_LINK_TOKEN : null);

function makeCookieValue(token, now) { const iat = Math.floor(now / 1000); return `${iat}.${hmacHex(token, 'aiedu-admin-v1.' + iat)}`; }
function cookieValid(value, token, now) {
  const m = /^(\d{9,11})\.([a-f0-9]{64})$/.exec(value || '');
  if (!m) return false;
  const iat = Number(m[1]), age = now / 1000 - iat;
  if (age < -60 || age > COOKIE_MAX) return false;
  return safeEqual(hmacHex(token, 'aiedu-admin-v1.' + iat), m[2]);
}
const setCookie = (name, value, https, maxAge) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${https ? '; Secure' : ''}`;

const toObj = (arr) => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; };
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function deviceRow(id, h, score) {
  const per = {};
  for (const [k, v] of Object.entries(h)) { const m = /^(open|sec|tap):(.+)$/.exec(k); if (m) (per[m[2]] ||= {})[m[1]] = Number(v); }
  return { id, first: Number(h.first) || null, last: Number(score) || Number(h.last) || null, device: h.device || '-', os: h.os || '-', browser: h.browser || '-', screen: h.screen || '-', country: h.country || '-', region: h.region || '-', visits: Number(h.visits) || 0, services: per };
}

export async function handleAdmin(ctx) {
  const { env, headers, now, store } = ctx;
  const token = adminToken(env);
  const https = (headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const q = ctx.query || {};
  const op = String(q.op || '');
  const notFound = () => out(404, 'Not found');
  if (!token) return notFound();                                           // 비밀값이 없거나 짧으면 관리자 기능 전체 비활성

  // --- 로그인: 비밀 링크 값을 받아 쿠키를 심는다 ---
  if (op === 'login') {
    if (ctx.method !== 'POST' || !sameOrigin(headers)) return notFound();
    const day = kstDay(now), ip = ipHash(ctx, day);
    const [a, g] = await Promise.all([counter(store, `${P}rl:login:${ip}`, 600, now), counter(store, `${P}rl:login:all`, 600, now)]);
    if (a > 8 || g > 60) return out(429, { ok: false }, { 'Retry-After': '600' });
    const body = parseJson(ctx.body || '') || {};
    if (typeof body.k !== 'string' || !safeEqual(body.k, token)) return out(401, { ok: false });
    return out(200, { ok: true }, { 'Set-Cookie': setCookie(cookieName(https), makeCookieValue(token, now), https, COOKIE_MAX) });
  }

  // --- 이하 모든 요청은 쿠키가 유효해야 한다. 아니면 존재 자체를 숨긴다(404) ---
  const ck = parseCookies(headers.cookie)[cookieName(https)];
  if (!cookieValid(ck, token, now)) return notFound();

  if (op === 'logout') {
    if (ctx.method !== 'POST' || !sameOrigin(headers)) return notFound();
    return out(200, { ok: true }, { 'Set-Cookie': setCookie(cookieName(https), '', https, 0) });
  }
  const mutate = op === 'delete' || op === 'purge';
  if (mutate && (ctx.method !== 'POST' || !sameOrigin(headers) || headers['x-aiedu-admin'] !== '1')) return notFound();   // CSRF 방어
  if (!mutate && ctx.method !== 'GET') return notFound();

  if (op === 'me') return out(200, { ok: true, store: store ? store.kind : null, enabled: env.LOGGING_ENABLED === '1', retentionDays: retentionDays(env), services: services(env) });
  if (!store) return out(503, { ok: false, error: 'store' });

  if (op === 'summary') {
    const n = clampInt(q.days || 7, 1, 30) ?? 7, svcs = services(env);
    const dayList = Array.from({ length: n }, (_, i) => daysAgo(i, now));
    const cmds = [];
    for (const d of dayList) { cmds.push(['HGETALL', `${P}day:${d}`], ['SCARD', `${P}daydev:${d}`]); for (const s of svcs) cmds.push(['SCARD', `${P}daydev:${d}:${s}`]); }
    const r = await store.exec(cmds);
    const per = 2 + svcs.length;
    const days = dayList.map((day, i) => {
      const base = i * per, h = toObj(r[base]), by = { open: {}, start: {}, finish: {}, use: {}, sec: {}, tap: {}, devicesBySvc: {} };
      for (const [k, v] of Object.entries(h)) { const m = /^(open|start|finish|use|sec|tap):(.+)$/.exec(k); if (m) by[m[1]][m[2]] = Number(v); }
      svcs.forEach((s, j) => { const c = Number(r[base + 2 + j]); if (c) by.devicesBySvc[s] = c; });
      return { day, devices: Number(r[base + 1]) || 0, ...by };
    });
    return out(200, { ok: true, days, services: svcs });
  }

  if (op === 'devices' || op === 'export') {
    const limit = clampInt(q.limit || (op === 'export' ? 500 : 100), 1, 500) ?? 100;
    const z = (await store.exec([['ZREVRANGE', `${P}devs`, 0, limit - 1, 'WITHSCORES']]))[0] || [];
    const ids = [], scores = [];
    for (let i = 0; i < z.length; i += 2) { ids.push(z[i]); scores.push(z[i + 1]); }
    const hs = ids.length ? await store.exec(ids.map((id) => ['HGETALL', `${P}dev:${id}`])) : [];
    const rows = ids.map((id, i) => deviceRow(id, toObj(hs[i]), scores[i]));
    if (op === 'devices') return out(200, { ok: true, devices: rows });
    const kst = (t) => (t ? new Date(t + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 16) : '');
    const head = ['기기ID', '첫 접속(KST)', '마지막 접속(KST)', '기기', 'OS', '브라우저', '화면', '국가', '시·도', '방문 수', '서비스별 열기/이용(초)/터치'];
    const lines = [head.map(csvCell).join(',')];
    for (const d of rows) lines.push([d.id, kst(d.first), kst(d.last), d.device, d.os, d.browser, d.screen, d.country, d.region, d.visits, Object.entries(d.services).map(([s, v]) => `${s}:${v.open || 0}/${v.sec || 0}/${v.tap || 0}`).join(' ')].map(csvCell).join(','));
    return out(200, '﻿' + lines.join('\r\n') + '\r\n', { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="aiedu-devices.csv"' });
  }

  if (op === 'device') {
    const id = String(q.id || '');
    if (!/^[a-f0-9]{24}$/.test(id)) return out(400, { ok: false });
    const [h, ev] = await store.exec([['HGETALL', `${P}dev:${id}`], ['LRANGE', `${P}ev:${id}`, 0, 199]]);
    const events = (ev || []).map((s) => { const [t, svc, e, g] = String(s).split('|'); return { t: Number(t), svc: safeTok(svc, 20), e: safeTok(e, 10), g: safeTok(g, 20) }; });
    return out(200, { ok: true, device: deviceRow(id, toObj(h)), events });
  }

  if (op === 'delete') {
    const id = String((parseJson(ctx.body || '') || {}).id || '');
    if (!/^[a-f0-9]{24}$/.test(id)) return out(400, { ok: false });
    await store.exec([['DEL', `${P}dev:${id}`, `${P}ev:${id}`], ['ZREM', `${P}devs`, id]]);
    return out(200, { ok: true });
  }

  if (op === 'purge') {
    if ((parseJson(ctx.body || '') || {}).confirm !== '삭제') return out(400, { ok: false });
    let cursor = '0', removed = 0;
    for (let i = 0; i < 100; i++) {
      const [next, keys] = (await store.exec([['SCAN', cursor, 'MATCH', `${P}*`, 'COUNT', 500]]))[0];
      if (keys.length) { await store.exec([['DEL', ...keys]]); removed += keys.length; }
      cursor = String(next);
      if (cursor === '0') break;
    }
    return out(200, { ok: true, removed });
  }
  return notFound();
}
