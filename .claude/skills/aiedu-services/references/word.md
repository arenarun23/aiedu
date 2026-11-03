# word — 끝말잇기 놀이터

- 저장소 `arenarun23/word` · 파일: `index.html`(약 61KB), `extra.txt`(보조 사전 약 5.2만 낱말, 없어도 동작), `build-extra.mjs`+`source/`(사전 생성용 — 허브 배포에서 제외), `vercel.json`(index 캐시 no-store, 허브에선 미사용), `README.md`.
- 캐릭터 **말랑이**(귤 마스코트 SVG 템플릿 `#mascotTpl`)와 끝말잇기. 모드: 말랑이 먼저/내가 먼저, 쉬워요/도전!.
- 입력 3가지: 키보드 / 🎙️ 말하기(Web Speech) / ✍️ 쓰기(구글 입력도구 필기). 💡 힌트(`#hints`). **"모르겠어·몰라·도와줘" 라고 하면 이어갈 낱말 3개를 추천**하고 말로도 읽어 줌(이모지 버튼).
- 규칙: 두음법칙(리→이, 이→리 등 `startsFor`), 사전에 없는 말도 첫 글자만 맞으면 격려하며 받음(두 글자 이상·중복만 거름), 말랑이가 이을 말이 없으면 아이 승리. 음성 인식은 자모 거리로 비슷한 낱말 자동 보정·"혹시 이 말?" 후보·두 번 실패하면 손글씨 안내.
- 낱말: `index.html` 안 `<script id="kidWords">`(쉬운 말 약 1,100개, 낱말 뒤 이모지)와 `extra.txt`(hunspell-ko 명사 어간 + 한자어, `node build-extra.mjs` 로 생성, 라이선스 `source/LICENSE-hunspell-ko.txt`).
- 구조: `.app > header.top / #home / #play(.colA, .colB) / #result`. 화면 맞춤: `html{font-size:clamp(13px,min(2.95vh,4.9vw),22px)}`, 가로 화면은 `.colA`(문제·대화) / `.colB`(입력·도구·필기판) 2단, 아주 낮은 화면(≤420px)은 글자 최소 10.5px.
- 점검 기준(2026-11-03): 시작·놀이·필기판 열림·결과 화면 모두 가로 태블릿(1280×560 등)·노트북·큰 화면·폰 가로·태블릿 세로에서 넘침 0px. **폰 세로에서 필기판을 열었을 때만 스크롤(약 190~220px, 허용)**.
- 수정 시 주의: 이 앱은 `word` 전용 세션에서도 기능이 추가된다(음성 보정·추천 등). push 전 `git fetch` 하고 충돌 시 양쪽 기능 모두 유지. CSS 의 `.tool`/`.entry`/`.hint`/`.quit` 는 아이 터치용으로 일부러 크게 만든 값이니 낮은 화면 규칙(미디어쿼리) 안에서만 줄일 것.
- 테스트 레시피: 로컬 서버로 연 뒤 `#btnGo`(시작) → 입력창 `#inp` 에 낱말 → `.ok-btn`, "모르겠어" 입력 시 `#hints button` 3개, `#bPen` 으로 필기판. `node scripts/fit-check.mjs <URL> --click "#btnGo,#bPen"`.
