// 이용 기록 + 관리자 화면 종단 시험 (사용법·준비는 .claude/skills/aiedu-hub/references/usage-log.md 의 '시험')
//   node scripts/security/usage-log-e2e.cjs <기본URL(끝에 /)> <ADMIN_LINK_TOKEN 값> <스크린샷 폴더>
const { chromium } = require('playwright');
const BASE = process.argv[2], TOKEN = process.argv[3], SHOTS = process.argv[4];
let fails = 0;
const ok = (c, m) => { console.log((c ? '✔' : '✘') + ' ' + m); if (!c) fails++; };
const UA_TAB = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const bodies = [];   // 서버로 나간 모든 기록 본문
  const spy = async (page) => {
    await page.exposeFunction('__rec', (t) => { bodies.push(t); });
    await page.addInitScript(() => { const o = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u, d) { try { if (d instanceof Blob) d.text().then((t) => window.__rec(t)); } catch (e) { /* 무시 */ } return o(u, d); }; });
  };

  // ---------- 기기 A: 삼성 태블릿(울산, 시·도 코드 31) ----------
  const A = await b.newContext({ userAgent: UA_TAB, viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '31' } });
  const pa = await A.newPage(); await spy(pa);
  await pa.goto(BASE, { waitUntil: 'networkidle' }); await sleep(400);
  await pa.goto(BASE + 'word/', { waitUntil: 'networkidle' }); await sleep(400);
  await pa.click('#btnGo'); await sleep(700);
  await pa.fill('#inp', '내이름은홍길동').catch(() => {}); await pa.click('.ok-btn').catch(() => {}); await sleep(500);    // 아이가 입력한 내용(기록되면 안 됨)
  for (let i = 0; i < 4; i++) { await pa.mouse.click(300 + i * 20, 300); await sleep(300); }
  await sleep(2500);                                                        // 이용 시간(초) 쌓기
  await pa.evaluate(() => window.dispatchEvent(new Event('pagehide')));     // 남은 시간을 서버로 보냄
  await pa.goto(BASE + 'game/', { waitUntil: 'networkidle' }); await sleep(400);
  await pa.click('.card >> nth=0').catch(() => {}); await sleep(800);
  await pa.goto(BASE + 'game/#maze', { waitUntil: 'networkidle' }); await sleep(400);   // 미로찾기(game 안의 게임)
  await pa.click('.card >> nth=0').catch(() => {}); await sleep(800);

  // ---------- 기기 B: 아이폰(서울, 코드 11) ----------
  const B = await b.newContext({ userAgent: UA_PHONE, viewport: { width: 390, height: 780 }, extraHTTPHeaders: { 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '11' } });
  const pb = await B.newPage(); await spy(pb);
  await pb.goto(BASE + 'hanja/', { waitUntil: 'networkidle' }); await sleep(600);
  await pb.evaluate(() => lookup('학교')); await sleep(600);
  await pb.goto(BASE + 'flagmap/', { waitUntil: 'networkidle' }); await sleep(600);

  console.log('— 1) 서버로 나간 기록의 내용 점검 (' + bodies.length + '건)');
  ok(bodies.every((x) => x.length > 0), '모든 기록 본문을 읽을 수 있음(' + bodies.filter((x) => !x.length).length + '건 비어 있음)');
  const parsed = bodies.filter((x) => x.length).map((s) => JSON.parse(s));
  const allowedKeys = new Set(['d', 's', 'e', 'w', 'h', 't', 'a', 'g']);
  ok(parsed.length >= 10, '기록 ' + parsed.length + '건 발생');
  ok(parsed.every((p) => Object.keys(p).every((k) => allowedKeys.has(k))), '허용된 필드만 전송(' + [...new Set(parsed.flatMap((p) => Object.keys(p)))].join(',') + ')');
  ok(!bodies.join('').includes('홍길동') && !bodies.join('').includes('학교'), '아이가 입력한 내용(홍길동·학교)은 전송되지 않음');
  ok(parsed.every((p) => /^[a-f0-9]{24}$/.test(p.d)), '기기 번호는 무작위 24자리 16진수');
  const svcs = [...new Set(parsed.map((p) => p.s))].sort();
  ok(['flagmap', 'game', 'hanja', 'hub', 'word'].every((s) => svcs.includes(s)), '서비스 구분: ' + svcs.join(','));
  const evts = (s) => parsed.filter((p) => p.s === s).map((p) => p.e + (p.g ? ':' + p.g : ''));
  ok(evts('word').includes('start') && evts('word').includes('tick'), 'word: ' + evts('word').join(' '));
  ok(evts('game').some((e) => e.startsWith('start:')) && evts('game').includes('start:maze'), 'game 시작 + 게임 이름(미로 포함): ' + evts('game').join(' '));
  ok(evts('hanja').includes('use') && evts('flagmap').includes('use') === true || evts('flagmap').includes('open'), 'hanja/flagmap 사용 횟수: ' + evts('hanja').join(' '));

  // ---------- 관리자 ----------
  console.log('— 2) 관리자 접근');
  const adminCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await adminCtx.newPage();
  await ap.goto(BASE + 'admin/', { waitUntil: 'networkidle' }); await sleep(300);
  ok((await ap.textContent('#msg')).trim() === 'Not found' && await ap.isHidden('#app'), '비밀 링크 없이 열면 "Not found"만 보이고 아무것도 노출되지 않음');
  await ap.goto(BASE + 'admin/#' + 'x'.repeat(48), { waitUntil: 'commit' }); await sleep(1500);
  ok((await ap.textContent('#msg')).trim() === 'Not found' && !ap.url().includes('#'), '틀린 값: Not found + 주소창에서 값 즉시 제거');
  const cookiesBefore = (await adminCtx.cookies()).length;
  await ap.goto(BASE + 'admin/#' + TOKEN, { waitUntil: 'commit' }); await sleep(1800);
  ok(await ap.isVisible('#app'), '맞는 비밀 링크: 관리자 화면 표시');
  ok(!ap.url().includes(TOKEN) && !ap.url().includes('#'), '주소창에서 비밀 값이 즉시 사라짐(' + ap.url().replace(BASE, '/') + ')');
  const ck = (await adminCtx.cookies()).find((c) => c.name.includes('aiedu_admin'));
  ok(!!ck && ck.httpOnly && ck.sameSite === 'Strict', '쿠키: HttpOnly + SameSite=Strict (' + (ck && ck.name) + ')');
  ok(!(await ap.evaluate(() => document.cookie)).includes('aiedu_admin'), '자바스크립트로 쿠키를 읽을 수 없음');
  // 링크 없이 재방문해도 쿠키로 열림(로그인 화면 없음)
  const ap2 = await adminCtx.newPage(); await ap2.goto(BASE + 'admin/', { waitUntil: 'networkidle' }); await sleep(500);
  ok(await ap2.isVisible('#app'), '다음부터는 링크 없이 주소만으로 열림(쿠키 기억)');
  await ap2.close();

  console.log('— 3) 관리자 화면 내용');
  ok((await ap.textContent('#status')).includes('기록 켜짐') && (await ap.textContent('#status')).includes('저장소 연결됨'), '상태 표시: ' + (await ap.textContent('#status')));
  const kpi = await ap.textContent('#kpi'); ok(/하루최대기기수2/.test(kpi.replace(/\s/g, '')), '요약: 접속 기기 2대 (' + kpi.replace(/\s+/g, ' ').trim() + ')');
  const svcTable = await ap.textContent('#svcTable'); ok(/끝말잇기/.test(svcTable) && /미로/.test(svcTable) && /게임/.test(svcTable), '서비스별 합계 표에 서비스 이름 표시');
  await ap.screenshot({ path: SHOTS + '/admin-summary.png', fullPage: true });
  await ap.setViewportSize({ width: 390, height: 800 }); await sleep(300); await ap.screenshot({ path: SHOTS + '/admin-summary-phone.png', fullPage: false });
  ok(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '폰 크기에서 가로 스크롤 없음(표는 안쪽에서 스크롤)');
  await ap.setViewportSize({ width: 1280, height: 900 });
  await ap.click('[data-tab=devices]'); await sleep(600);
  const dev = await ap.textContent('#devTable');
  ok(/태블릿/.test(dev) && /Android 13/.test(dev) && /삼성 인터넷 24/.test(dev) && /울산/.test(dev), '기기 A: 태블릿·Android 13·삼성 인터넷·울산');
  ok(/폰/.test(dev) && /iOS 17/.test(dev) && /Safari 17/.test(dev) && /서울/.test(dev), '기기 B: 폰·iOS 17·Safari·서울');
  ok(!/(127\.0\.0\.1|::1|SM-X710|AppleWebKit)/.test(dev), '화면에 IP·원문 브라우저 정보가 없음');
  await ap.click('#devTable tbody tr:first-child'); await sleep(700);
  const det = await ap.textContent('#detail'); ok(/서비스/.test(det) && /시각/.test(det) && /열기/.test(det), '기기 상세: 서비스별 합계 + 시간순 행동');
  await ap.screenshot({ path: SHOTS + '/admin-devices.png', fullPage: true });
  const dl = await Promise.all([ap.waitForEvent('download'), ap.click('[data-tab=tools]').then(() => ap.click('#csv'))]);
  const csv = require('fs').readFileSync(await dl[0].path(), 'utf8'); ok(csv.startsWith('﻿기기ID') && csv.split('\r\n').filter(Boolean).length === 3, 'CSV 내보내기: 머리글 + 기기 2줄');

  console.log('— 4) 위조·주입 시도');
  const evil = await ap.evaluate(async () => {
    const r = [];
    for (const body of [{ d: 'a'.repeat(24), s: '<script>alert(1)</script>', e: 'open' }, { d: 'b'.repeat(24), s: 'word', e: 'use', g: '<img src=x onerror=alert(1)>' }, { d: 'c'.repeat(24), s: 'evil', e: 'open' }])
      r.push((await fetch('../api/log', { method: 'POST', body: JSON.stringify(body) })).status);
    return r;
  });
  ok(evil.every((s) => s === 204), '위조 요청은 오류 없이 조용히 무시됨(' + evil.join(',') + ')');
  const ev = await ap.evaluate(async () => (await (await fetch('../api/admin?op=devices')).json()).devices.length); ok(ev === 3, '위조 기록 중 유효한 형식 하나만 저장(기기 ' + ev + '대, 서비스 이름 위조는 거절)');
  const cross = await b.newContext(); const cp = await cross.newPage();
  const r1 = await cp.request.get(BASE + 'api/admin?op=devices'); ok(r1.status() === 404, '쿠키 없는 직접 호출: 404');
  const r2 = await cp.request.post(BASE + 'api/admin?op=login', { data: { k: 'wrong' } }); ok(r2.status() === 404 || r2.status() === 401, '다른 출처의 로그인 시도 거절(' + r2.status() + ')');
  await cross.close();

  console.log('— 5) 삭제·로그아웃');
  await ap.click('[data-tab=devices]'); await sleep(500);
  await ap.click('#devTable tbody tr:first-child'); await sleep(500);
  ap.once('dialog', (d) => d.accept());
  await ap.click('#detail button.danger'); await sleep(800);
  const left = await ap.evaluate(async () => (await (await fetch('../api/admin?op=devices')).json()).devices.length); ok(left === 2, '기기 삭제 후 목록: ' + left + '대');
  await ap.click('[data-tab=tools]'); await ap.fill('#confirm', '삭제'); await ap.click('#purge'); await sleep(800);
  const none = await ap.evaluate(async () => (await (await fetch('../api/admin?op=devices')).json()).devices.length); ok(none === 0, '전체 삭제 후 기기 0대');
  await ap.click('#logout'); await sleep(600);
  ok((await ap.textContent('#msg')).trim() === 'Not found', '로그아웃 후 화면 숨김');
  const after = await adminCtx.newPage(); await after.goto(BASE + 'admin/', { waitUntil: 'networkidle' }); await sleep(400);
  ok(await after.isHidden('#app'), '로그아웃 후 주소만으로는 열리지 않음');

  console.log('— 6) 끄기: 추적 안 함 설정·사용자 끄기');
  const D = await b.newContext({ viewport: { width: 800, height: 600 } });
  await D.addInitScript(() => { Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }); });
  const pd = await D.newPage(); let nD = 0; pd.on('request', (r) => { if (r.url().includes('/api/log')) nD++; });
  await pd.goto(BASE, { waitUntil: 'networkidle' }); await pd.goto(BASE + 'word/', { waitUntil: 'networkidle' }); await sleep(500);
  ok(nD === 0, '"추적 안 함" 설정이 켜진 브라우저는 기록을 보내지 않음(' + nD + '건)');
  await D.close();
  const E = await b.newContext({ viewport: { width: 800, height: 600 } }); const pe = await E.newPage(); let nE = 0; pe.on('request', (r) => { if (r.url().includes('/api/log')) nE++; });
  await pe.goto(BASE + 'privacy.html', { waitUntil: 'networkidle' }); await pe.click('#toggle'); await sleep(200);
  ok((await pe.textContent('#state')).includes('보내지 않습니다'), '안내 페이지에서 끄기: ' + (await pe.textContent('#state')));
  ok(await pe.evaluate(() => !localStorage.getItem('aiedu-did')), '끄면 기기 번호도 함께 삭제');
  await pe.goto(BASE + 'word/', { waitUntil: 'networkidle' }); await sleep(500);
  ok(nE === 0, '끈 기기는 서비스를 열어도 기록을 보내지 않음(' + nE + '건)');
  await E.close();

  console.log(fails ? '\n실패 ' + fails + '건' : '\n전체 통과');
  await adminCtx.close(); await A.close(); await B.close(); await b.close();
  process.exitCode = fails ? 1 : 0;
})();
