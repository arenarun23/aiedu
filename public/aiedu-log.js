/* AIEDU 이용 기록(익명)
 * 보내는 것(오프라인이면 기기에 쌓았다가 온라인이 되면 원래 시각과 함께): 무작위 기기 ID, 서비스 이름, 열기/시작/완료, 이용 시간(초), 터치 횟수, 화면 크기. (기기 종류·대략적 위치는 서버가 요청 정보에서 얻음)
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
    if (!window.fetch || !window.crypto || !crypto.getRandomValues) return;
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

    // 오프라인·전송 실패 대비: 보내지 못한 기록은 이 기기에 잠시 쌓아 두었다가(최대 200건, 7일) 인터넷이 돌아오면 원래 시각(ts)과 함께 보낸다.
    // 쌓는 내용도 보내는 내용과 같다(기기 ID·서비스·이벤트·시간·터치 수·화면 크기). 입력 내용은 없다.
    var QK = 'aiedu-log-q', QMAX = 200, WEEK = 7 * 86400000;
    function qget() { try { var q = JSON.parse(LS.getItem(QK) || '[]'); return Array.isArray(q) ? q : []; } catch (err) { return []; } }
    function qset(q) { try { if (q.length) LS.setItem(QK, JSON.stringify(q.slice(-QMAX))); else LS.removeItem(QK); } catch (err) { /* 저장 공간 부족 등은 무시 */ } }
    function enqueue(p) {
      var q = qget(), now = Date.now(), i;
      q = q.filter(function (x) { return x && typeof x.ts === 'number' && now - x.ts < WEEK; });
      if (p.e === 'tick') {                                           // 이용 시간은 같은 서비스끼리 합쳐서(1건 120초 이하) 건수를 줄인다
        for (i = q.length - 1; i >= 0; i--) if (q[i].e === 'tick' && q[i].s === p.s) break;
        if (i >= 0 && q[i].t + p.t <= 120 && p.ts - q[i].ts < 3600000) { q[i].t += p.t; q[i].a = Math.min((q[i].a || 0) + (p.a || 0), 3000); qset(q); return; }
      }
      q.push(p); qset(q);
    }
    var flushing = false;
    function drain() {                                                // 쌓인 기록을 순서대로 전송(한 번에 최대 30건). 성공·서버 거절(4xx)이면 지우고, 네트워크 오류·5xx 면 남긴다.
      if (flushing || !qget().length) return;
      flushing = true;
      var n = 0;
      (function next() {
        var q = qget();
        if (!q.length || n++ >= 30) { flushing = false; return; }
        fetch(url, { method: 'POST', body: JSON.stringify(q[0]), headers: { 'Content-Type': 'text/plain' }, keepalive: true })
          .then(function (r) {
            if (r.status >= 500) { flushing = false; return; }
            var cur = qget(); cur.shift(); qset(cur);
            setTimeout(next, 250);
          })
          .catch(function () { flushing = false; });
      })();
    }
    function send(e, extra, unloading) {
      var p = { d: did, s: svc, e: e, w: window.innerWidth, h: window.innerHeight, ts: Date.now() };
      if (extra) for (var k in extra) p[k] = extra[k];
      try {
        if (unloading) {                                              // 페이지를 닫는 중: 응답을 기다릴 수 없으므로 온라인이면 beacon, 아니면 쌓아 둔다
          if (nav.onLine === false || !nav.sendBeacon(url, new Blob([JSON.stringify(p)], { type: 'application/json' }))) enqueue(p);
          return;
        }
        if (nav.onLine === false) { enqueue(p); return; }
        fetch(url, { method: 'POST', body: JSON.stringify(p), headers: { 'Content-Type': 'text/plain' }, keepalive: true })
          .then(function (r) { if (r.status >= 500) enqueue(p); else drain(); })
          .catch(function () { enqueue(p); });
      } catch (err) { /* 무시 */ }
    }
    addEventListener('online', function () { setTimeout(drain, 500); });

    // 이용 시간: 화면이 보이고 최근 90초 안에 조작이 있었던 초만 센다. 60초마다 서버에 보낸다.
    var secs = 0, taps = 0, lastInput = Date.now();
    function touch() { lastInput = Date.now(); }
    addEventListener('pointerdown', function () { taps++; touch(); }, { passive: true, capture: true });
    addEventListener('keydown', touch, { passive: true, capture: true });
    addEventListener('touchstart', touch, { passive: true, capture: true });
    function flush(unloading) { if (secs > 0) { send('tick', { t: Math.min(secs, 120), a: Math.min(taps, 3000) }, unloading === true); secs = 0; taps = 0; } }
    setInterval(function () {
      if (document.visibilityState === 'visible' && Date.now() - lastInput <= 90000) secs++;
      if (secs >= 60) flush();
    }, 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
    addEventListener('pagehide', function () { flush(true); });

    send('open');
    setTimeout(drain, 1500);                                          // 이전에 못 보낸 기록이 있으면 지금 보낸다
    window.aieduLog = function (e, tag) {
      if (e !== 'start' && e !== 'finish' && e !== 'use') return;
      send(e, typeof tag === 'string' && /^[a-z0-9_-]{1,20}$/.test(tag) ? { g: tag } : null);
    };
  } catch (err) { /* 기록 실패는 서비스에 영향을 주지 않는다 */ }
})();
