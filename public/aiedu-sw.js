/* 오프라인용 서비스 워커 등록(허브 빌드가 각 서비스·허브에 sw.js 를 만들어 둔다). 실패해도 서비스는 그대로 동작한다.
 * 열 때마다 브라우저가 sw.js 가 바뀌었는지 확인하고, 바뀌었으면 새 파일을 받고 예전 저장본을 지운다.
 * 이 파일·sw.js 는 학생 기록(localStorage 등)에 접근하지 않는다. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var dir = location.pathname.replace(/[^/]*$/, '');
  addEventListener('load', function () {
    try {
      navigator.serviceWorker.register(dir + 'sw.js', { scope: dir })
        .then(function (r) { return r.update(); })
        .catch(function () {});
    } catch (e) {}
  });
})();
