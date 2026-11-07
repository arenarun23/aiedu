// 로컬 확인·시험용 서버: 정적 폴더 + /api/* 함수 + vercel.json 의 헤더 규칙을 그대로 적용한다.
//   LOG_STORE=memory LOGGING_ENABLED=1 ADMIN_LINK_TOKEN=... node scripts/dev-server.mjs dist 8900
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8900);
const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rules = (cfg.headers || []).map((r) => ({ rx: new RegExp('^' + r.source + '$'), headers: r.headers }));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown' };
const handlers = {
  '/api/log': (await import(pathToFileURL(path.resolve('api/log.js')).href)).default,
  '/api/admin': (await import(pathToFileURL(path.resolve('api/admin.js')).href)).default,
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  const applyRules = () => { for (const r of rules) if (r.rx.test(p)) for (const h of r.headers) res.setHeader(h.key, h.value); };
  req.headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || (process.env.DEV_HTTPS === '1' ? 'https' : 'http');
  if (handlers[p]) { applyRules(); return handlers[p](req, res); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { applyRules(); res.statusCode = 404; return res.end('Not found'); }
  applyRules(); res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('dev server', port));
