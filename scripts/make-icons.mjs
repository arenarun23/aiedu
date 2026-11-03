// public/favicon.svg(둥근 원본)에서 파비콘·홈 화면 아이콘 PNG/ICO 를 만든다. 사용: node scripts/make-icons.mjs
// 산출: favicon-32.png, favicon.ico, apple-touch-icon.png(180, 꽉 찬 배경), icon-192/512.png(투명 모서리), icon-maskable-512.png(꽉 찬 배경)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const round = readFileSync('public/favicon.svg', 'utf8');
const full = round.replace(/(<rect[^>]*?)rx="\d+"/, '$1rx="0"');
const b = await chromium.launch(); const p = await b.newPage();
async function out(svg, size, file, transparent) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:transparent"><img style="width:${size}px;height:${size}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `public/${file}`, omitBackground: transparent });
}
await out(round, 32, 'favicon-32.png', true);
await out(round, 192, 'icon-192.png', true);
await out(round, 512, 'icon-512.png', true);
await out(full, 180, 'apple-touch-icon.png', false);
await out(full, 512, 'icon-maskable-512.png', false);
await b.close();
// ICO: 헤더(6) + 항목(16) + PNG 데이터
const png = readFileSync('public/favicon-32.png');
const dir = Buffer.alloc(22);
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);      // reserved, type=icon, count=1
dir[6] = 32; dir[7] = 32; dir[8] = 0; dir[9] = 0;                               // 폭, 높이, 색 수, 예약
dir.writeUInt16LE(1, 10); dir.writeUInt16LE(32, 12);                            // planes, bpp
dir.writeUInt32LE(png.length, 14); dir.writeUInt32LE(22, 18);                   // 크기, 데이터 위치
writeFileSync('public/favicon.ico', Buffer.concat([dir, png]));
console.log('done');
