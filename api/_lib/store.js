// 저장소 어댑터. 운영: Upstash Redis(REST, 마켓플레이스 연결 시 환경변수 자동 설정). 시험: 메모리.
// 모든 명령은 [ 'HSET', key, f, v ... ] 형태의 배열이고, exec(cmds) 가 결과 배열을 돌려준다.

export function restConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;   // 읽기·쓰기 토큰(읽기 전용 토큰 아님)
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function createRestStore(cfg) {
  return {
    kind: 'upstash',
    async exec(cmds) {
      if (!cmds.length) return [];
      const r = await fetch(cfg.url + '/pipeline', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds),
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) throw new Error('store ' + r.status);
      const out = await r.json();
      return out.map((x) => { if (x.error) throw new Error('store: ' + String(x.error).slice(0, 80)); return x.result; });
    },
  };
}

// ---- 메모리 저장소(자동 시험·로컬 확인용). 사용하는 명령만 구현 ----
export function createMemoryStore(now = () => Date.now()) {
  const data = new Map();      // key -> {type, v, exp}
  const alive = (k) => { const e = data.get(k); if (!e) return null; if (e.exp && e.exp <= now()) { data.delete(k); return null; } return e; };
  const get = (k, type, init) => { let e = alive(k); if (!e) { if (!init) return null; e = { type, v: init(), exp: 0 }; data.set(k, e); } return e; };
  const run = (c) => {
    const [op, key, ...a] = c; const O = String(op).toUpperCase();
    switch (O) {
      case 'INCR': { const e = get(key, 's', () => '0'); e.v = String(Number(e.v) + 1); return Number(e.v); }
      case 'EXPIRE': { const e = alive(key); if (!e) return 0; if (String(a[1] || '').toUpperCase() === 'NX' && e.exp) return 0; e.exp = now() + Number(a[0]) * 1000; return 1; }
      case 'GET': { const e = alive(key); return e ? e.v : null; }
      case 'SET': { data.set(key, { type: 's', v: String(a[0]), exp: 0 }); return 'OK'; }
      case 'DEL': { let n = 0; for (const k of [key, ...a]) if (data.delete(k)) n++; return n; }
      case 'HSET': { const e = get(key, 'h', () => ({})); let n = 0; for (let i = 0; i < a.length; i += 2) { if (!(a[i] in e.v)) n++; e.v[a[i]] = String(a[i + 1]); } return n; }
      case 'HSETNX': { const e = get(key, 'h', () => ({})); if (a[0] in e.v) return 0; e.v[a[0]] = String(a[1]); return 1; }
      case 'HINCRBY': { const e = get(key, 'h', () => ({})); e.v[a[0]] = String(Number(e.v[a[0]] || 0) + Number(a[1])); return Number(e.v[a[0]]); }
      case 'HGETALL': { const e = alive(key); if (!e) return []; return Object.entries(e.v).flat(); }
      case 'SADD': { const e = get(key, 'set', () => new Set()); let n = 0; for (const m of a) if (!e.v.has(String(m))) { e.v.add(String(m)); n++; } return n; }
      case 'SCARD': { const e = alive(key); return e ? e.v.size : 0; }
      case 'LPUSH': { const e = get(key, 'l', () => []); for (const m of a) e.v.unshift(String(m)); return e.v.length; }
      case 'LTRIM': { const e = alive(key); if (e) e.v = e.v.slice(Number(a[0]), Number(a[1]) + 1); return 'OK'; }
      case 'LRANGE': { const e = alive(key); if (!e) return []; const end = Number(a[1]); return e.v.slice(Number(a[0]), end === -1 ? undefined : end + 1); }
      case 'ZADD': { const e = get(key, 'z', () => new Map()); e.v.set(String(a[1]), Number(a[0])); return 1; }
      case 'ZREM': { const e = alive(key); return e && e.v.delete(String(a[0])) ? 1 : 0; }
      case 'ZREVRANGE': { const e = alive(key); if (!e) return []; const arr = [...e.v.entries()].sort((x, y) => y[1] - x[1]).slice(Number(a[0]), Number(a[1]) + 1); return String(a[2] || '').toUpperCase() === 'WITHSCORES' ? arr.flatMap(([m, s]) => [m, String(s)]) : arr.map(([m]) => m); }
      case 'ZREMRANGEBYSCORE': { const e = alive(key); if (!e) return 0; let n = 0; for (const [m, s] of e.v) if (s >= Number(a[0]) && s <= Number(a[1])) { e.v.delete(m); n++; } return n; }
      case 'ZCARD': { const e = alive(key); return e ? e.v.size : 0; }
      case 'SCAN': { const pat = String(a[1] === 'MATCH' ? a[2] : '*').replace(/\*/g, '.*'); const re = new RegExp('^' + pat + '$'); const keys = [...data.keys()].filter((k) => alive(k) && re.test(k)); return ['0', keys]; }
      default: throw new Error('메모리 저장소: 지원하지 않는 명령 ' + O);
    }
  };
  return { kind: 'memory', data, async exec(cmds) { return cmds.map(run); } };
}

let cached = null;
export function getStore(env = process.env) {
  if (cached) return cached;
  if (env.LOG_STORE === 'memory') return (cached = createMemoryStore());
  const cfg = restConfig(env);
  return cfg ? (cached = createRestStore(cfg)) : null;
}
export const _resetStoreForTests = () => { cached = null; };
