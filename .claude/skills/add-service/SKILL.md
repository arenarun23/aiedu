---
name: add-service
description: AIEDU 허브에 새 서비스(앱)를 추가하거나 제거·숨김 처리하고 자동 갱신까지 연결한다. "서비스 추가", "앱 추가", "허브에 등록", "서비스 빼줘", "숨겨줘" 같은 요청이나 새 서비스 저장소를 알려 줄 때 사용.
---

# AIEDU 서비스 추가/제거

허브는 `apps.json`에 적힌 서비스를 빌드 때 가져와 `/<id>/` 로 서비스한다.
`.github/workflows/sync-apps.yml` 이 5분마다 앱 저장소의 최신 커밋과 배포본을 비교해 다르면 자동 재배포한다.
(그래서 새 서비스에 Secret 을 따로 등록하지 않아도 5~10분 안에 갱신된다.)

## 추가
1. 사용자에게 확인한다(이미 알려 준 것은 다시 묻지 않는다).
   - 저장소 `owner/repo` (또는 따로 배포된 `url`) — 둘 중 하나
   - 이름, 설명(한 줄, 유아·초등 저학년 눈높이), 이모지 아이콘, 색
   - 색: pink · sky · orange · mint · lemon · lilac · peach (이미 쓴 색과 겹치지 않게 제안)
   - 앱이 정적 파일인지(빌드 불필요), 상대경로를 쓰는지 확인. 빌드가 필요한 앱이면 `repo` 방식은 불가 → 따로 배포 후 `url` 사용.
2. `apps.json` 에 한 줄 추가한다. `id` 는 영문 소문자(폴더명이 된다). 불필요하게 큰 폴더는 `exclude` 로 뺀다.
   ```json
   { "id": "새앱", "name": "이름", "desc": "설명", "icon": "🎨", "color": "lilac", "repo": "arenarun23/새앱", "enabled": true }
   ```
3. **보안 규칙 확인**(`aiedu-hub` 스킬 `references/security.md` 3절): 앱에 외부 호스트 호출(글꼴 CDN·외부 이미지·스크립트)이 없는지 `grep -nE "https?://" 앱/index.html` 로 보고, 글꼴은 `../fonts/*.css` 로 바꾼다. 허용되는 외부 주소는 `inputtools.google.com` 뿐.
4. `npm run build` 로 확인한다: 새 앱이 `✔` 로 나오고 `dist/<id>/index.html` 이 있어야 한다.
   로컬 서버(`python3 -m http.server -d dist`)로 허브 카드와 앱이 열리는지 본다.
5. 보안 시험: `scripts/security/net-audit.cjs` 와 `csp-monkey.cjs` 로 **외부 호스트 0 · CSP 위반 0** 확인(사용법은 `references/security.md` 4절).
6. 커밋·push 한다 (main). Vercel 이 자동 배포한다.
7. **허브 복귀 아이콘 확인**: 그 앱에 `a.aiedu-home` 이 없으면 `templates/aiedu-home.html` 의 CSS·링크를 넣고(`<body>` 첫 요소, 왼쪽 위 8px), 왼쪽 위 52×52px 를 비운다. 방법·검증은 `aiedu-hub` 스킬의 "허브 복귀 아이콘".
8. (선택) 즉시 반영이 필요한 앱: 그 앱 저장소에 `templates/notify-hub.yml` 을 `.github/workflows/notify-hub.yml` 로 복사해 push 하고,
   사용자에게 앱 저장소 Secret `HUB_DEPLOY_HOOK` 등록을 안내한다(Secret 은 사용자가 직접 등록해야 한다).
9. 결과를 보고한다: 추가한 앱, 반영 방식(자동 5~10분 / 즉시), 사용자가 해야 할 일이 있으면 그것만.

## 제거 / 숨김
- 숨김: 해당 줄에 `"enabled": false`. 완전 제거: 줄 삭제.
- 앱 저장소는 건드리지 않는다. 앱 저장소의 `notify-hub.yml` 은 남겨도 무해하다고 알려 준다.

## 주의
- 앱 저장소에 push 할 때는 `bash scripts/safe-push.sh <폴더> <메시지파일>` 를 쓴다(충돌·원격 앞섬 감지).
- 사용자의 Secret/훅 주소를 파일, 커밋, 로그에 쓰지 않는다.
- 비공개 저장소 앱은 Vercel 환경변수 `GITHUB_TOKEN` 이 필요하다고 안내한다.
- 카드가 5개 이상이면 낮은 화면에서 스크롤이 생길 수 있다. 추가 후 1280x560 등에서 넘침을 확인한다.
