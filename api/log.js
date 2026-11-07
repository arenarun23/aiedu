// POST /api/log — 이용 기록 수집(같은 출처의 우리 서비스만 호출). 로직은 _lib/log-core.js
import { handleLog } from './_lib/log-core.js';
import { getStore } from './_lib/store.js';
import { readBody, respond } from './_lib/util.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://local');
    const body = req.method === 'POST' ? await readBody(req, 2048) : null;
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const r = await handleLog({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body, ip, env: process.env, store: getStore(), now: Date.now() });
    respond(res, r.status, r.body, r.headers);
  } catch {
    respond(res, 204);   // 기록 실패가 서비스에 영향을 주지 않게 한다
  }
}
