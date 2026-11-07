// 이 기기에서 이용 기록 끄기/켜기 (localStorage 'aiedu-log-off')
(function () {
  var state = document.getElementById('state'), btn = document.getElementById('toggle');
  function get() { try { return localStorage.getItem('aiedu-log-off') === '1'; } catch (e) { return false; } }
  function dnt() { return navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true; }
  function render() {
    var off = get();
    state.textContent = dnt() ? '브라우저의 "추적 안 함" 설정이 켜져 있어 기록하지 않습니다.' : (off ? '이 기기에서는 이용 기록을 보내지 않습니다.' : '이 기기에서는 이용 기록을 보낼 수 있습니다(서버에서 켜져 있을 때).');
    btn.textContent = off ? '기록 다시 켜기' : '기록 끄기';
  }
  btn.addEventListener('click', function () {
    try { if (get()) { localStorage.removeItem('aiedu-log-off'); } else { localStorage.setItem('aiedu-log-off', '1'); localStorage.removeItem('aiedu-did'); } } catch (e) { /* 저장소를 못 쓰면 기록도 안 함 */ }
    render();
  });
  render();
})();
