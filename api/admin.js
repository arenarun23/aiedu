// /api/admin?op=… — 관리자 API(비밀 링크로 얻은 쿠키가 있어야 함). 로직은 _lib/log-core.js
import { handleAdmin } from './_lib/log-core.js';
import { getStore } from './_lib/store.js';
import { readBody, respond } from './_lib/util.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://local');
    const body = req.method === 'POST' ? await readBody(req, 4096) : null;
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const r = await handleAdmin({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body, ip, env: process.env, store: getStore(), now: Date.now() });
    respond(res, r.status, r.body, r.headers);
  } catch {
    respond(res, 500, { ok: false });
  }
}
