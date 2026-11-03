# AIEDU
유아·초등 저학년을 위한 놀이 서비스 모음 허브.

## 서비스 추가/제거
`apps.json` 만 고치고 push 하면 Vercel 이 자동 배포한다.
- 추가: 한 줄 추가 (`repo`: 빌드 때 가져올 GitHub 저장소 / `url`: 따로 배포된 외부 주소 — 둘 중 하나)
- 제거: 줄 삭제, 잠시 숨김은 `"enabled": false`
- `color`: pink · sky · orange · mint · lemon · lilac · peach
- 앱 저장소를 고친 뒤 반영은 허브 재배포(Vercel Redeploy 또는 `templates/notify-hub.yml` 자동화)
- 비공개 저장소 앱은 Vercel 환경변수 `GITHUB_TOKEN` 필요
