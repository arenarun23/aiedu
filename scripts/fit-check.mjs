// 화면 크기별 넘침(스크롤) 측정 도구. 사용: node scripts/fit-check.mjs <URL> [--shots 폴더] [--click "#버튼,#버튼2"]
// 예) node scripts/fit-check.mjs http://localhost:8080/ --shots /tmp/shots
//     node scripts/fit-check.mjs http://localhost:8080/word/ --click "#btnGo,#bPen"
// playwright 는 클라우드 환경에 설치되어 있다(require 가능). 세로넘침 0px 이어야 "한 화면에 들어옴".
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const url = args[0]; if (!url) { console.error('URL 을 주세요'); process.exit(1); }
const opt = n => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; };
const shots = opt('--shots'); const clicks = (opt('--click') || '').split(',').filter(Boolean);
if (shots) mkdirSync(shots, { recursive: true });
const sizes = [['태블릿가로 1280x560',1280,560],['태블릿가로 1280x620',1280,620],['큰화면 1920x1000',1920,1000],['노트북 1366x650',1366,650],
  ['태블릿세로 800x1280',800,1280],['폰세로 390x780',390,780],['폰세로 360x640',360,640],['폰가로 800x360',800,360]];
const b = await chromium.launch();
for (const [name, w, h] of sizes) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  for (const c of clicks) { await p.click(c); await p.waitForTimeout(700); }
  const r = await p.evaluate(() => ({ over: Math.max(0, document.documentElement.scrollHeight - innerHeight), hs: document.documentElement.scrollWidth > innerWidth }));
  console.log(name.padEnd(22), '세로넘침', r.over + 'px', '가로스크롤', r.hs, errs.length ? errs : '');
  if (shots) await p.screenshot({ path: `${shots}/${w}x${h}.png` });
  await p.close();
}
await b.close();
