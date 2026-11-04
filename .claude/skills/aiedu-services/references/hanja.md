# hanja — 한자 찾기

- 저장소 `arenarun23/hanja` · 파일: `index.html`(약 40KB), `sw.js`(오프라인 서비스 워커), `dict/`(런타임 사전), `source/`(원본·라이선스), `scripts/build-data.mjs`·`build-unihan.mjs`, `package.json`(`npm run build:data`), `icons/`, `manifest.webmanifest`, `vercel.json`.
- 기능: 필기/음성으로 낱말을 입력 → 한자·훈음·**획수·부수**·같은 글자가 쓰인 말을 보여 줌(큰 글자 `#big` + `#pic` + `#reading`). 입력 모드 `漢字`/`한글` 전환, 버튼 ✍️필기·🎙️녹음·⏹중지, ⚙️ 설정(읽기 속도·소리 크기·글씨 색). 급수(8급 50자·7급 100자·6급 150자, 한국어문회 기준) 한자 지원. 화면 구석에 빌드 확인용 `버전 MM/DD HH:MM` 라벨이 있다(수정 때 갱신).
- **사전 데이터(`dict/`)**
  - `chars.json`(255KB): 한자 7,374자 → 훈·음. `grades.json`·`levels.json`: 급수와 글자별 흔한 정도(0~8). `strokes.json`(123KB): 한자 → `[획수, 부수 글자]`(7,374자 전부).
  - `words-core.json`(1.4MB, 압축 후 0.47MB) + `words-rest.json`(3.9MB, 압축 후 1.5MB): 한글 → 한자어. **합치면 예전 `words.json`(184,080 표제·235,433 한자어)과 키·순서까지 같다.** core = 한자어의 글자 급수 평균 ≥ 6(`CORE_SCORE`), 8~6급 한자 300자로 된 낱말 18,026개는 전부 core.
  - 출처: libhangul `hanja.txt`(BSD-3, `source/LICENSE-hanja-data.txt`) + 급수(Hugging Face `rycont/hanja-grade` 정리본) + 유니코드 Unihan(획수·부수, Unicode License V3, `source/LICENSE-unihan.txt`, 추린 원본 `source/unihan-subset.txt`).
  - 재생성: `npm run build:data`(chars·words-core·words-rest), `node scripts/build-unihan.mjs [Unihan_IRGSources.txt]`(strokes). Unihan 원본은 https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip.
- **로딩 방식**: 시작 때 chars·words-core·grades·levels·strokes 를 읽고(압축 후 약 0.63MB), 화면이 열린 뒤 idle 시간에 `ensureRest()` 가 `words-rest` 를 합친다(`RELIDX`·`REV` 색인은 합칠 때 초기화). `lookup()` 은 핵심에서 못 찾았거나 **부분 일치만** 되면 나머지가 합쳐질 때까지 기다렸다가 다시 찾는다. `WD`(낱말)를 훑는 새 코드는 합쳐지기 전에도 동작해야 한다.
- **오프라인(`sw.js`)**: 설치 때 앱·핵심 사전·글꼴 CSS 저장 → 이후 인터넷 없이 열림. HTML·manifest·sw.js 는 네트워크 우선(고치면 바로 반영), `dict/*` 는 저장본 먼저+뒤에서 갱신(ETag 확인), 글꼴 woff2 는 저장본 우선(쓴 글자 조각만). 저장은 `e.waitUntil` 로 끝까지 마친다. `dict/` 에 새 파일을 추가하면 `sw.js` 의 `CORE` 에도 넣고, 저장 구조를 바꿀 때만 `VERSION` 을 올린다. 외부(구글 필기 인식) 요청은 건드리지 않는다. 한계: 오프라인에서 처음 보는 글자의 글꼴 조각은 없어 기기 기본 글꼴로 표시되며, 필기·음성 인식은 인터넷이 필요하다.
- 허브 `exclude`: `source/hanja.txt`, `source/levels.json`, `source/unihan-subset.txt`, `scripts` (**`source/LICENSE-*` 는 배포에 남긴다**). 배포 약 6MB.
- 인식: 필기 = 구글 입력도구(`itc` 로 한자 필기 모드, `app=hanja`), 음성 = Web Speech API. 펜 색 선택은 `localStorage('hanja-ink')`.
- 시험: 허브 `scripts/security/` 도구와 같은 방식으로 로컬 서버(허브 `dist` + 앱 덮어쓰기)에서 — (1) `lookup('학교')`→`#big` 이 學校, 결과 패널에 `획수·부수`, (2) 나머지에만 있는 낱말(예: 가가방→假家房)이 합쳐지기 전 조회돼도 올바로 나옴, (3) 서비스 워커 활성 후 `context.setOffline(true)` 로 새로고침해도 조회 가능.
