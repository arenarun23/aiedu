// 배포된 허브의 apps.json(sha)과 각 앱 저장소의 최신 커밋을 비교한다.
// 다르면 exit 10 (워크플로가 Deploy Hook 을 호출), 같으면 exit 0.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const site = (process.env.SITE_URL || 'https://aiedu-pearl.vercel.app').replace(/\/$/, '');
const token = process.env.GITHUB_TOKEN; // 비공개 저장소용(선택)
const apps = JSON.parse(readFileSync('apps.json', 'utf8')).filter(a => a.enabled !== false && a.repo && !a.url);

let deployed = {};
try {
  const res = await fetch(`${site}/apps.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  for (const a of await res.json()) if (a.sha) deployed[a.id] = a.sha;
} catch (e) {
  console.log(`배포된 목록을 읽지 못했습니다(${e.message}) → 갱신이 필요한 것으로 봅니다.`);
}

const stale = [];
for (const a of apps) {
  const url = `https://${token ? token + '@' : ''}github.com/${a.repo}.git`;
  let latest = '';
  try {
    latest = execFileSync('git', ['ls-remote', url, a.ref || 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\s+/)[0];
  } catch { console.log(`⚠ ${a.id}: 저장소를 읽지 못했습니다 (건너뜀)`); continue; }
  const same = deployed[a.id] === latest;
  console.log(`${same ? '✔' : '↻'} ${a.id}  배포 ${deployed[a.id]?.slice(0, 7) ?? '없음'}  최신 ${latest.slice(0, 7)}`);
  if (!same) stale.push(a.id);
}
if (stale.length) { console.log(`갱신 필요: ${stale.join(', ')}`); process.exit(10); }
console.log('모두 최신입니다.');
