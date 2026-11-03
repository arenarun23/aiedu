# flagmap — 세계 국기 친구들

- 저장소 `arenarun23/flagmap` · 파일: `index.html`(약 145KB, 데이터·스타일·스크립트 모두 포함), `manifest.webmanifest`(가로 고정 `orientation:landscape`), `icon-192/512.png`, `apple-touch-icon.png`, `icon.svg`. README 없음.
- 화면: 3칸 구조 — 국기 칸(`.flag-pane`), 이름 칸(`#namePane`), 설명 칸(`.desc-pane`). 첫 화면(`.welcome`)에 `canvas#globe`(440×440)로 **20초에 한 바퀴 도는 3D 지구본**(2D canvas 로 직접 그림, `cv.getContext('2d')`).
- 데이터: `const C = [ … ]` 나라 목록. 한 줄 = `['kr','대한민국','South Korea',['한국','남한','코리아'],'아이 눈높이 설명 문장']` (국가코드, 한국어 이름, 영어 이름, **음성으로 말했을 때 알아듣는 별칭 배열**, 설명). 나라를 추가하면 이 형식으로 넣는다. 국기 이미지는 `https://flagcdn.com` (`flagURL(code)`) — 외부 의존. 나라 고르기 화면에서 국기는 `object-fit:contain` 으로 잘리지 않게 표시.
- 음성: `speechSynthesis` 로 나라 이름·설명을 읽어 줌. 언어별 선택 음성을 `localStorage('voice_<언어앞2자>')` 에 저장. 알아들을 수 없거나 없는 나라를 말하면 **안내 음성**을 출력(최근 커밋).
- 최근 변경(2026-11-03): contain 표시, 3D 지구본 교체, 안내 음성, notify-hub 워크플로.
- 수정 시 주의: 가로 고정 앱이므로 **가로 화면 기준**으로 확인(1280×560 등). 세로에서도 깨지지 않게 최소 점검. 외부 국기 CDN 이 느리면 이미지가 늦게 뜰 수 있음.
