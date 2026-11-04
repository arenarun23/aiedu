// 각 서비스가 (1) 외부 호스트로 요청을 보내는지 (2) 자체 글꼴이 실제로 로드되는지 (3) 4xx/5xx 가 있는지 확인한다.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8880/';
const apps = [['허브', ''], ['flagmap', 'flagmap/'], ['hangul', 'hangul/'], ['hanja', 'hanja/'], ['calcul', 'calcul/'], ['word', 'word/'], ['game', 'game/']];
(async () => {
  const b = await chromium.launch();
  for (const [name, path] of apps) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 620 } });
    const p = await ctx.newPage();
    const hosts = {}, bad = [];
    const self = new URL(BASE).host;
    p.on('request', r => { const h = new URL(r.url()).host; if (h && h !== self && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) hosts[h] = (hosts[h] || 0) + 1; });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(BASE, '/')); });
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    if (name === 'flagmap') { await p.click('#browse').catch(() => {}); await p.waitForTimeout(800); }
    if (name === 'word') { await p.click('#btnGo').catch(() => {}); await p.waitForTimeout(600); }
    const info = await p.evaluate(async () => {
      await document.fonts.ready;
      const faces = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''));
      const imgs = [...document.images];
      return { loaded: [...new Set(faces)], nFaces: faces.length, imgs: imgs.length, brokenImgs: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
               family: getComputedStyle(document.body).fontFamily.slice(0, 60) };
    });
    console.log(name.padEnd(8), '| 외부 호스트:', Object.keys(hosts).length ? JSON.stringify(hosts) : '없음', '| 로드된 글꼴:', info.loaded.join(','), `(${info.nFaces}개)`, '| 이미지', info.imgs, '깨짐', info.brokenImgs, '| 4xx/5xx:', bad.length ? JSON.stringify(bad.slice(0, 3)) : '없음');
    await ctx.close();
  }
  await b.close();
})();
