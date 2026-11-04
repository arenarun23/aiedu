// 허브 빌드·점검 공용 보안 도구: apps.json 검증, git 인증(토큰을 URL/인자에 넣지 않음), 가져온 폴더 정리
import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const COLORS = ['pink', 'sky', 'orange', 'mint', 'lemon', 'lilac', 'peach'];
// 허브 루트에서 쓰는 이름은 서비스 id 로 쓸 수 없다
export const RESERVED_IDS = ['fonts', 'assets', 'static', 'api', 'well-known', 'icons'];
// 서비스 저장소에서 가져오더라도 배포하지 않는 내부 파일(보고용 문서·CI·에이전트 지시문·설정)
export const DEFAULT_EXCLUDE = ['.github', '.claude', '.vscode', '.gitignore', '.gitattributes', '.env',
  'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'README.md', 'vercel.json', 'package.json', 'package-lock.json', 'node_modules'];
export const MAX_APP_BYTES = 60 * 1024 * 1024;   // 서비스 하나당 배포 용량 상한
export const MAX_APP_FILES = 3000;

const fail = (m) => { throw new Error('apps.json 검증 실패: ' + m); };
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

export function validateApps(apps) {
  if (!Array.isArray(apps)) fail('최상위가 배열이 아닙니다');
  const ids = new Set();
  apps.forEach((a, i) => {
    const w = `#${i + 1}(${a && a.id})`;
    if (!a || typeof a !== 'object') fail(w + ' 객체가 아닙니다');
    if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(a.id || '')) fail(`${w} id 는 영문 소문자·숫자·하이픈(31자 이하)`);
    if (RESERVED_IDS.includes(a.id)) fail(`${w} 예약된 id 입니다`);
    if (ids.has(a.id)) fail(`${w} id 가 중복입니다`); ids.add(a.id);
    if (!isStr(a.name, 40)) fail(`${w} name`);
    if (a.desc != null && !isStr(a.desc, 100)) fail(`${w} desc`);
    if (a.icon != null && !isStr(a.icon, 8)) fail(`${w} icon`);
    if (a.color != null && !COLORS.includes(a.color)) fail(`${w} color 는 ${COLORS.join('/')}`);
    if (a.enabled != null && typeof a.enabled !== 'boolean') fail(`${w} enabled 는 true/false`);
    const hasRepo = a.repo != null, hasUrl = a.url != null;
    if (hasRepo === hasUrl) fail(`${w} repo 와 url 중 정확히 하나만 필요합니다`);
    if (hasRepo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(a.repo)) fail(`${w} repo 형식(owner/name)`);
    if (hasUrl) { let u; try { u = new URL(a.url); } catch { fail(`${w} url 형식`); } if (u.protocol !== 'https:') fail(`${w} url 은 https 만 허용`); }
    if (a.ref != null && (!/^[A-Za-z0-9._\/-]+$/.test(a.ref) || a.ref.startsWith('-') || a.ref.includes('..'))) fail(`${w} ref 형식`);
    if (a.exclude != null) {
      if (!Array.isArray(a.exclude)) fail(`${w} exclude 는 배열`);
      for (const x of a.exclude) if (!isStr(x, 120) || x.startsWith('/') || x.includes('..') || x.includes('\\') || x.includes('\0')) fail(`${w} exclude 항목 "${x}"`);
    }
  });
  return apps;
}

// 토큰을 clone URL·명령줄 인자에 넣지 않고 환경변수 기반 git 설정(헤더)으로 전달 → 오류 로그·프로세스 목록에 노출되지 않는다
export function gitEnv(token) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' };
  if (token) {
    const b64 = Buffer.from(`x-access-token:${token}`).toString('base64');
    Object.assign(env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${b64}` });
  }
  return env;
}

// 가져온 폴더에서 심볼릭 링크 제거(허브 밖 파일 노출 방지), 파일 수·용량 상한 확인
export function sanitizeTree(dir) {
  let bytes = 0, files = 0, links = 0;
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name), st = lstatSync(p);
      if (st.isSymbolicLink()) { rmSync(p, { force: true }); links++; continue; }
      if (st.isDirectory()) { walk(p); continue; }
      files++; bytes += st.size;
    }
  })(dir);
  if (files > MAX_APP_FILES) throw new Error(`파일이 너무 많습니다(${files}개)`);
  if (bytes > MAX_APP_BYTES) throw new Error(`용량이 너무 큽니다(${(bytes / 1048576).toFixed(1)}MB)`);
  return { bytes, files, links };
}
