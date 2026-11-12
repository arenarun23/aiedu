// 오프라인용 서비스 워커(sw.js) 생성. 허브와 서비스 폴더마다 하나씩, scripts/sw-template.js 로 만든다.
// - 서비스 저장소가 자체 sw.js 를 가지고 있으면(한자) 건드리지 않는다.
// - 버전 = 파일 목록·내용의 해시. 서비스가 바뀌면 sw.js 가 바뀌고, 브라우저가 열 때마다 확인해 새 버전을 받는다.
// - 글꼴은 서비스가 쓰는 ../fonts/*.css 를 읽어 woff2 까지 목록에 넣는다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const walk = (dir, skip = () => false, base = dir) => {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const rel = relative(base, p).split(sep).join('/');
    if (skip(rel)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, skip, base)); else out.push(rel);
  }
  return out.sort();
};

// html 이 쓰는 글꼴 CSS → 그 CSS 가 부르는 woff2 (모두 /fonts/ 절대경로)
function fontsOf(distDir, htmlRels) {
  const css = new Set();
  for (const h of htmlRels) {
    const t = readFileSync(join(distDir, h), 'utf8');
    for (const m of t.matchAll(/href="(?:\.\.\/|\/)?fonts\/([a-z0-9-]+\.css)"/g)) css.add(m[1]);
  }
  const out = new Set();
  for (const c of [...css].sort()) {
    const f = join('dist', 'fonts', c);
    if (!existsSync(f)) continue;
    out.add('/fonts/' + c);
    for (const m of readFileSync(f, 'utf8').matchAll(/url\(([a-z0-9._-]+\.woff2)\)/g)) out.add('/fonts/' + m[1]);
  }
  return [...out];
}

export function makeSw(id, dir, { skip = () => false } = {}) {
  if (id !== 'hub' && existsSync(join(dir, 'sw.js'))) return { id, own: true };
  const files = walk(dir, (r) => r === 'sw.js' || skip(r));
  const fonts = fontsOf('dist', files.filter((f) => f.endsWith('.html')).map((f) => join(dir === 'dist' ? '' : id, f)));
  const shared = id === 'hub' ? [] : ['aiedu-log.js', 'aiedu-sw.js'].filter((f) => existsSync(join('dist', f))).map((f) => '/' + f);
  const h = createHash('sha256');
  for (const f of files) { h.update(f + '\0'); h.update(readFileSync(join(dir, f))); }
  h.update(fonts.join('\n'));
  for (const f of shared) h.update(readFileSync(join('dist', f.slice(1))));
  const version = h.digest('hex').slice(0, 12);
  const tpl = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
  const sw = tpl.replaceAll('__ID__', id).replaceAll('__VERSION__', version)
    .replace('__FILES__', JSON.stringify(files)).replace('__FONT_FILES__', JSON.stringify(fonts)).replace('__SHARED__', JSON.stringify(shared));
  writeFileSync(join(dir, 'sw.js'), sw);
  return { id, version, files: files.length, fonts: fonts.length };
}
