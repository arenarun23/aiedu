# hanja — 한자 찾기

- 저장소 `arenarun23/hanja` · 파일: `index.html`(약 38KB), `dict/`(런타임 사전), `source/`(원본 `hanja.txt`·`levels.json`·라이선스), `scripts/build-data.mjs`, `package.json`(`npm run build:data`), `icons/`, `manifest.webmanifest`, `vercel.json`(index 캐시 no-store).
- 기능: 필기/음성으로 낱말을 입력 → 한자·훈음·같은 글자가 쓰인 말을 보여 줌(큰 글자 `#big` + `#pic` + `#reading`). 입력 모드 `漢字`/`한글` 전환, 버튼 ✍️필기·🎙️녹음·⏹중지, ⚙️ 설정(읽기 속도·소리 크기·글씨 색). 급수(8급 50자·7급 100자·6급 150자, 한국어문회 기준) 한자 지원. 화면 구석에 빌드 확인용 `버전 MM/DD HH:MM` 라벨이 있다(수정 때 갱신).
- 데이터: libhangul `hanja.txt`(BSD-3, `source/LICENSE-hanja-data.txt`) → `node scripts/build-data.mjs` 가 `dict/chars.json`(한자→훈음) · `dict/words.json`(한글→한자어, 약 5.4MB) 생성. 급수 데이터 `dict/grades.json`(Hugging Face `rycont/hanja-grade` 정리본), `dict/levels.json`. 같은 소리의 한자어는 흔한 글자(쉬운 급수)가 많은 순으로 정렬.
- 앱은 시작 때 `fetch('dict/chars.json' · 'words.json' · 'grades.json' · 'levels.json')` (상대경로) — **허브 배포에서 `dict/` 를 빼면 안 됨**.
- 허브 `exclude`: `source`, `scripts`, `package.json` (배포 용량 12MB → 약 6MB).
- 인식: 필기 = 구글 입력도구(`itc` 로 한자 필기 모드, `app=hanja`), 음성 = Web Speech API. 펜 색 선택은 `localStorage('hanja-ink')`.
- 수정 시 주의: 사전 데이터를 바꾸면 반드시 `npm run build:data` 재생성 후 `dict/` 커밋. words.json 이 커서 첫 로딩이 느릴 수 있음(모바일).
