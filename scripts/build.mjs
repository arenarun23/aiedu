// apps.json 의 enabled 앱을 dist 에 배치한다.
//  - repo 가 있으면 GitHub 저장소를 빌드 때 가져와 dist/<id>/ 로 복사
//  - url 이 있으면 외부 주소로 바로 연결(가져오지 않음)
// 보안: apps.json 검증, 내부 파일(DEFAULT_EXCLUDE) 제외, 심볼릭 링크 제거, 용량 상한, 토큰은 환경변수 헤더로만 전달
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_EXCLUDE, gitEnv, sanitizeTree, validateApps } from './lib.mjs';

const all = validateApps(JSON.parse(readFileSync('apps.json', 'utf8')));
const apps = all.filter(a => a.enabled !== false);
const env = gitEnv(process.env.GITHUB_TOKEN);   // 비공개 저장소용(선택)
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const shas = {};
for (const a of apps) {
  if (a.url) { console.log('↗', a.id, a.url); continue; }
  const tmp = mkdtempSync(join(tmpdir(), a.id + '-'));
  const args = ['clone', '--depth', '1', '-q', '--no-tags', ...(a.ref ? ['-b', a.ref] : []), '--', `https://github.com/${a.repo}.git`, tmp];
  try { execFileSync('git', args, { stdio: ['ignore', 'inherit', 'inherit'], env }); }
  catch { throw new Error(`${a.id}: 저장소를 가져오지 못했습니다(${a.repo})`); }   // 명령줄/토큰을 오류에 싣지 않는다
  shas[a.id] = execFileSync('git', ['-C', tmp, 'rev-parse', 'HEAD']).toString().trim(); // 배포된 버전 기록
  rmSync(join(tmp, '.git'), { recursive: true, force: true });
  for (const x of [...DEFAULT_EXCLUDE, ...(a.exclude ?? [])]) rmSync(join(tmp, x), { recursive: true, force: true });
  const s = sanitizeTree(tmp);
  cpSync(tmp, join('dist', a.id), { recursive: true, dereference: false });
  console.log('✔', a.id, `(${s.files}개, ${(s.bytes / 1048576).toFixed(1)}MB${s.links ? `, 링크 ${s.links}개 제거` : ''})`);
}
writeFileSync('dist/apps.json', JSON.stringify(
  apps.map(a => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, color: a.color, href: a.url || `${a.id}/`, sha: shas[a.id] })), null, 2));
