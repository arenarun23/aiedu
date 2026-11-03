// apps.json 의 enabled 앱을 dist 에 배치한다.
//  - repo 가 있으면 GitHub 저장소를 빌드 때 가져와 dist/<id>/ 로 복사
//  - url 이 있으면 외부 주소로 바로 연결(가져오지 않음)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const apps = JSON.parse(readFileSync('apps.json', 'utf8')).filter(a => a.enabled !== false);
const token = process.env.GITHUB_TOKEN; // 비공개 저장소용(선택)
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const shas = {};
for (const a of apps) {
  if (a.url || !a.repo) { console.log('↗', a.id, a.url ?? ''); continue; }
  const tmp = mkdtempSync(join(tmpdir(), a.id + '-'));
  const url = `https://${token ? token + '@' : ''}github.com/${a.repo}.git`;
  const args = ['clone', '--depth', '1', '-q', ...(a.ref ? ['-b', a.ref] : []), url, tmp];
  execFileSync('git', args, { stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
  shas[a.id] = execFileSync('git', ['-C', tmp, 'rev-parse', 'HEAD']).toString().trim(); // 배포된 버전 기록
  rmSync(join(tmp, '.git'), { recursive: true, force: true });
  for (const x of a.exclude ?? []) rmSync(join(tmp, x), { recursive: true, force: true });
  cpSync(tmp, join('dist', a.id), { recursive: true });
  console.log('✔', a.id);
}
writeFileSync('dist/apps.json', JSON.stringify(
  apps.map(a => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, color: a.color, href: a.url || `${a.id}/`, sha: shas[a.id] })), null, 2));
