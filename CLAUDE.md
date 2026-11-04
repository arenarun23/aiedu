# AIEDU 허브

유아·초등 저학년용 놀이 서비스 6개(flagmap·hangul·hanja·calcul·word·game)를 모은 허브 사이트. 이 저장소는 허브이고, 서비스는 각자 저장소다.

작업 전에 스킬을 읽는다(`.claude/skills/`):
- `aiedu-hub` — 구조, 배포·자동 갱신, 화면 대응, 점검(**시작점**)
- `aiedu-services` — 서비스 6개 각각의 내용과 수정 시 주의점
- `add-service` — 서비스 추가/제거 절차

핵심 규칙: 앱은 정적·상대경로, `apps.json` 으로만 서비스를 등록, main push → Vercel 자동 배포, 화면은 **여러 크기에서 한 화면에 맞는지** `node scripts/fit-check.mjs` 로 확인, Deploy Hook 주소·Secret 값은 파일에 쓰지 않는다.
