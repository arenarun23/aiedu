// 이용 기록(log)·관리자 API 공용 도구. 외부 패키지 없이 Node 내장 기능만 쓴다.
import crypto from 'node:crypto';

export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const hmacHex = (key, msg) => crypto.createHmac('sha256', String(key)).update(String(msg)).digest('hex');

// 길이가 달라도 시간 차이로 정보를 흘리지 않는 비교
export function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  if (A.length !== B.length) { crypto.timingSafeEqual(A, A); return false; }
  return crypto.timingSafeEqual(A, B);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// 본문을 상한(바이트)까지만 읽는다. 초과하면 null.
export async function readBody(req, max = 4096) {
  if (req.body !== undefined && req.body !== null) {      // Vercel 이 이미 해석한 경우
    const s = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    return Buffer.byteLength(s) > max ? null : s;
  }
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) return null; chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseJson(s) {
  try { const v = JSON.parse(s); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

export const clampInt = (v, lo, hi) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

// 한국 표준시(KST) 날짜 문자열 YYYY-MM-DD
export function kstDay(ts) {
  const d = new Date(ts + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
export const daysAgo = (n, now = Date.now()) => kstDay(now - n * 86400000);

// User-Agent 에서 기기 종류·OS·브라우저만 뽑는다. 원문 UA 는 저장하지 않는다(지문 정보 최소화).
export function parseUA(ua = '') {
  ua = String(ua).slice(0, 400);
  let os = '기타', device = '기타';
  const m = (re) => (ua.match(re) || [])[1];
  if (/Android/i.test(ua)) { os = 'Android ' + (m(/Android\s([\d.]+)/i) || '').split('.')[0]; device = /Mobile/i.test(ua) ? '폰' : '태블릿'; }
  else if (/iPad/i.test(ua)) { os = 'iPadOS'; device = '태블릿'; }
  else if (/iPhone|iPod/i.test(ua)) { os = 'iOS ' + (m(/OS\s(\d+)[_\d]*/i) || ''); device = '폰'; }
  else if (/CrOS/i.test(ua)) { os = 'ChromeOS'; device = '노트북/PC'; }
  else if (/Windows/i.test(ua)) { os = 'Windows'; device = '노트북/PC'; }
  else if (/Macintosh|Mac OS X/i.test(ua)) { os = 'macOS'; device = '노트북/PC'; }
  else if (/Linux/i.test(ua)) { os = 'Linux'; device = '노트북/PC'; }
  let browser = '기타', ver = '';
  if (/SamsungBrowser/i.test(ua)) { browser = '삼성 인터넷'; ver = m(/SamsungBrowser\/(\d+)/i); }
  else if (/Edg(e|A|iOS)?\//i.test(ua)) { browser = 'Edge'; ver = m(/Edg(?:e|A|iOS)?\/(\d+)/i); }
  else if (/OPR\/|Opera/i.test(ua)) { browser = 'Opera'; ver = m(/OPR\/(\d+)/i); }
  else if (/Firefox|FxiOS/i.test(ua)) { browser = 'Firefox'; ver = m(/(?:Firefox|FxiOS)\/(\d+)/i); }
  else if (/Chrome|CriOS/i.test(ua)) { browser = 'Chrome'; ver = m(/(?:Chrome|CriOS)\/(\d+)/i); }
  else if (/Safari/i.test(ua)) { browser = 'Safari'; ver = m(/Version\/(\d+)/i); }
  return { device, os: os.trim(), browser: (browser + (ver ? ' ' + ver : '')).trim() };
}

// 숫자·영문·하이픈 같은 안전한 문자만 남긴다(관리자 화면·CSV 로 나가는 값의 마지막 방어선)
export const safeTok = (s, max = 24) => String(s || '').replace(/[^A-Za-z0-9가-힣 ._-]/g, '').slice(0, max);

// 응답 헬퍼(모든 응답: 캐시 금지)
export function respond(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  if (body === undefined || body === null) { res.end(); return; }
  if (typeof body === 'string') { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(body); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
