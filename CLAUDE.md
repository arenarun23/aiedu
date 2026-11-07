# AIEDU 허브

유아·초등 저학년용 놀이 서비스 7개(flagmap·hangul·hanja·calcul·word·game·miro)를 모은 허브 사이트. 이 저장소는 허브이고, 서비스는 각자 저장소다.

작업 전에 스킬을 읽는다(`.claude/skills/`):
- `aiedu-hub` — 구조, 배포·자동 갱신, 화면 대응, 점검(**시작점**)
- `aiedu-services` — 서비스 6개 각각의 내용과 수정 시 주의점
- `add-service` — 서비스 추가/제거 절차

핵심 규칙: **이용 기록은 익명·최소(IP·입력 내용 미기록, 서버 스위치 `LOGGING_ENABLED` 기본 꺼짐)** 이고 관리자 비밀값(`ADMIN_LINK_TOKEN`)은 채팅·파일·커밋에 쓰지 않는다(`aiedu-hub` 스킬 `references/usage-log.md`), 빌드는 `env -u GITHUB_TOKEN npm run build`, **외부 호스트 호출 금지**(CSP 가 차단, 예외는 필기 인식 `inputtools.google.com` 하나 — 글꼴은 `../fonts/*.css`), 모든 서비스에 **허브 복귀 아이콘(웃는 별, 페이지 왼쪽 위)** 을 둔다(`aiedu-hub` 스킬), 저장소 push 는 `scripts/safe-push.sh`, 앱은 정적·상대경로, `apps.json` 으로만 서비스를 등록, main push → Vercel 자동 배포, 화면은 **여러 크기에서 한 화면에 맞는지** `node scripts/fit-check.mjs` 로 확인, Deploy Hook 주소·Secret 값은 파일에 쓰지 않는다.
