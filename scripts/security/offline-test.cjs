// 오프라인·버전 갱신 시험: node offline-test.cjs <주소> [dist폴더(갱신 시험용)]
// 각 서비스를 열어 저장이 끝나길 기다린 뒤 인터넷을 끊고 다시 열어 화면이 뜨는지, 학생 기록(localStorage)이 유지되는지 확인한다.
// dist 폴더를 주면 한 서비스의 파일을 바꿔 새 버전이 받아지고 예전 저장본이 지워지는지도 확인한다.
const { chromium } = require('playwright');
const fs = require('fs');
const base = process.argv[2].replace(/\/?$/, '/');
const dist = process.argv[3];
const SVC = [['', '허브'], ['flagmap/', '국기'], ['hangul/', '한글'], ['hanja/', '한자'], ['calcul/', '셈'], ['word/', '끝말'], ['game/', '게임']];
let bad = 0;
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) bad++; };
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ serviceWorkers: 'allow' });
  const errs = [];
  for (const [p, name] of SVC) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(name + ': ' + e.message));
    await pg.goto(base + p, { waitUntil: 'load' });
    await pg.evaluate(() => { try { localStorage.setItem('student-test-' + location.pathname, 'keep'); } catch (e) {} });
    // 서비스 워커 활성 + 저장 완료 대기(최대 40초)
    if (p === 'hanja/') await pg.waitForTimeout(12000);   // 한자: 나머지 사전을 합친 뒤 저장(자체 서비스 워커)
    const ready = await pg.evaluate(async () => {
      const t = Date.now();
      while (Date.now() - t < 40000) {
        const regs = await navigator.serviceWorker.getRegistrations();
        const r = regs.find(r => r.active && r.scope.endsWith(location.pathname.replace(/[^/]*$/, '')));
        if (r && r.active.state === 'activated') return true;
        await new Promise(r => setTimeout(r, 300));
      }
      return false;
    });
    ok(ready, name + ' 서비스 워커 활성');
    await pg.close();
  }
  await ctx.setOffline(true);
  for (const [p, name] of SVC) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(name + '(오프라인): ' + e.message));
    const failed = [];
    pg.on('requestfailed', r => { const u = r.url(); if (u.startsWith(base) && !u.includes('/api/') && !(p === 'hanja/' && (u.endsWith('/aiedu-log.js') || u.endsWith('words-rest.json')))   ) failed.push(u.replace(base, '')); });
    try { await pg.goto(base + p, { waitUntil: 'load', timeout: 15000 }); } catch (e) { ok(false, name + ' 오프라인 열기 실패: ' + e.message.slice(0, 60)); await pg.close(); continue; }
    const len = await pg.evaluate(() => document.body.innerText.length);
    const fonts = await pg.evaluate(() => document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'error').length));
    const keep = await pg.evaluate((k) => localStorage.getItem(k), 'student-test-/' + p);
    ok(len > 5, name + ' 오프라인 화면 표시 (글자 ' + len + ')');
    ok(keep === 'keep', name + ' 학생 기록 유지');
    ok(failed.length === 0, name + ' 오프라인 요청 실패 없음' + (failed.length ? ' → ' + failed.slice(0, 4).join(', ') : ''));
    await pg.close();
  }
  await ctx.setOffline(false);
  ok(errs.length === 0, '스크립트 오류 없음' + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  // 버전 갱신 시험: word 의 파일 하나를 바꾸고 sw.js 를 새로 만든 뒤(=배포 흉내) 열기
  if (dist) {
    const cnt = async (pg) => pg.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('aiedu-word-')));
    const pg = await ctx.newPage();
    await pg.goto(base + 'word/', { waitUntil: 'load' });
    const before = await cnt(pg);
    const f = dist + '/word/index.html';
    fs.appendFileSync(f, '\n<!-- v2 -->');
    const sw = dist + '/word/sw.js';
    let s = fs.readFileSync(sw, 'utf8'); const m = s.match(/const VERSION = '([^']+)'/);
    fs.writeFileSync(sw, s.replace(m[1], 'newver' + Date.now().toString(36)));
    await pg.reload({ waitUntil: 'load' });
    await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('/word/'); await r.update(); });
    let after = before;
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); after = await cnt(pg); if (after.length === 1 && after[0] !== before[0]) break; }
    ok(before.length === 1 && after.length === 1 && after[0] !== before[0], '새 버전 받고 예전 저장본 삭제: ' + before + ' → ' + after);
    const keep = await pg.evaluate(() => localStorage.getItem('student-test-/word/'));
    ok(keep === 'keep', '갱신 뒤에도 학생 기록 유지');
    const others = await pg.evaluate(async () => (await caches.keys()).filter(k => !k.startsWith('aiedu-word-')).length);
    ok(others >= 5, '다른 서비스 저장본은 그대로 (' + others + '개)');
  }
  await br.close();
  console.log(bad ? `\n✘ 실패 ${bad}` : '\n✔ 모두 통과');
  process.exit(bad ? 1 : 0);
})();
