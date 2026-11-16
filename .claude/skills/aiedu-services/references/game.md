# game — 놀이터 게임 모음

- 저장소 `arenarun23/game` · 한 페이지 안에서 게임을 고르는 미니게임 모음. 게임 6개: 색칠하기, 점 잇기, 짝 맞추기, 다른 것 찾기, 두더지 잡기, 분류하기. 허브에는 11-04 합류(`apps.json` id `game`, 🎮, peach).
- 구조(저장소 README 기준): `index.html`(화면 틀: 상단 바 + `#stage`), `css/style.css`(공통, rem+clamp), `js/core.js`(화면 전환·소리·별·결과 창·처음 화면의 카테고리 탭+카드), `js/games/<id>.js`(게임 하나당 파일), `js/main.js`(시작), `favicon.svg`, `manifest.webmanifest`(`start_url:"./"`).
- 게임 등록 방식: `G.register({ id, name, desc, icon, cat:'draw'|'match'|'play', color, start(root){ …; return 정리함수 } })`, 끝나면 `G.win({ stars:1~3, text })`. 새 게임은 `js/games/새게임.js` 작성 + `index.html` 에 `<script>` 추가(`main.js` 앞). 카테고리는 `js/core.js` 의 `G.cats`. 격자는 `.grid`(`--c`,`--r`).
- 이미지는 이모지·SVG, 소리는 WebAudio — **외부 에셋·저작물 없음**. 원본 상용 앱의 이미지·소리·이름·코드를 가져오지 않는다(규칙·구조만 참고).
- 외부 의존: Google Fonts 만. 서버·키 없음.
- 자체 `CLAUDE.md` 와 `.github/workflows/notify-hub.yml` 이 있고, 저장소 Secret `HUB_DEPLOY_HOOK` 이 필요하다.
- 점검(2026-11-04): 단독 화면 8가지 크기 모두 세로 넘침 0px, 허브 `/game/` 새 탭 열기 오류 없음.
- 수정 시: 터치 버튼 ≥44px, `prefers-reduced-motion` 존중, 각 게임을 끝까지 플레이해 확인.
- **미로찾기(maze)** — 2026-11-07 단독 서비스 `arenarun23/miro` 에서 이 모음으로 옮겼다(허브 카드는 없앴고 `/miro/` 는 `/game/#maze` 로 리다이렉트: `vercel.json` `redirects`). 상세는 `references/miro.md`. 게임이 `noSub: true` 로 자기 메뉴를 쓰고(난이도 3단계·방해꾼·왼쪽 메뉴), 음악은 `G.mazeMusic`(레이싱 `G.music` 과 별개), `G.win({bonus})` 로 단계별 보너스 별을 준다.
- **큐브 맞추기(cube)** — 2026-11-16 추가(`js/games/cube.js`, `noSub: true`). 3×3×3 큐브를 CSS 3D 로 직접 그린다(외부 라이브러리 없음). 끌면 360도 회전, 면을 누르면 그 면이 돈다. 섞은 뒤 "알려 줘!" → 살짝 섞었으면 거꾸로 돌리기, 아니면 초보자용 7단계를 한 칸씩 안내(자동·뒤로). 풀이는 `G.cubeCore.solve`(무작위 1000판 시험 통과) — 고치면 다시 시험한다. 상세는 game 저장소 README.
