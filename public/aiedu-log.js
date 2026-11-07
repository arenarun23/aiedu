/* AIEDU 이용 기록(익명)
 * 보내는 것: 무작위 기기 ID, 서비스 이름, 열기/시작/완료, 이용 시간(초), 터치 횟수, 화면 크기. (기기 종류·대략적 위치는 서버가 요청 정보에서 얻음)
 * 보내지 않는 것: 아이가 입력한 낱말·필기·음성, 이름·계정, IP 저장(서버도 저장하지 않음). 안내: privacy.html
 * 끄기: privacy.html 의 버튼, 또는 브라우저의 '추적 안 함(Do Not Track / Global Privacy Control)' 설정.
 * 서버 스위치(LOGGING_ENABLED)가 꺼져 있으면 서버가 모두 버린다. 이 파일이 없거나 실패해도 서비스는 그대로 동작한다.
 * 서비스 코드에서: window.aieduLog && aieduLog('start', 'maze')  — 이벤트 start|finish|use, 태그는 영문 소문자·숫자·_- 20자 이내(입력 내용 금지)
 */
(function () {
  'use strict';
  try {
    var nav = navigator;
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return;
    if (!window.fetch || !nav.sendBeacon || !window.crypto || !crypto.getRandomValues) return;
    var LS = window.localStorage;
    if (LS.getItem('aiedu-log-off') === '1') return;

    var did = LS.getItem('aiedu-did');
    if (!/^[a-f0-9]{24}$/.test(did || '')) {
      var a = new Uint8Array(12); crypto.getRandomValues(a); did = '';
      for (var i = 0; i < a.length; i++) did += ('0' + a[i].toString(16)).slice(-2);
      LS.setItem('aiedu-did', did);
    }
    var seg = location.pathname.split('/')[1] || '';
    var svc = /^[a-z0-9-]{1,20}$/.test(seg) ? seg : 'hub';          // 서비스 폴더 이름(허브 첫 화면은 hub)
    var url = (svc === 'hub' ? '' : '../') + 'api/log';               // 상대경로: 허브 하위 경로에서 동작

    function send(e, extra) {
      var p = { d: did, s: svc, e: e, w: window.innerWidth, h: window.innerHeight };
      if (extra) for (var k in extra) p[k] = extra[k];
      try { nav.sendBeacon(url, new Blob([JSON.stringify(p)], { type: 'application/json' })); } catch (err) { /* 무시 */ }
    }

    // 이용 시간: 화면이 보이고 최근 90초 안에 조작이 있었던 초만 센다. 60초마다 서버에 보낸다.
    var secs = 0, taps = 0, lastInput = Date.now();
    function touch() { lastInput = Date.now(); }
    addEventListener('pointerdown', function () { taps++; touch(); }, { passive: true, capture: true });
    addEventListener('keydown', touch, { passive: true, capture: true });
    addEventListener('touchstart', touch, { passive: true, capture: true });
    function flush() { if (secs > 0) { send('tick', { t: Math.min(secs, 120), a: Math.min(taps, 3000) }); secs = 0; taps = 0; } }
    setInterval(function () {
      if (document.visibilityState === 'visible' && Date.now() - lastInput <= 90000) secs++;
      if (secs >= 60) flush();
    }, 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    addEventListener('pagehide', flush);

    send('open');
    window.aieduLog = function (e, tag) {
      if (e !== 'start' && e !== 'finish' && e !== 'use') return;
      send(e, typeof tag === 'string' && /^[a-z0-9_-]{1,20}$/.test(tag) ? { g: tag } : null);
    };
  } catch (err) { /* 기록 실패는 서비스에 영향을 주지 않는다 */ }
})();
