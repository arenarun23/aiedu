// 모든 서비스를 무작위로 조작하면서 CSP 위반·스크립트 오류를 수집한다. 사용: node monkey.js <기본URL> [반복횟수]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8870/';
const ITER = Number(process.argv[3] || 70);
const apps = ['', 'flagmap/', 'hangul/', 'hanja/', 'calcul/', 'word/', 'game/'];
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

(async () => {
  const b = await chromium.launch();
  let total = 0;
  for (const a of apps) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 620 } });
    await ctx.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' <- ' + e.blockedURI));
    });
    const p = await ctx.newPage();
    const cons = [], errs = [];
    p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) cons.push(t.slice(0, 160)); });
    p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    const url = BASE + a;
    await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(800);
    let steps = 0;
    for (let i = 0; i < ITER; i++) {
      if (a && !p.url().startsWith(url.replace(/\/$/, ''))) await p.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const r = rnd();
      try {
        if (r < 0.15) {
          const cv = await p.$('canvas');
          if (cv) {
            const bx = await cv.boundingBox();
            if (bx && bx.width > 20) {
              await p.mouse.move(bx.x + bx.width * .3, bx.y + bx.height * .3);
              await p.mouse.down();
              for (let k = 1; k <= 6; k++) await p.mouse.move(bx.x + bx.width * (.3 + .07 * k), bx.y + bx.height * (.3 + .05 * k));
              await p.mouse.up();
              steps++;
            }
          }
        } else if (r < 0.3) {
          const inp = await p.$('input[type=text],input:not([type]),textarea');
          if (inp && await inp.isVisible()) {
            await inp.fill(['사과', '학교', '7', '12', 'ㄱ', '<img src=x onerror=1>'][Math.floor(rnd() * 6)]);
            await inp.press('Enter');
            steps++;
          }
        } else {
          const els = await p.$$('button:not([disabled]),[role=tab],.chip,.gc,.tool,a[href]:not(.aiedu-home)');
          const vis = [];
          for (const e of els) { if (await e.isVisible().catch(() => false)) vis.push(e); }
          if (vis.length) {
            const e = vis[Math.floor(rnd() * vis.length)];
            const href = await e.getAttribute('href').catch(() => null);
            if (href && /^https?:/.test(href)) continue;
            await e.click({ timeout: 700 }).catch(() => {});
            steps++;
          }
        }
      } catch (e) { /* 무시 */ }
      await p.waitForTimeout(120);
    }
    const csp = await p.evaluate(() => window.__csp).catch(() => []);
    const uniq = [...new Set([...csp, ...cons])];
    total += uniq.length;
    console.log((a || '허브(/)').padEnd(10), '조작', String(steps).padStart(3), '회 | CSP 위반', uniq.length, uniq.length ? JSON.stringify(uniq.slice(0, 4)) : '', '| 스크립트 오류', errs.length ? JSON.stringify(errs.slice(0, 2)) : '없음');
    await ctx.close();
  }
  console.log('총 CSP 위반 종류:', total);
  await b.close();
})();
