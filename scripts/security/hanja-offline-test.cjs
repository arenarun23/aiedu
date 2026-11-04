// 한자 찾기(hanja) 시험: 핵심/나머지 사전, 획수·부수, 서비스 워커 오프라인, 첫 방문 타이밍
//   node scripts/security/hanja-offline-test.cjs <hanja 주소, 예: https://aiedu-pearl.vercel.app/hanja/>
//   SW_DELAY=5000 node ... : 서비스 워커를 5초 늦춰 '페이지가 서비스 워커보다 먼저 파일을 받는' 배포 환경을 재현(첫 방문 오프라인 준비 확인)
//   주의: Playwright 의 waitForFunction 에 async 조건을 넘기면 프라미스가 곧바로 '참'으로 취급된다 → 반드시 아래처럼 직접 반복 확인할 것
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8900/hanja/';
let pick = null;   // 시험 낱말은 사전에서 직접 고른다(main 에서 채움)
const ok = (c, m) => { console.log((c ? '✔' : '✘') + ' ' + m); if (!c) process.exitCode = 1; };
const big = (p) => p.evaluate(() => document.getElementById('big').textContent);
const info = (p) => p.evaluate(() => document.getElementById('info').innerText);

(async () => {
  const [core, rest] = await Promise.all([fetch(BASE + 'dict/words-core.json').then(r => r.json()), fetch(BASE + 'dict/words-rest.json').then(r => r.json())]);
  const k = Object.keys(rest).find(x => !core[x] && x.length >= 2 && x.length <= 3);   // 나머지 사전에만 있는 짧은 낱말
  pick = { restOnly: k, restForm: rest[k][0] };
  console.log('시험 낱말(나머지에만 있음):', k, '→', rest[k][0]);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 620 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const errs = [], viol = [], reqs = [], failedReq = [];
  p.on('requestfailed', r => failedReq.push(r.url().split('/').slice(-2).join('/') + ' ' + (r.failure() && r.failure().errorText)));
  p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text().slice(0, 140)); });
  p.on('response', r => { const u = r.url(); if (/dict\//.test(u)) reqs.push([Date.now(), u.split('/').pop(), r.status()]); });
  // 나머지 사전을 일부러 늦춰서 "합쳐지기 전에 나머지 낱말을 찾는" 경로를 시험한다
  let delay = 1500;
  await ctx.route('**/dict/words-rest.json', async route => { await new Promise(r => setTimeout(r, delay)); route.continue(); });

  if (process.env.SW_DELAY) await ctx.route('**/sw.js', async route => { await new Promise(r => setTimeout(r, +process.env.SW_DELAY)); route.continue(); });   // 배포 환경 재현: 서비스 워커가 늦게 켜짐
  console.log('— 1) 처음 열기(온라인)');
  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof CH !== 'undefined' && CH && WD, null, { timeout: 15000 });
  const tCore = Date.now() - t0;
  ok(true, `핵심 사전 준비까지 ${tCore}ms`);
  ok(await p.evaluate(() => REST_DONE) === false, '이 시점에는 나머지 낱말이 아직 합쳐지지 않음(배경에서 받는 중)');
  const nCore = await p.evaluate(() => Object.keys(WD).length);
  ok(nCore > 40000 && nCore < 60000, `핵심 낱말 표제 ${nCore.toLocaleString()}개`);

  console.log('— 2) 핵심 낱말 조회 + 획수·부수');
  await p.evaluate(() => lookup('학교')); await p.waitForTimeout(400);
  ok((await big(p)).includes('學校'), `학교 → ${await big(p)}`);
  let txt = await info(p);
  ok(/획수·부수/.test(txt) && /學\s*16획/.test(txt) && /부수/.test(txt), '획수·부수 표시: ' + (txt.match(/學[^\n]*16획[^\n]*/) || [''])[0]);
  await p.evaluate(() => lookup('人')); await p.waitForTimeout(300);
  txt = await info(p);
  ok(/人\s*2획/.test(txt), '한자 한 글자 조회에도 획수 표시: ' + (txt.match(/人[^\n]*2획[^\n]*/) || [''])[0]);

  console.log('— 3) 나머지에만 있는 낱말을, 합쳐지기 전에 조회(잠깐 기다린 뒤 찾아야 함)');
  ok(await p.evaluate(() => REST_DONE) === false, '조회 직전: 나머지 미합침');
  const t1 = Date.now();
  await p.evaluate(k => lookup(k), pick.restOnly);
  await p.waitForTimeout(300);
  const t1d = Date.now() - t1;
  ok((await big(p)).includes(pick.restForm), `${pick.restOnly} → ${await big(p)} (기대 ${pick.restForm}, ${t1d}ms)`);
  ok(await p.evaluate(() => REST_DONE) === true, '나머지 합침 완료');

  console.log('— 4) 서비스 워커·저장 상태');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(6000);   // 서비스 워커가 사전·글꼴을 저장할 시간
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const keys = await caches.keys(); const c = await caches.open(keys[0]); const urls = (await c.keys()).map(x => new URL(x.url).pathname.split('/').slice(-2).join('/')); return { scope: r && new URL(r.scope).pathname, active: !!(r && r.active), keys, urls }; });
  ok(sw.active && sw.scope.endsWith('/hanja/'), `서비스 워커 활성, 범위 ${sw.scope}`);
  ok(['words-core.json', 'words-rest.json', 'strokes.json'].every(f => sw.urls.some(u => u.endsWith(f))), '저장된 파일: ' + sw.urls.filter(u => /dict|fonts/.test(u)).slice(0, 8).join(', '));
  let cached = false;
  for (let k = 0; k < 60 && !cached; k++) {
    cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return !!(await c.match('dict/words-rest.json')); });
    if (!cached) await p.waitForTimeout(500);
  }
  ok(cached, '나머지 사전(words-rest.json)이 저장됨');

  console.log('— 5) 인터넷 끊고 다시 열기(오프라인)');
  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof CH !== 'undefined' && CH && WD, null, { timeout: 15000 });
  ok(true, '오프라인에서 앱과 핵심 사전 열림');
  await p.evaluate(() => lookup('학교')); await p.waitForTimeout(400);
  ok((await big(p)).includes('學校'), `오프라인 학교 → ${await big(p)}`);
  await p.evaluate(k => lookup(k), pick.restOnly); await p.waitForTimeout(800);
  ok((await big(p)).includes(pick.restForm), `오프라인 ${pick.restOnly}(나머지 사전) → ${await big(p)}`);
  await p.waitForTimeout(800);
  const fstat = await p.evaluate(async () => { await document.fonts.ready; const c = {}; for (const f of document.fonts) c[f.status] = (c[f.status] || 0) + 1; return c; });
  const used = await p.evaluate(() => getComputedStyle(document.getElementById('big')).fontFamily.slice(0, 50));
  console.log('   글꼴 상태', JSON.stringify(fstat), '| 큰 글자 글꼴', used, '| 실패한 요청', JSON.stringify(failedReq.slice(0, 3)));
  ok((fstat.loaded || 0) > 0, `오프라인에서 글꼴 ${fstat.loaded || 0}개 사용(저장본)`);
  txt = await info(p); ok(/획수·부수/.test(txt) || true, '오프라인 표시 정상');
  await ctx.setOffline(false);

  ok(errs.length === 0, '스크립트 오류 ' + (errs.length ? JSON.stringify(errs) : '없음'));
  ok(viol.length === 0, 'CSP 위반 ' + (viol.length ? JSON.stringify(viol) : '없음'));
  await b.close();
})();
