---
name: aiedu-services
description: AIEDU 허브에 들어 있는 서비스 6개(세계 국기 친구들 flagmap, 한글 쓰기 hangul, 한자 찾기 hanja, 소리셈 놀이터 calcul, 끝말잇기 놀이터 word, 놀이터 게임 모음 game) 각각의 기능·파일 구조·외부 의존·수정 시 주의점. 특정 서비스를 고치거나 새 서비스를 같은 방식으로 만들 때, 또는 "국기 앱", "한글 앱", "한자 앱", "계산 앱", "끝말잇기" 같은 말이 나오면 사용. 허브 전체 구조는 aiedu-hub 스킬.
---

# AIEDU 서비스 6개

공통 성격: 유아·초등 저학년용 **정적 웹앱**(서버·API 키 없음, `index.html` 중심), 한국어, 둥근 글꼴 Jua/Gowun Dodum, 큰 터치 버튼, 폰·태블릿 우선. 모두 `main` 에 push 하면 허브가 20~60초 안에 갱신(앱 저장소 Secret `HUB_DEPLOY_HOOK` + `.github/workflows/notify-hub.yml`).

| id | 이름 | 저장소 | 한 줄 설명 | 크기 | 상세 |
|---|---|---|---|---|---|
| flagmap | 세계 국기 친구들 🚩 | arenarun23/flagmap | 나라를 골라 국기·이름·설명을 보고 음성으로 듣는 놀이, 3D 지구본 | 0.4MB | references/flagmap.md |
| hangul | 한글 쓰기 가 | arenarun23/hangul | 손글씨·음성으로 한글 입력, 자모 풀이, 따라 쓰기 | 56KB | references/hangul.md |
| hanja | 한자 찾기 漢 | arenarun23/hanja | 필기·음성으로 낱말→한자·훈음·획수·부수·같은 글자가 쓰인 말, 오프라인 지원 | 13MB(배포 약 6MB) | references/hanja.md |
| calcul | 소리셈 놀이터 ➕ | arenarun23/calcul | 소리로 읽어 주는 더하기·빼기·구구단, 말·손글씨로 답 | 72KB | references/calcul.md |
| word | 끝말잇기 놀이터 🔤 | arenarun23/word | 말랑이와 끝말잇기, 말·손글씨·힌트·"모르겠어" 추천 | 0.9MB | references/word.md |
| game | 놀이터 게임 모음 🎮 | arenarun23/game | 한 페이지 안에서 고르는 미니게임 6종(색칠하기·점 잇기·짝 맞추기·다른 것 찾기·두더지 잡기·분류하기) | 92KB | references/game.md |
| miro | 미로찾기 🧩 | arenarun23/miro | 손가락으로 길을 그려 짝꿍(🐭→🧀 등 8가지)에게 가는 미로, 쉬움/어려움·힌트 | 약 60KB | references/miro.md |

허브 카드 문구·아이콘·색은 허브 `apps.json` 에 있다(앱 안 문구와 별개).

## 공통으로 알아 둘 것
- **하위 경로 배포**: 허브가 `/<id>/` 아래에 두므로 앱은 **상대경로만** 사용(`fetch('dict/chars.json')` OK, `/dict/…` NG). manifest `start_url:"./"`, `scope:"./"`.
- **외부 의존**(네트워크 필요): 글꼴·국기는 **자체 호스팅**이라 외부 의존 없음(허브 `/fonts/`, flagmap `flags/`). 필기 인식 = 구글 입력도구 비공식 엔드포인트 `https://inputtools.google.com/request?itc=ko-t-i0-handwrit` (hangul·hanja·word·calcul 일부), 음성 인식 = 브라우저 Web Speech API(크롬/엣지/삼성 인터넷/사파리), 음성 합성 = `speechSynthesis`. 비공식 API 는 막히거나 바뀔 수 있다 → 필기 인식이 갑자기 안 되면 이 엔드포인트부터 의심.
- **저장소 상태 저장**은 `localStorage`(try/catch 로 감쌈; 시크릿 모드 대비).
- 앱 수정 후: 로컬 서버로 열어 확인 → **여러 화면 크기에서 한 화면에 들어오는지**(`aiedu` 저장소의 `node scripts/fit-check.mjs <URL> --click "#시작버튼"`) → push → 허브 반영 확인(`aiedu-hub` 스킬의 troubleshooting).
- 같은 앱을 두 세션이 동시에 고치지 않는다. push 전 `git fetch origin main`, 필요하면 rebase.
- **이용 기록**: 모든 서비스는 `<head>` 에서 `../aiedu-log.js` 를 불러온다(열기·이용 시간 자동). 시작·종료 지점에서 `window.aieduLog && aieduLog('start'|'finish'|'use', 게임이름)` — **사용자 입력·나라 이름 등 내용은 절대 넘기지 않는다.** 규칙·설정은 `aiedu-hub` 스킬 `references/usage-log.md`.
- **허브 복귀 아이콘**: 모든 서비스는 같은 모양의 아이콘(`a.aiedu-home`, 웃는 별)을 **페이지 왼쪽 위**(`<body>` 첫 요소, 8px, 링크 `../`)에 둔다. 코드는 허브 저장소 `templates/aiedu-home.html`, 규칙·자리 비우는 방법은 `aiedu-hub` 스킬의 "허브 복귀 아이콘".
- 새 서비스를 만들 때 지킬 규칙: 정적 파일·상대경로, viewport meta, 화면 크기 비례(rem+clamp), 큰 터치 영역(≥44px, 아이용은 더 크게), `prefers-reduced-motion` 존중, 서버·키 없이 동작. 만든 뒤 허브 등록은 `add-service` 스킬.

## 허브에서의 배포 설정 (apps.json 항목)
```
flagmap  repo arenarun23/flagmap  color pink
hangul   repo arenarun23/hangul   color sky
hanja    repo arenarun23/hanja    color orange  exclude [source/hanja.txt, source/levels.json, source/unihan-subset.txt, scripts]   # source/LICENSE-* 는 배포에 남김
calcul   repo arenarun23/calcul   color mint
word     repo arenarun23/word     color lilac   exclude [source/ko-nouns.txt, build-extra.mjs]   # source/LICENSE-* 는 배포에 남김
game     repo arenarun23/game     color peach
miro     repo arenarun23/miro     color lemon
```
`exclude` 는 원본 데이터·빌드 스크립트를 배포에서 빼 용량을 줄이기 위한 것(런타임에 쓰는 `dict/`, `extra.txt` 는 반드시 포함).

## 로컬에서 앱 저장소 다루기 (이 클라우드 환경)
`add_repo`(access=push) 후 `/home/user/<이름>` 에 clone. 읽기만이면 `/home/user/arenarun23/<이름>`. 워커 재시작 후엔 `cd /home/user/<이름> && …` 로 시작.
