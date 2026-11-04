---
name: aiedu-hub
description: AIEDU 허브 사이트(유아·초등 저학년 놀이 서비스 모음) 전체 구조와 운영 방법. 허브 화면 수정, 배포·자동 갱신, 화면 크기 대응, 아이콘, 장애/갱신 안 됨 점검, 다른 세션에서 작업 이어받기 등 AIEDU 허브와 관련된 모든 작업의 시작점. "AIEDU", "허브", "aiedu-pearl", "apps.json", "자동 갱신", "반영이 안 돼" 같은 말이 나오면 먼저 읽는다.
---

# AIEDU 허브 — 이어받기 가이드

유아·초등 저학년용 정적 웹앱 6개를 한 곳에서 보여 주는 허브. 서비스는 자주 추가/삭제된다.

## 한눈에
| 항목 | 값 |
|---|---|
| 허브 저장소 | `arenarun23/aiedu` (main 에 push → Vercel 자동 배포) |
| 허브 주소 | https://aiedu-pearl.vercel.app |
| 서비스 6개 | flagmap(국기) · hangul(한글 쓰기) · hanja(한자 찾기) · calcul(소리셈) · word(끝말잇기) · game(게임 모음) — 각각 `arenarun23/<이름>` 저장소. 자세히는 `aiedu-services` 스킬 |
| 호스팅 | Vercel (Hobby), 프로젝트 `aiedu`. 허브 저장소를 연결해 push 마다 배포 |
| 서비스 추가/제거 | `add-service` 스킬 (또는 `apps.json` 직접 수정) |

## 구조 (어떻게 동작하나)
```
apps.json ──(빌드: scripts/build.mjs)──> dist/
   각 항목의 repo 를 git clone --depth 1 → dist/<id>/ 로 복사 (.git·exclude 제거)
   dist/apps.json 에 각 앱의 배포 커밋(sha)·href 기록
public/  (허브 화면: index.html, 아이콘, manifest) ──> dist/ 로 복사
```
- 서비스는 허브 도메인 아래 **하위 경로**로 서비스된다: `/flagmap/`, `/word/` … (앱은 상대경로만 써야 한다. 모두 정적 파일이라 빌드 불필요)
- 항목에 `url` 이 있으면 가져오지 않고 그 주소로 바로 연결(따로 배포된 서비스용).
- 허브 화면은 `apps.json`(배포된 dist/apps.json)을 fetch 해서 카드를 그린다. 카드는 **새 탭**(`target=_blank rel=noopener`)으로 열린다.
- Vercel 설정은 `vercel.json`(buildCommand `npm run build`, output `dist`). Node ≥ 20.

## 자동 갱신 (앱을 고치면 허브가 알아서 갱신)
두 겹으로 되어 있다.
1. **즉시**: 앱 저장소의 `.github/workflows/notify-hub.yml` 이 main push 때 허브의 Vercel **Deploy Hook**(`apps-updated`)을 POST → 20~60초 안에 허브 재배포.
   - 필요: 각 앱 저장소 Secret `HUB_DEPLOY_HOOK` (값 = Vercel aiedu > Settings > Git > Deploy Hooks 의 주소). **Secret 이 없으면 워크플로는 "건너뜁니다"로 조용히 성공 처리**되므로 로그의 `HOOK:` 값이 `***` 인지 본다.
   - 허브+앱 5개 저장소는 등록 확인됨(2026-11-03). `game` 저장소는 Secret 등록 여부를 첫 push 의 Actions 로그(`HOOK: ***`)로 확인할 것.
2. **안전망**: 허브의 `.github/workflows/sync-apps.yml` 이 5분마다 `scripts/check-updates.mjs` 실행 → 배포된 `apps.json` 의 sha 와 각 앱의 최신 커밋(`git ls-remote`) 비교, 다르면 Deploy Hook 호출(종료코드 10 = 갱신 필요). 허브 저장소에도 `HUB_DEPLOY_HOOK` 필요, 선택 변수 `SITE_URL`.
   - **GitHub 예약(cron) 실행은 신뢰할 수 없다**: 만든 뒤 85분 동안 한 번도 안 돈 적이 있다. 즉시 알림(1번)이 주력, 2번은 보조.
- 훅 주소는 비밀번호처럼 취급: 파일·커밋·로그에 적지 않는다.
- 새 앱을 추가하면 그 앱 저장소에 `templates/notify-hub.yml` 복사 + Secret 등록(사용자 몫) → `add-service` 스킬이 안내.

## 허브 화면 규칙 (public/index.html) — 깨뜨리지 말 것
- **한 화면에 맞추기가 핵심 요구**(태블릿 가로에서 잘림이 실제 문제였다). 기준 단위 `--u = min(1vw, 1.6vh × --k)`; 로고·카드·글자·여백이 `--u` 비례.
- JS 가 카드 수·방향으로 `--cols`, `--k` 를 계산(가로 최대 4열/세로·좁은 폭 2열, 행이 늘면 크기 배율 `--k` 감소). 5개 → 가로 3+2, 6개 → 3+3, 4개 → 한 줄.
- 낮은 화면(≤460px)은 카드 설명 숨김, 작은 폰 세로(≤700px)는 안내 문구 숨김. `prefers-reduced-motion` 은 애니메이션 끔.
- 색: pink · sky · orange · mint · lemon · lilac · peach (현재 사용: pink/sky/orange/mint/lilac/peach, 남은 색 lemon — 흰 글씨 대비가 낮아 주의). 카드 순서 = `apps.json` 순서.
- 검증: `node scripts/fit-check.mjs <URL>` (8가지 화면 크기에서 세로 넘침 측정). 현재 기준: 카드 4~6개에서 전부 0px, 360×640 만 4px(허용). 서비스 7개 이상은 작은 폰에서 스크롤이 생김(정상).
- 상세·튜닝 이력: `references/layout-and-testing.md`

## 허브 파비콘·홈 화면 아이콘
`public/favicon.svg`(웃는 별, 원본) → `node scripts/make-icons.mjs` 가 favicon-32.png · favicon.ico · apple-touch-icon.png · icon-192/512.png · icon-maskable-512.png 재생성. `manifest.webmanifest`(이름 AIEDU, standalone). 모양을 바꾸려면 SVG 만 고치고 스크립트 실행.

## 자주 쓰는 명령
```bash
cd /home/user/aiedu && npm run build                          # dist 생성(앱 clone 포함)
python3 -m http.server 8080 -d dist                           # 로컬 확인 (끝나면 pkill -f "http.server 8080")
node scripts/fit-check.mjs http://localhost:8080/             # 화면 크기별 넘침 측정
node scripts/check-updates.mjs                                # 배포본 vs 최신 비교(SITE_URL 로 대상 변경)
```
배포 확인: `curl -s https://aiedu-pearl.vercel.app/apps.json` 의 각 `sha` 가 앱 저장소 최신 커밋(앞 7자리)과 같으면 최신.

## 허브 복귀 아이콘 (모든 서비스 공통 규칙)
모든 서비스에는 AIEDU 허브로 돌아가는 **같은 모양의 아이콘**이 있다. 새 서비스에도 반드시 넣는다.
- **모양**: 웃는 별 캐릭터(분홍 별, 노랑·복숭아 원형 버튼, 44px). 집 모양이 아닌 이유: `word`·`game` 에 앱 안 🏠(처음 화면) 버튼이 이미 있어 헷갈리기 때문.
- **위치(통일)**: **페이지 왼쪽 위**, `left/top 8px`, `position:absolute`, `<body>` 바로 다음 첫 요소(컨테이너 안에 넣으면 좌표가 달라진다). 링크는 상대경로 `../`(허브 하위 경로에서 허브 첫 화면으로).
- **자리 비우기**: 아이콘이 다른 요소를 가리지 않게 앱마다 왼쪽 위 52×52px 를 비운다. 현재 방식: 제목 줄이 있는 앱은 `.top{padding-left:52px}`(calcul·word), game 은 `#bar{padding-left:calc(.7rem + 46px)}`, hangul/hanja 는 `.left h2{padding-left:52px}` + 좁은/낮은 화면에서 `.left{padding-top:52px}`, flagmap 은 상태 말풍선이 가운데라 별도 처리 없음. 필기판·캔버스 위에는 두지 않는다(아이가 글씨를 쓰다 실수로 누르는 것 방지).
- **원본 코드**: `templates/aiedu-home.html` (CSS + `<a>`). 아이콘 모양을 바꾸려면 이 파일과 6개 앱을 함께 고친다.
- **검증**: 8가지 화면 크기에서 (1) 아이콘 좌표가 모두 `8,8` 인지 (2) 다른 버튼·입력·제목과 겹치지 않는지 (3) 넘침이 수정 전과 같은지. 확인된 기준(2026-11-04): 6개 앱 모두 `8,8`, 겹침 없음(한글·한자의 `h2` 박스 겹침은 글자가 52px 비켜 있어 실제 겹침 아님), 넘침 변화 없음(`calcul` 시작 화면의 기존 스크롤은 별개).

## 여러 저장소를 한꺼번에 고칠 때 (사고 교훈 2026-11-04)
- **사고 1**: 다른 세션이 먼저 올린 변경과 내 변경이 충돌한 상태에서 `git stash pop` → `git add -A` → push 가 그대로 진행되어 `<<<<<<<` 표시가 `game` main 에 올라갔다(약 15초 후 정정). **충돌이 나면 멈추고, 충돌 표시를 지운 뒤 푸시한다. `git add -A` 는 충돌 파일을 "해결됨"으로 표시해 버린다.**
- **사고 2**: "내 CSS 줄 제거"를 `.aiedu-home` 가 들어간 줄 전체 삭제로 처리했다가, **내 CSS 가 뒤에 붙어 있던 원래 한 줄짜리 `<style>`**(calcul)까지 지워 숨김 규칙(`[hidden]{display:none!important}`)이 사라지고 화면이 크게 깨졌다. push 전 측정에서 잡았다. **자동 치환·삭제 후에는 HEAD 대비 삭제된 줄(`git diff HEAD -U0 | grep '^-'`)을 반드시 눈으로 확인한다.** 내 코드는 앱의 기존 줄 끝에 이어 붙이지 말고 별도 줄/블록으로 넣는다.
- **절차**: 저장소마다 `bash scripts/safe-push.sh <폴더> <메시지파일>` 로 커밋·push. 원격이 앞서 있거나, 충돌 표시·공백 오류가 있거나, unmerged 파일이 있으면 멈춘다. 멈추면 그 저장소만 따로 처리하고 나머지를 계속한다. `git stash` 로 우회하지 않는다.
- push 전에 측정(`scripts/fit-check.mjs`)과 눈으로 보기를 먼저 하고, push 후 `curl .../apps.json` 의 sha 로 허브 반영을 확인한다.

## 이 클라우드 환경에서의 주의 (겪은 문제)
- **작업 폴더**: 워커가 재시작되면 cwd 가 어긋나 `not a git repository` 가 난다. 항상 `cd /home/user/<저장소> && …` 로 시작. 쓰기 권한으로 붙인 저장소는 `/home/user/<이름>`, 읽기 전용은 `/home/user/arenarun23/<이름>`.
- 저장소는 `add_repo`(access=push) 로 붙이고, clone 은 한 번에 하나씩, 시간제한 넉넉히. push 전 `git fetch origin main`, 겹치면 rebase (word 에서 다른 세션이 먼저 push 해 충돌한 적 있음 → 같은 앱을 두 세션에서 동시에 고치지 말 것).
- `gh`: GraphQL 은 막힘 → `gh api` REST 사용. Actions **Secrets 조회는 차단**(로그의 `HOOK: ***` 로 간접 확인). 워크플로 수동 실행은 `gh api -X POST repos/arenarun23/<repo>/actions/workflows/<파일>.yml/dispatches -f ref=main` 로 가능.
- Vercel·GitHub **Secret 등록, Deploy Hook 생성, Vercel 프로젝트 삭제는 사용자가 직접** 해야 한다.
- 커밋 메시지 끝에 시스템이 지정한 Co-Authored-By / Claude-Session 줄을 넣는다(heredoc 사용).

## 미해결·결정 대기
- 삼성 인터넷에서 새 창이 안 뜨고 같은 창으로 이동한다는 제보: `target=_blank` 는 정상 코드. 캐시 또는 바로가기(PWA) 모드 의심. 시크릿 모드로 확인 요청한 상태(결과 미수신). 필요하면 클릭 시 `window.open` 폴백 추가.
- `hangul` 은 자체 Vercel 프로젝트(`hangul-xi-jet.vercel.app`)가 따로 있다. 허브는 쓰지 않으므로 사용자가 지워도 된다(미정).
- 앱 6개 모두 즉시 알림(notify-hub + Secret)으로 연결해 두었다. 새 앱도 같은 방식으로 연결할 것.

## 더 읽을 것
- `references/layout-and-testing.md` — 화면 대응·테스트 방법과 수치
- `references/history.md` — 결정 이력(왜 이렇게 했나)
- `scripts/safe-push.sh` — 저장소 커밋·push 안전 절차(충돌·원격 앞섬 감지)
- `references/troubleshooting.md` — "반영이 안 돼요" 등 증상별 점검 순서
- `aiedu-services` 스킬 — 서비스 5개 각각의 설명
- `add-service` 스킬 — 서비스 추가/제거 절차
