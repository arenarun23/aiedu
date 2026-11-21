# baduk — 꼬마 바둑 교실 ⚫

저장소 `arenarun23/baduk` · 허브 경로 `/baduk/` · **Vite + React + TypeScript 빌드 앱** (2026-11-20 추가)

## 기능
- 📚 배우기: 판다 선생님과 레슨 9개(바둑판과 돌 → 숨구멍 → 돌 잡기 → 단수 → 도망가기 → 이어진 돌 → 둘 수 없는 곳 → 패 → 따먹기 바둑). 직접 돌을 놓아 보고, 두 번 틀리면 정답 자리를 보여 줌.
- ✏️ 문제 풀기: 12문제(숨구멍 세기·잡기·단수·도망·착수 금지 ⭕❌), 순서 섞기, 첫 답으로 채점, 별 3개.
- 🎮 AI와 대국: 따먹기 바둑(1·3·5개 먼저 잡기), 바둑판 5·7·9·12·15줄(2026-11-21). 엔진은 가로·세로 줄 수(`w`,`h`)를 따로 다뤄 직사각형 판도 된다(목록 `BOARDS` 에 넣으면 바로 쓸 수 있음, 시험 포함). 호랑이 한 수 계산은 큰 판(14×15 측정)에서 최대 약 0.2초(PC 기준). 🐢 거북이(무작위) · 🐰 토끼(잡기·도망·단수 치기) · 🐯 호랑이(축 수읽기). 힌트·무르기·단수 도우미.
- 🖐️ 오목 놀이(2026-11-21, 홈 메뉴 4번째, 주소 `#/omok`): 12×12, 5개 이상 먼저 나란히면 승리(금수 없음), 🐢🐰🐯 AI(`src/engine/omok.ts`: 이기는 수·막는 수 → 5칸 창 점수로 공격+수비), 이긴 줄 노란 테두리, 힌트·무르기·4개 경고 도우미. 기록 `omokWins`, 이용 기록 태그 `omok-<레벨>`·`omok-kidwin|botwin|draw`.
- 효과음(Web Audio 합성, 소리 파일 없음), 🔊 읽어 주기(`speechSynthesis`), 진행 기록은 localStorage(`baduk-progress-v1`, `baduk-muted`).

## 허브에 들어가는 방식 (다른 앱과 다름)
- 허브는 정적 파일만 가져오므로, 앱 저장소의 `.github/workflows/hub-build.yml` 이 main push 때 시험·빌드 → `dist` 를 **`hub` 브랜치**에 강제 push(매번 새 커밋 하나) → 허브 Deploy Hook 호출(Secret `HUB_DEPLOY_HOOK` 있을 때).
- 허브 `apps.json` 은 `"ref": "hub"`. 허브의 배포 sha 는 `hub` 브랜치 커밋이고, 커밋 메시지에 원본 main 커밋이 적혀 있다(`build: <sha>`).
- `hub` 브랜치에는 `vercel.json`(`git.deploymentEnabled:false`)이 들어 있어 앱 저장소 Vercel 의 미리보기 배포를 막는다(허브 빌드는 vercel.json 을 자동 제외).
- **반영이 안 되면**: 앱 저장소 Actions 의 "Build for AIEDU hub" 실행 결과(시험 실패 시 hub 브랜치가 안 바뀜) → `hub` 브랜치 최신 커밋 → 허브 `apps.json` sha 순서로 본다.

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 복귀 아이콘(body 첫 요소), `../fonts/jua.css`, `../aiedu-log.js` |
| `src/engine/go.ts` · `ai.ts` | 바둑 규칙(숨구멍·따내기·착수 금지·패) · AI 3단계와 축 수읽기 |
| `src/engine/omok.ts` · `src/screens/Omok.tsx` | 오목 판정·AI · 오목 화면 |
| `src/data/lessons.ts` · `quiz.ts` · `steps.ts` | 레슨·문제(판은 글자 그림, 정답은 엔진이 계산) |
| `src/screens/*` | 홈·배우기·문제·대국 화면 (해시 주소 `#/learn/<id>`, `#/quiz`, `#/play`) |
| `src/lib/sound.ts` · `speech.ts` · `log.ts` | 효과음 · 읽어 주기 · 이용 기록 |

## 주의
- **다크 모드**(2026-11-21): 삼성 인터넷·크롬의 '웹 페이지 어둡게' 강제 다크가 흰 돌까지 검게 칠하던 문제 → 앱이 `<meta name="color-scheme" content="light dark">` + `prefers-color-scheme: dark` 색으로 직접 다크 모드를 지원해 강제 다크를 피함. 바둑판·돌·돌 아이콘 색은 모드와 무관하게 고정. 시험: Playwright `--blink-settings=forceDarkModeEnabled=true` + `colorScheme:'dark'` 에서 흰 돌 밝기(수정 전 28 → 후 245). 다른 앱도 강제 다크에서 흰 그림이 뒤집힐 수 있으니 같은 방법으로 점검.
- 이용 기록 태그: `lesson-<id>`, `quiz`, `quiz-star0~3`, `turtle|rabbit|tiger`, `kidwin|botwin|draw`, `omok-…` 만. 아이의 답은 보내지 않는다.
- 한 화면 맞춤: 가로 화면은 바둑판 왼쪽·설명 오른쪽 2열, 바둑판 크기는 화면 높이에 맞춤(`--reserve`, 세로가 긴 판은 `--ar`=가로/세로 비율만큼 폭을 줄임). 작은 폰 세로(높이 ≤700px)에서는 대국 설정의 AI 설명 한 줄을 숨김. 2026-11-20 측정: 8가지 크기 × 화면 7개(홈·목록·레슨·문제·대국 설정·9줄 대국 등)에서 360×640 대국 설정 2px 외 모두 0px.
- 시험: `npm test`(규칙·AI·모든 레슨/문제의 정답 존재 검사 57개). 문제를 추가하면 시험이 풀 수 있는지 확인한다.
