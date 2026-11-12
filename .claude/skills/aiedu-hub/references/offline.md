# 오프라인 지원 (2026-11-12)

허브와 서비스는 처음 한 번 인터넷으로 열면 이후 인터넷 없이도 열린다. **앱 저장소는 고치지 않는다** — 허브 빌드가 만든다.

## 동작
- `scripts/sw-gen.mjs` 가 빌드 때 허브(`dist/sw.js`)와 서비스마다(`dist/<id>/sw.js`) 서비스 워커를 `scripts/sw-template.js` 로 생성하고, 서비스 `index.html` 의 `</head>` 앞에 `<script src="../aiedu-sw.js"></script>` 를 넣는다(허브 첫 화면은 `public/index.html` 에 직접). 서비스가 자체 `sw.js` 를 가지고 있으면(한자) 건드리지 않는다.
- **버전 = 파일 목록·내용 해시**. 서비스가 바뀌면 `sw.js` 가 달라지고, 브라우저가 서비스를 열 때마다 `sw.js` 를 확인(`register` 후 `update()`, `Cache-Control: no-cache`)해 새 버전을 설치한다. 설치는 새 파일을 **모두** 받아야 성공하며(실패하면 기존 버전 유지), 활성화 때 이 서비스의 **예전 파일 저장본(`aiedu-<id>-<예전해시>`)을 삭제**한다.
- 저장 대상: 그 서비스 폴더 전체 + 공용 `aiedu-log.js`·`aiedu-sw.js` + 서비스가 쓰는 글꼴 CSS·woff2(`aiedu-fonts` 저장소에 공유, 이름이 고정이라 지우지 않음). 서비스를 **열 때** 그 서비스만 저장한다(허브는 허브 파일과 글꼴만).
- 응답: 네트워크 우선(3.5초), 실패하면 저장본. 목록에 없는 요청(`/api`, 외부 필기 인식)은 건드리지 않는다.
- **학생 기록 보호**: 서비스 워커는 localStorage·IndexedDB 에 접근하지 않는다. 지우는 것은 Cache Storage 의 `aiedu-<id>-` 로 시작하는 예전 파일 저장본뿐이다. 앱 저장 키(`miro:` 등)를 서비스 워커가 쓰는 캐시 이름과 겹치게 만들지 않는다.
- 한자는 자체 서비스 워커(`hanja/sw.js`, 사전 2단계·글꼴 조각 저장)를 그대로 쓴다. 단 `../aiedu-log.js` 는 오프라인에서 못 불러온다(기록 스크립트일 뿐이라 앱은 정상).

## 안 되는 것
필기 인식(구글)·음성 인식은 인터넷 필요. 이용 기록 전송은 오프라인이면 조용히 실패. 브라우저가 저장 공간 부족 시 저장본을 지울 수 있음(다시 온라인으로 열면 복구).

## 시험
```bash
env -u GITHUB_TOKEN npm run build
python3 scripts/security/header-server.py dist 8871 vercel.json &
NODE_PATH=$(npm root -g) node scripts/security/offline-test.cjs http://127.0.0.1:8871/ dist   # 7곳 오프라인 열기·학생 기록 유지·새 버전 시 예전 저장본 삭제(dist 를 바꾸므로 끝나면 재빌드)
NODE_PATH=$(npm root -g) node scripts/security/hanja-offline-test.cjs http://127.0.0.1:8871/hanja/
```
시험 서버는 끝나면 `kill $(pgrep -f 'header-serve[r]')`.
## 서비스를 추가할 때
따로 할 일 없음(빌드가 자동 처리). 서비스가 쓰는 파일이 `index.html` 에서 상대경로로 닿으면 목록에 포함된다. 글꼴은 `../fonts/*.css` 링크로 쓴다.
