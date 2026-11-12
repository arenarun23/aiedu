// 오프라인 이용 기록 시험: node offline-log-test.cjs <주소>
// 인터넷이 끊긴 동안의 기록이 기기에 쌓였다가, 돌아오면 원래 시각(ts)과 함께 전송되고 지워지는지 확인한다. (/api/log 는 가로채 기록만 한다)
const { chromium } = require('playwright');
const base = process.argv[2].replace(/\/?$/, '/');
let bad = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) bad++; };
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ serviceWorkers: 'block' }); const pg = await ctx.newPage();
  let down = true; const got = [];
  await pg.route('**/api/log', (r) => { if (down) return r.abort('internetdisconnected'); got.push(JSON.parse(r.request().postData())); r.fulfill({ status: 204, body: '' }); });
  await pg.goto(base + 'game/', { waitUntil: 'load' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { aieduLog('start', 'memory'); aieduLog('finish', 'memory'); aieduLog('use', 'x'); });
  await pg.waitForTimeout(800);
  let q = await pg.evaluate(() => JSON.parse(localStorage.getItem('aiedu-log-q') || '[]'));
  ok(q.length >= 4 && q.every((x) => typeof x.ts === 'number' && /^[a-f0-9]{24}$/.test(x.d)), '끊긴 동안 기록이 기기에 쌓임 (' + q.length + '건: ' + q.map((x) => x.e).join(',') + ')');
  ok(!JSON.stringify(q).match(/ip|user-agent/i), '쌓인 기록에 IP·UA 없음');
  const t0 = q[0].ts;
  down = false;
  await pg.evaluate(() => window.dispatchEvent(new Event('online')));
  await pg.waitForTimeout(4000);
  q = await pg.evaluate(() => JSON.parse(localStorage.getItem('aiedu-log-q') || '[]'));
  ok(q.length === 0, '온라인이 되면 모두 전송하고 비움');
  ok(got.length >= 4 && got.some((x) => x.e === 'start' && x.g === 'memory' && x.ts === t0 + (got.find((y) => y.e === 'start').ts - t0)), '전송 내용에 원래 시각(ts) 포함 (' + got.length + '건)');
  ok(got.map((x) => x.ts).every((t) => t <= Date.now()), 'ts 가 미래가 아님');
  // 새로 열었을 때(이전에 못 보낸 기록이 남은 상태)도 전송
  down = true; await pg.evaluate(() => aieduLog('use', 'y')); await pg.waitForTimeout(600);
  down = false; got.length = 0; await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(4000);
  ok(got.some((x) => x.g === 'y' || x.e === 'use'), '다음에 열 때 남은 기록 전송');
  await br.close(); console.log(bad ? `\n✘ 실패 ${bad}` : '\n✔ 모두 통과'); process.exit(bad ? 1 : 0);
})();
