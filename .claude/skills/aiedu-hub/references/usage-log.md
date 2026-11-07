# 이용 기록(익명)과 관리자 페이지

기기별 접속·활동 기록을 모아 **비밀 링크로만 열리는 관리자 페이지**에서 보는 기능(2026-11-07 추가). 정적 사이트였던 허브에 **서버 함수 2개와 저장소**가 생겼으므로 보안·개인정보 규칙을 꼭 지킨다.

## 구성
```
브라우저(서비스 7개 + 허브)                    Vercel 함수                         저장소(Upstash Redis)
  <head> aiedu-log.js ──sendBeacon──▶ POST /api/log  ──검증·제한──▶ 기기·일별 집계·이벤트 (90일 후 자동 삭제)
관리자 /admin/#비밀값 ──fetch──▶ /api/admin?op=…  (쿠키 검증) ──▶ 같은 저장소 읽기
```
- `public/aiedu-log.js`: 서비스가 `<head>` 에서 `<script src="../aiedu-log.js"></script>`(허브 첫 화면은 `aiedu-log.js`)로 불러온다. **head 에 둔다** — 페이지가 열리자마자 시작하는 게임(`#게임이름` 주소)의 시작이 늦게 로드된 스크립트 때문에 빠지는 것을 막기 위해서다. 없거나 실패해도 서비스는 그대로 동작한다.
- `api/log.js` / `api/admin.js`: 얇은 진입점. 로직은 `api/_lib/log-core.js`(handleLog·handleAdmin), 저장소는 `api/_lib/store.js`(Upstash REST / 메모리), 도구는 `api/_lib/util.js`. 함수는 2개뿐이다(Hobby 함수 개수 한도 고려).
- `public/admin/`(index.html·admin.js), `public/privacy.html`·`privacy.js`(이용 기록 안내 + 이 기기에서 끄기).
- `vercel.json`: `/admin/*` 에 `noindex`·`no-referrer`·`no-store`, `/api/*` 에 `no-store`·`noindex`. `robots.txt` 에는 `/admin` 을 **적지 않는다**(경로를 알려 주는 꼴).

## 무엇을 기록하나 (바꾸려면 먼저 사용자·학교 개인정보 담당자와 상의)
| 저장 | 저장하지 않음 |
|---|---|
| 무작위 기기 ID(브라우저 localStorage `aiedu-did`), 기기 종류·OS·브라우저(+주버전)·화면 크기(10px 단위) | **IP**, 원문 User-Agent |
| 국가·**시·도 코드**(`x-vercel-ip-country`, `x-vercel-ip-country-region`) | 시·군·구 |
| 서비스별 열기·시작·완료·사용 횟수, 이용 시간(초), 터치 횟수, 게임 이름 태그 | **아이가 입력한 낱말·필기·음성·정답**, 나라 이름, 이름·계정 |
- 보관 기본 90일(`LOG_RETENTION_DAYS`), Redis 만료로 자동 삭제. 관리자 페이지에서 기기별·전체 삭제 가능.
- 동작 조건: 서버 환경변수 `LOGGING_ENABLED=1` 이 **아니면 아무것도 저장하지 않는다**(코드가 배포돼 있어도). 브라우저의 Do Not Track/Global Privacy Control, `localStorage['aiedu-log-off']`='1' 이면 클라이언트가 보내지 않는다.
- **서비스 코드가 `aieduLog()` 에 넘기는 값은 이벤트 종류(`start`·`finish`·`use`)와 영문 소문자·숫자·`_-` 20자 이내의 태그뿐**이다. 사용자 입력·화면 내용·나라 이름을 태그로 넘기지 않는다. 서버도 형식이 다르면 태그를 버린다.

## 현재 심어 둔 지점
game(미로 포함) `G.start`(start+게임 이름)/`G.win`(finish) · word `startGame`/`finish`(kidwin|botwin) · calcul `#btnGo`/`finish` · hangul·hanja `lookup`(use) · flagmap `show`(use). 열기(open)와 이용 시간(tick)은 스크립트가 자동으로 보낸다(화면이 보이고 최근 90초 안에 조작이 있던 초만 60초마다 합산).

## 운영자가 해야 하는 설정 (Vercel — 이 환경에서는 접근 불가)
1. **저장소 연결**: Vercel 프로젝트 `aiedu` → Storage(또는 Marketplace) → **Upstash Redis** 연결. 환경변수 `KV_REST_API_URL`·`KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_URL`·`_TOKEN`)이 자동으로 생긴다. **읽기·쓰기 토큰**이어야 한다(읽기 전용 토큰은 저장이 안 됨).
2. **비밀값 만들기**(본인 컴퓨터 터미널, 채팅·파일·커밋에 쓰지 않는다): `python3 -c "import secrets;print(secrets.token_urlsafe(36))"` 또는 `openssl rand -base64 36 | tr '+/' '-_' | tr -d '='` → Vercel 환경변수 **`ADMIN_LINK_TOKEN`**(32자 이상, 짧으면 관리자 기능 전체가 꺼짐).
3. 환경변수 **`LOGGING_ENABLED=1`** (기록 켜기 스위치). 선택: `LOG_RETENTION_DAYS`(기본 90), `LOG_DAILY_CAP`(하루 총 기록 상한, 기본 50000), `EXTRA_SERVICES`(쉼표로 서비스 추가).
4. 환경변수는 **새 배포부터** 적용된다 → Redeploy.
5. 관리자 접속: `https://<허브 주소>/admin/#<ADMIN_LINK_TOKEN>` 을 **한 번** 연다. 쿠키(30일, HttpOnly·SameSite=Strict)가 생기고 주소창의 비밀 값은 즉시 지워진다. 이후엔 `/admin/` 만으로 열린다. 링크가 샜다고 의심되면 `ADMIN_LINK_TOKEN` 을 바꾸고 Redeploy → 이전 링크와 **모든 기기의 쿠키가 즉시 무효**.
6. 첫 확인: 관리자 상단에 "기록 켜짐·저장소 연결됨"이 보이고, 서비스를 한 번 연 뒤 기기 목록에 **위치(시·도)** 가 나오는지 본다(헤더 이름은 Vercel 문서로 확인하지 못해 실제로 값이 오는지 확인 필요. `-` 로 나오면 코드의 헤더 이름을 점검).
7. 켜기 전: `privacy.html` 의 **연락처 칸을 채우고** 학교 개인정보 담당자와 수집 항목·목적·보관 기간·동의 방법을 협의한다(이 문서의 초안은 법적 검토를 거치지 않았다).

## 보안 설계 (유지할 것)
- 관리자 인증: 비밀 링크 → 쿠키. 비밀 값은 **주소의 `#` 부분**으로만 받는다(서버 로그·Referrer 에 안 실림). 쿠키 값 = `발급시각.HMAC(비밀값, 발급시각)`, 비교는 `timingSafeEqual`, 30일 만료, **비밀값을 바꾸면 모든 쿠키 무효**. 인증 실패는 모두 404(관리자 존재를 숨김). 로그인 시도는 IP 해시당 10분에 8회·전체 60회로 제한(429).
- 상태를 바꾸는 요청(삭제·전체 삭제)은 POST + `X-AIEDU-Admin: 1` 헤더 + 같은 출처 확인(CSRF 방어)이고, 전체 삭제는 확인 문구 "삭제"가 필요하다.
- 수집 API 는 같은 출처(`Sec-Fetch-Site`/`Origin`)만 받고, 허용 목록(서비스·이벤트)·형식·크기(2KB)·횟수(기기당 시간당 300건, IP 해시당 시간당 5000건, 하루 총량)로 걸러 **오류 내용을 알리지 않고 조용히 버린다**. 위조된 기록으로 화면이 깨지지 않도록 관리자 화면은 모든 값을 `textContent` 로만 그리고, CSV 는 수식 문자(`= + - @`)로 시작하는 셀 앞에 `'` 를 붙인다.
- IP 는 저장하지 않고, 횟수 제한용으로만 **매일 바뀌는 해시**를 쓴다.
- CSP 는 바뀌지 않았다: `script-src 'self'`(`/aiedu-log.js`, `/admin/admin.js`), `connect-src 'self'`(같은 출처 `/api/*`).

## 서비스를 추가할 때
1. 새 서비스 `index.html` 의 `<head>` 에 `<script src="../aiedu-log.js"></script>`.
2. `api/_lib/log-core.js` 의 `SERVICES` 에 id 추가(또는 환경변수 `EXTRA_SERVICES`) — 목록에 없는 서비스는 서버가 버린다. 관리자 화면 이름은 `public/admin/admin.js` 의 `SVC` 에 추가.
3. 필요하면 시작·종료 지점에 `window.aieduLog && aieduLog('start', '게임이름')`.

## 시험
```bash
cd /home/user/aiedu
node --test tests/logging.test.mjs                       # 단위 시험 13개: 꺼짐 기본값·IP/UA 미저장·입력 검증·출처·횟수 제한·로그인 제한·쿠키 위조/만료/교체·CSRF·삭제·90일 만료
env -u GITHUB_TOKEN npm run build                        # 이 세션에는 GITHUB_TOKEN 이 있어 연결 안 된 공개 저장소(miro 등)를 못 받으므로 토큰 없이
python3 scripts/security/make-test-site.py /tmp/site     # 허브 dist + 로컬 앱 작업본을 합친 시험 사이트
LOG_STORE=memory LOGGING_ENABLED=1 ADMIN_LINK_TOKEN=<32자 이상 임의값> node scripts/dev-server.mjs /tmp/site 8910 &   # 정적+API+vercel.json 헤더
node scripts/security/usage-log-e2e.cjs http://127.0.0.1:8910/ <같은 임의값> /tmp/shots    # 브라우저 종단 시험 34개 항목(기기 2대 흉내→기록 내용 점검→관리자 접근·화면·CSV·삭제→위조 시도→끄기)
```
- 시험이 막 켜진 서버로 가면 기록이 메모리에 쌓이므로 서버를 껐다 켜서 초기화한다. `pkill -f` 에 명령 문자열이 들어가면 자기 셸까지 죽는다 → `pgrep -f 'scripts/dev-serve[r]'` 로 PID 를 찾아 `kill`.
- Playwright 는 `sendBeacon` 본문을 읽지 못하므로, 시험은 `navigator.sendBeacon` 을 감싸 전송 직전 내용을 가로챈다.

## 알아 둘 한계
- "누가"는 알 수 없다: 익명 ID 는 **브라우저 단위**다(캐시를 지우면 바뀜). 학교 안에서는 모두 같은 공용 IP 라 위치는 시·도 수준이다.
- 기기와 위치와 활동을 묶은 기록은 개인정보로 볼 여지가 있고(특히 만 14세 미만), 위치정보는 별도 법이 있다 → **"개인정보가 아니다"라고 단정하지 말고** 안내문에 사실대로 쓴다.
- Hobby 요금제는 비영리 개인용 조건이 있고 함수·저장소 한도가 있다(공식 한도 문서 확인).
- 서비스 7개가 되어 허브 첫 화면이 작은 폰 세로(390×780, 360×640)에서 43px·171px 스크롤된다(이용 기록과 무관, 이전부터).
