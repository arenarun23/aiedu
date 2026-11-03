# 증상별 점검 순서

## 1. "앱을 고쳤는데 허브에 반영이 안 돼요"
1. **배포본 vs 최신 비교**
   ```bash
   curl -s "https://aiedu-pearl.vercel.app/apps.json?t=$(date +%s)" | python3 -c "import sys,json;[print(a['id'],a['sha'][:7]) for a in json.load(sys.stdin)]"
   git -C /home/user/<앱> fetch -q origin main && git -C /home/user/<앱> rev-parse --short FETCH_HEAD
   ```
   같으면 허브는 최신 → 브라우저 캐시(새로고침/캐시 삭제) 문제.
2. 다르면 그 앱 저장소 Actions 에서 **Notify hub** 실행이 있는지 확인(`gh api repos/arenarun23/<앱>/actions/runs?per_page=5`).
   - 실행이 없다 → 워크플로 파일(`.github/workflows/notify-hub.yml`)이 없거나 main 이 아닌 브랜치에 push.
   - 실행은 있고 로그의 `HOOK:` 가 비어 있다 → **Secret `HUB_DEPLOY_HOOK` 누락**(건너뛴 것). 사용자에게 등록 요청.
   - `HOOK: ***` 이고 `{"job":{... "state":"PENDING"` 가 나온다 → 훅 호출 성공. Vercel Deployments 에서 빌드 오류 확인.
3. 급하면 수동 재배포: 허브 `sync-apps.yml` 을 dispatch (`gh api -X POST repos/arenarun23/aiedu/actions/workflows/sync-apps.yml/dispatches -f ref=main`). 변경을 감지하면 훅을 호출한다.
4. 빌드가 실패하면 이전 배포가 유지되고(사이트는 안 사라짐) 5분마다 재시도한다 → Vercel Deployments 의 빌드 로그 확인(`apps.json` JSON 문법 오류, 앱 저장소 접근 불가 등).

## 2. 서비스가 허브에서 열리지 않거나 깨짐
- 하위 경로(`/<id>/`)에서만 깨지면 앱이 **절대경로(`/foo.js`)** 를 쓰는지 확인(상대경로여야 함). `fetch('dict/chars.json')` 같은 상대경로는 정상.
- 용량 큰 폴더(원본 데이터)는 `apps.json` 의 `exclude` 로 뺀다(hanja: source/scripts/package.json, word: source/build-extra.mjs/vercel.json). **앱이 런타임에 쓰는 파일(dict/, extra.txt)은 빼면 안 된다.**
- 앱 저장소의 `vercel.json`(캐시 헤더)은 허브 배포에 쓰이지 않는다(허브 쪽 기본 캐시: 정적 파일 재검증).

## 3. 허브 화면이 잘리거나 겹침
- `node scripts/fit-check.mjs <URL> --shots /tmp/shots` 로 8개 크기 측정 + 캡처. 0px 가 아니면 `references/layout-and-testing.md` 의 튜닝 지점 참고.
- 카드 수가 바뀌면 `--cols/--k` 가 자동 재계산된다. 새 규칙을 넣을 때는 4개·5개 카드 둘 다 측정.

## 4. 삼성 인터넷 등에서 새 창이 안 뜸
- 코드는 `target="_blank" rel="noopener"`. 먼저 시크릿 모드/캐시 삭제로 확인, 홈 화면 바로가기(PWA) 모드면 주소창 있는 일반 탭에서 비교.
- 계속되면 카드 클릭 핸들러에서 `window.open(href,'_blank','noopener')` 후 `null` 이면 `location.href` 폴백.

## 5. GitHub 예약 실행이 안 돈다
- 정상 범주다(지연·누락). 즉시 알림 경로(앱 저장소 notify-hub)가 살아 있으면 문제없다. 예약 실행 기록: `gh api "repos/arenarun23/aiedu/actions/runs?per_page=5" --jq '.workflow_runs[]|"\(.created_at) \(.event) \(.conclusion)"'`.
