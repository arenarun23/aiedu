// 이용 기록·관리자 API 자동 시험:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLog, handleAdmin } from '../api/_lib/log-core.js';
import { createMemoryStore } from '../api/_lib/store.js';
import { hmacHex } from '../api/_lib/util.js';

const TOKEN = 'T'.repeat(8) + 'abcdefghijklmnopqrstuvwxyz0123456789'.slice(0, 40);   // 48자
const ID = 'a1b2c3d4e5f6a7b8c9d0e1f2';
const HOST = 'aiedu.test';
const UA_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Safari/537.36';
const IP = '203.0.113.77';

function env(over = {}) { return { LOGGING_ENABLED: '1', ADMIN_LINK_TOKEN: TOKEN, ...over }; }
function mk(now = Date.UTC(2026, 10, 7, 3, 0, 0)) { const clock = { t: now }; return { clock, store: createMemoryStore(() => clock.t) }; }
const logReq = (body, o = {}) => ({ method: 'POST', headers: { host: HOST, origin: 'https://' + HOST, 'user-agent': UA_TABLET, 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '31', ...o.headers }, body: typeof body === 'string' ? body : JSON.stringify(body), ip: IP, env: o.env || env(), store: o.store, now: o.now });
const ev = (over = {}) => ({ d: ID, s: 'word', e: 'open', w: 1280, h: 800, ...over });
const adm = (op, o = {}) => ({ method: o.method || 'GET', headers: { host: HOST, origin: 'https://' + HOST, 'x-forwarded-proto': 'https', ...o.headers }, query: { op, ...o.query }, body: o.body ? JSON.stringify(o.body) : null, ip: o.ip || IP, env: o.env || env(), store: o.store, now: o.now });
async function login(store, now, over = {}) {
  const r = await handleAdmin(adm('login', { method: 'POST', body: { k: TOKEN }, store, now, ...over }));
  assert.equal(r.status, 200);
  return r.headers['Set-Cookie'].split(';')[0];       // "__Host-aiedu_admin=값"
}
const withCookie = (cookie, o = {}) => ({ ...o, headers: { ...(o.headers || {}), cookie } });

test('서버 스위치가 꺼져 있으면 아무것도 기록하지 않는다', async () => {
  const { store, clock } = mk();
  const r = await handleLog(logReq(ev(), { store, now: clock.t, env: { ADMIN_LINK_TOKEN: TOKEN } }));
  assert.equal(r.status, 204); assert.equal(store.data.size, 0);
});

test('저장소가 없어도 오류 없이 무시한다', async () => {
  const r = await handleLog(logReq(ev(), { store: null, now: Date.now() }));
  assert.equal(r.status, 204);
});

test('정상 기록: 기기·위치(시·도)·횟수만 저장하고 IP·원문 UA·입력 내용은 저장하지 않는다', async () => {
  const { store, clock } = mk();
  await handleLog(logReq(ev(), { store, now: clock.t }));
  await handleLog(logReq(ev({ e: 'start', g: 'memory' }), { store, now: clock.t }));
  await handleLog(logReq(ev({ e: 'tick', t: 60, a: 42 }), { store, now: clock.t }));
  const dev = store.data.get(`aiedu:dev:${ID}`).v;
  assert.equal(dev.device, '태블릿'); assert.equal(dev.os, 'Android 13'); assert.match(dev.browser, /삼성 인터넷 24/);
  assert.equal(dev.country, 'KR'); assert.equal(dev.region, '31'); assert.equal(dev.screen, '1280x800');
  assert.equal(dev.visits, '1'); assert.equal(dev['sec:word'], '60'); assert.equal(dev['tap:word'], '42');
  // 저장소 전체에서 IP·원문 UA 조각이 어디에도 없어야 한다
  const dump = JSON.stringify([...store.data.entries()].map(([k, e]) => [k, e.v instanceof Set ? [...e.v] : e.v instanceof Map ? [...e.v] : e.v]));
  assert.ok(!dump.includes(IP), 'IP 가 저장되면 안 됨');
  assert.ok(!dump.includes('SM-X710') && !dump.includes('AppleWebKit'), '원문 UA 가 저장되면 안 됨');
  const events = store.data.get(`aiedu:ev:${ID}`).v;
  assert.equal(events.length, 2); assert.match(events[0], /\|word\|start\|memory$/);
});

test('잘못된 입력은 모두 조용히 버린다(허용 목록·형식·크기)', async () => {
  const { store, clock } = mk();
  const bad = [ev({ d: 'short' }), ev({ d: 'Z'.repeat(24) }), ev({ s: 'evil' }), ev({ s: '<script>' }), ev({ e: 'drop' }), ev({ e: 'tick' }), ev({ e: 'tick', t: 0 }),
    '{not json', '[1,2]', '"str"', ev({ d: ID.replace('a', '<') })];
  for (const b of bad) { const r = await handleLog(logReq(b, { store, now: clock.t })); assert.equal(r.status, 204); }
  const big = await handleLog({ ...logReq(ev(), { store, now: clock.t }), body: null });   // 본문 상한 초과(null)
  assert.equal(big.status, 204);
  assert.equal([...store.data.keys()].filter((k) => k.startsWith('aiedu:dev:')).length, 0, '잘못된 입력으로 기기 기록이 생기면 안 됨');
  assert.equal((await handleLog({ ...logReq(ev(), { store, now: clock.t }), method: 'GET' })).status, 405);
});

test('태그·헤더에 들어온 위험한 문자는 걸러진다', async () => {
  const { store, clock } = mk();
  await handleLog(logReq(ev({ e: 'use', g: '<img src=x onerror=1>' }), { store, now: clock.t }));   // g 형식 불일치 → 태그 없이 기록
  await handleLog(logReq(ev(), { store, now: clock.t, headers: { 'x-vercel-ip-country': '<script>alert(1)</script>', 'x-vercel-ip-country-region': '"><b>' } }));
  const dev = store.data.get(`aiedu:dev:${ID}`).v;
  assert.match(dev.country, /^[A-Za-z0-9가-힣 ._-]{0,2}$|^-$/);
  assert.ok(!/[<>"]/.test(dev.country + dev.region));
  const evs = store.data.get(`aiedu:ev:${ID}`).v;
  assert.ok(evs.every((s) => !/[<>]/.test(s)));
});

test('다른 출처에서 보낸 요청은 무시한다', async () => {
  const { store, clock } = mk();
  const r = await handleLog(logReq(ev(), { store, now: clock.t, headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }));
  assert.equal(r.status, 204); assert.equal(store.data.size, 0);
  const none = await handleLog({ ...logReq(ev(), { store, now: clock.t }), headers: { host: HOST, 'user-agent': UA_TABLET } });   // 출처 정보 없음(브라우저가 아님)
  assert.equal(none.status, 204); assert.equal(store.data.size, 0);
});

test('요청 폭주 제한: 기기별 시간당 300건, 하루 총량 상한', async () => {
  const { store, clock } = mk();
  for (let i = 0; i < 305; i++) await handleLog(logReq(ev({ e: 'use' }), { store, now: clock.t }));
  assert.equal(store.data.get(`aiedu:day:2026-11-07`).v['use:word'], '300');   // 300건 이후는 버려짐
  const s2 = mk(); const e2 = env({ LOG_DAILY_CAP: '100' });
  for (let i = 0; i < 150; i++) await handleLog(logReq(ev({ d: (i.toString(16).padStart(24, '0')) }), { store: s2.store, now: s2.clock.t, env: e2 }));
  assert.equal(s2.store.data.get(`aiedu:day:2026-11-07`).v['open:word'], '100');
});

test('관리자: 비밀값이 없거나 짧으면 전체 비활성(404)', async () => {
  const { store, clock } = mk();
  for (const e of [{ LOGGING_ENABLED: '1' }, { LOGGING_ENABLED: '1', ADMIN_LINK_TOKEN: 'short' }]) {
    assert.equal((await handleAdmin(adm('login', { method: 'POST', body: { k: 'short' }, store, now: clock.t, env: e }))).status, 404);
    assert.equal((await handleAdmin(adm('me', { store, now: clock.t, env: e }))).status, 404);
  }
});

test('관리자 로그인: 틀린 값 거절, 8회 초과 시 제한(429), 맞는 값은 보안 쿠키 발급', async () => {
  const { store, clock } = mk();
  const bad = await handleAdmin(adm('login', { method: 'POST', body: { k: 'wrong' + TOKEN }, store, now: clock.t }));
  assert.equal(bad.status, 401); assert.equal(bad.headers['Set-Cookie'], undefined);
  let last;
  for (let i = 0; i < 9; i++) last = await handleAdmin(adm('login', { method: 'POST', body: { k: 'x' + i }, store, now: clock.t }));
  assert.equal(last.status, 429);
  // 다른 IP 는 제한에 걸리지 않고 로그인 가능
  const ok = await handleAdmin(adm('login', { method: 'POST', body: { k: TOKEN }, store, now: clock.t, ip: '198.51.100.5' }));
  assert.equal(ok.status, 200);
  const c = ok.headers['Set-Cookie'];
  assert.match(c, /^__Host-aiedu_admin=\d+\.[a-f0-9]{64};/); assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Strict/); assert.match(c, /Path=\//); assert.ok(!/Domain=/i.test(c));
  // GET 으로 로그인 시도 / 다른 출처에서 로그인 시도는 404
  assert.equal((await handleAdmin(adm('login', { method: 'GET', store, now: clock.t }))).status, 404);
  assert.equal((await handleAdmin(adm('login', { method: 'POST', body: { k: TOKEN }, headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }, store, now: clock.t }))).status, 404);
});

test('쿠키: 위조·변조·만료·비밀값 교체 시 모두 거절', async () => {
  const { store, clock } = mk();
  const cookie = await login(store, clock.t);
  const [name, val] = cookie.split('=');
  assert.equal((await handleAdmin(adm('me', withCookie(cookie, { store, now: clock.t })))).status, 200);
  assert.equal((await handleAdmin(adm('me', { store, now: clock.t }))).status, 404, '쿠키 없음');
  const [iat, mac] = val.split('.');
  const flipped = mac.slice(0, -1) + (mac.endsWith('0') ? '1' : '0');
  assert.equal((await handleAdmin(adm('me', withCookie(`${name}=${iat}.${flipped}`, { store, now: clock.t })))).status, 404, '서명 변조');
  assert.equal((await handleAdmin(adm('me', withCookie(`${name}=${Number(iat) + 5}.${mac}`, { store, now: clock.t })))).status, 404, '발급 시각 변조');
  const forged = `${name}=${iat}.${hmacHex('x'.repeat(48), 'aiedu-admin-v1.' + iat)}`;
  assert.equal((await handleAdmin(adm('me', withCookie(forged, { store, now: clock.t })))).status, 404, '다른 키로 서명');
  assert.equal((await handleAdmin(adm('me', withCookie(cookie, { store, now: clock.t + 31 * 86400000 })))).status, 404, '30일 지나 만료');
  assert.equal((await handleAdmin(adm('me', withCookie(cookie, { store, now: clock.t, env: env({ ADMIN_LINK_TOKEN: 'N'.repeat(48) }) })))).status, 404, '비밀값을 바꾸면 모든 쿠키 무효');
});

test('관리자 API: 요약·기기 목록·상세·CSV, CSV 수식 주입 방어', async () => {
  const { store, clock } = mk();
  await handleLog(logReq(ev(), { store, now: clock.t }));
  await handleLog(logReq(ev({ e: 'start', g: 'maze' }), { store, now: clock.t }));
  await handleLog(logReq(ev({ e: 'tick', t: 60, a: 10 }), { store, now: clock.t }));
  await handleLog(logReq(ev({ d: 'f'.repeat(24), s: 'game' }), { store, now: clock.t, headers: { 'user-agent': '=cmd|calc' } }));
  const cookie = await login(store, clock.t);
  const A = (op, o = {}) => handleAdmin(adm(op, withCookie(cookie, { store, now: clock.t, ...o })));
  const sum = await A('summary', { query: { days: '3' } });
  const today = sum.body.days[0];
  assert.equal(today.devices, 2); assert.equal(today.open.word, 1); assert.equal(today.start.word, 1); assert.equal(today.sec.word, 60); assert.equal(today.devicesBySvc.word, 1); assert.equal(today.devicesBySvc.game, 1);
  const list = await A('devices');
  assert.equal(list.body.devices.length, 2);
  const d1 = list.body.devices.find((d) => d.id === ID);
  assert.equal(d1.services.word.sec, 60); assert.equal(d1.region, '31');
  const det = await A('device', { query: { id: ID } });
  assert.equal(det.body.events.length, 2); assert.equal(det.body.events[0].g, 'maze');
  assert.equal((await A('device', { query: { id: '../etc' } })).status, 400);
  const csv = await A('export');
  assert.equal(csv.status, 200); assert.match(csv.headers['Content-Type'], /text\/csv/);
  assert.ok(csv.body.startsWith('﻿기기ID')); assert.ok(!/^[=+\-@]/m.test(csv.body.split('\r\n').slice(1).join('\n')), '셀이 수식 문자로 시작하면 안 됨');
});

test('삭제·전체 삭제는 POST + CSRF 헤더 + 확인 문구가 있어야 하고, 기기 삭제는 해당 기기만 지운다', async () => {
  const { store, clock } = mk();
  await handleLog(logReq(ev(), { store, now: clock.t }));
  await handleLog(logReq(ev({ d: 'f'.repeat(24) }), { store, now: clock.t }));
  const cookie = await login(store, clock.t);
  const A = (op, o = {}) => handleAdmin(adm(op, withCookie(cookie, { store, now: clock.t, ...o })));
  assert.equal((await A('delete', { method: 'GET', query: { id: ID } })).status, 404, 'GET 거절');
  assert.equal((await A('delete', { method: 'POST', body: { id: ID } })).status, 404, 'CSRF 헤더 없음');
  assert.equal((await A('delete', { method: 'POST', body: { id: ID }, headers: { 'x-aiedu-admin': '1', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } })).status, 404, '다른 출처');
  assert.equal((await A('delete', { method: 'POST', body: { id: ID }, headers: { 'x-aiedu-admin': '1' } })).status, 200);
  assert.ok(!store.data.has(`aiedu:dev:${ID}`)); assert.ok(store.data.has(`aiedu:dev:${'f'.repeat(24)}`));
  assert.equal((await A('purge', { method: 'POST', body: { confirm: 'x' }, headers: { 'x-aiedu-admin': '1' } })).status, 400);
  const p = await A('purge', { method: 'POST', body: { confirm: '삭제' }, headers: { 'x-aiedu-admin': '1' } });
  assert.equal(p.status, 200); assert.ok(p.body.removed > 0);
  assert.equal([...store.data.keys()].filter((k) => k.startsWith('aiedu:dev') || k.startsWith('aiedu:day')).length, 0);
});

test('보관 기간: 90일이 지나면 기기 기록·이벤트·일별 집계가 자동으로 사라진다', async () => {
  const { store, clock } = mk();
  await handleLog(logReq(ev(), { store, now: clock.t }));
  await handleLog(logReq(ev({ e: 'start', g: 'a' }), { store, now: clock.t }));
  assert.ok(store.data.has(`aiedu:dev:${ID}`));
  clock.t += 89 * 86400000; assert.ok(store.data.size > 0);
  const keysAt89 = [...store.data.keys()].filter((k) => store.data.get(k));
  const alive89 = (await store.exec([['HGETALL', `aiedu:dev:${ID}`]]))[0];
  assert.ok(alive89.length > 0, '89일째에는 남아 있음');
  clock.t += 2 * 86400000;     // 91일
  assert.equal((await store.exec([['HGETALL', `aiedu:dev:${ID}`]]))[0].length, 0, '91일째에는 삭제');
  assert.equal((await store.exec([['LRANGE', `aiedu:ev:${ID}`, 0, -1]]))[0].length, 0);
  assert.equal((await store.exec([['HGETALL', 'aiedu:day:2026-11-07']]))[0].length, 0);
  // 보관 기간 환경변수(30일)
  const s2 = mk(); const e30 = env({ LOG_RETENTION_DAYS: '30' });
  await handleLog(logReq(ev(), { store: s2.store, now: s2.clock.t, env: e30 }));
  s2.clock.t += 31 * 86400000;
  assert.equal((await s2.store.exec([['HGETALL', `aiedu:dev:${ID}`]]))[0].length, 0);
});
