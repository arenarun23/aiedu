// 관리자 화면. 모든 데이터는 textContent 로만 그린다(innerHTML 금지).
(function () {
  'use strict';
  var API = '../api/admin';
  var SVC = { hub: '허브', flagmap: '국기', hangul: '한글', hanja: '한자', calcul: '소리셈', word: '끝말잇기', game: '게임', miro: '미로' };
  var REGION = { '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주', '30': '대전', '31': '울산', '50': '세종', '41': '경기', '42': '강원', '51': '강원', '43': '충북', '44': '충남', '45': '전북', '52': '전북', '46': '전남', '47': '경북', '48': '경남', '49': '제주' };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var svcName = function (s) { return SVC[s] || s; };
  var place = function (d) { return d.country === 'KR' ? (REGION[d.region] || (d.region && d.region !== '-' ? d.region : '한국')) : (d.country === '-' ? '-' : d.country + (d.region !== '-' ? ' ' + d.region : '')); };
  function when(t) { return t ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'; }
  function ago(t) { if (!t) return '-'; var s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전'; }
  // 이용 시간 표기: 1분 미만은 초, 1시간 미만은 분, 그 이상은 시간+분
  function dur(sec) { sec = Math.round(sec || 0); if (sec < 60) return sec + '초'; var m = Math.floor(sec / 60); if (m < 60) return m + '분' + (sec % 60 && m < 10 ? ' ' + (sec % 60) + '초' : ''); return Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; }

  async function api(op, opts) {
    opts = opts || {};
    var q = '?op=' + encodeURIComponent(op) + (opts.query || '');
    var init = { method: opts.body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (opts.body) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; init.headers['X-AIEDU-Admin'] = '1'; }
    var r = await fetch(API + q, init);
    var data = null; try { data = await r.json(); } catch (e) { /* 본문 없음 */ }
    return { status: r.status, data: data };
  }
  function showMsg(t) { $('app').classList.add('hidden'); $('msg').classList.remove('hidden'); $('msg').textContent = t; }

  // ---------- 요약 ----------
  var days = 7, services = [];
  async function loadSummary() {
    var r = await api('summary', { query: '&days=' + days });
    if (r.status !== 200) { return; }
    services = r.data.services; var rows = r.data.days;
    var tot = {}, dev = 0, opens = 0, secs = 0, maxDev = {};
    services.forEach(function (s) { tot[s] = { open: 0, start: 0, finish: 0, sec: 0, tap: 0 }; });
    rows.forEach(function (d) {
      dev = Math.max(dev, d.devices);
      services.forEach(function (s) {
        ['open', 'start', 'finish', 'sec', 'tap'].forEach(function (k) { tot[s][k] += (d[k] && d[k][s]) || 0; });
        maxDev[s] = Math.max(maxDev[s] || 0, (d.devicesBySvc && d.devicesBySvc[s]) || 0);
      });
    });
    services.forEach(function (s) { opens += tot[s].open; secs += tot[s].sec; });
    $('range').textContent = rows[rows.length - 1].day + ' ~ ' + rows[0].day + ' (한국 시간)';
    var kpi = $('kpi'); clear(kpi);
    [['하루 최대 기기 수', dev], ['열기 횟수', opens], ['이용 시간', dur(secs)]].forEach(function (x) { var c = el('div', null, 'card'); c.appendChild(el('div', x[0], 'soft')); c.appendChild(el('div', String(x[1]), 'num')); kpi.appendChild(c); });
    var bars = $('bars'); clear(bars); var maxSec = Math.max.apply(null, services.map(function (s) { return tot[s].sec; }).concat([1]));
    services.forEach(function (s) { var row = el('div', null, 'row'); row.appendChild(el('span', svcName(s), 'name')); var track = el('div', null, 'track'), b = el('div', null, 'bar'); b.style.width = (tot[s].sec ? Math.max(2, Math.round(tot[s].sec / maxSec * 100)) : 0) + '%'; track.appendChild(b); row.appendChild(track); row.appendChild(el('span', dur(tot[s].sec), 'soft val')); bars.appendChild(row); });
    table($('svcTable'), ['서비스', '일 최대 기기', '열기', '시작', '완료', '이용 시간', '터치'], services.map(function (s) { return [svcName(s), maxDev[s] || 0, tot[s].open, tot[s].start, tot[s].finish, dur(tot[s].sec), tot[s].tap]; }));
    table($('dayTable'), ['날짜', '기기 수', '열기', '이용 시간'], rows.map(function (d) { var o = 0, s2 = 0; services.forEach(function (s) { o += (d.open && d.open[s]) || 0; s2 += (d.sec && d.sec[s]) || 0; }); return [d.day, d.devices, o, dur(s2)]; }));
  }
  function table(t, head, rows, onClick) {
    clear(t); var thead = el('thead'), tr = el('tr'); head.forEach(function (h) { tr.appendChild(el('th', h)); }); thead.appendChild(tr); t.appendChild(thead);
    var tb = el('tbody'); rows.forEach(function (r, i) { var row = el('tr', null, onClick ? 'click' : ''); r.forEach(function (c) { row.appendChild(el('td', String(c))); }); if (onClick) row.addEventListener('click', function () { onClick(i); }); tb.appendChild(row); }); t.appendChild(tb);
    if (!rows.length) { var e = el('tr'); var td = el('td', '기록이 없어요'); td.colSpan = head.length; td.className = 'soft'; e.appendChild(td); tb.appendChild(e); }
  }

  // ---------- 기기 ----------
  var devList = [];
  async function loadDevices() {
    var r = await api('devices'); if (r.status !== 200) return; devList = r.data.devices;
    table($('devTable'), ['마지막 접속', '기기', 'OS', '브라우저', '화면', '위치', '방문', '이용 시간', 'ID'], devList.map(function (d) {
      var sec = 0; Object.keys(d.services).forEach(function (s) { sec += d.services[s].sec || 0; });
      return [ago(d.last), d.device, d.os, d.browser, d.screen, place(d), d.visits, dur(sec), d.id.slice(0, 6)];
    }), function (i) { showDetail(devList[i].id); });
  }
  async function showDetail(id) {
    var r = await api('device', { query: '&id=' + encodeURIComponent(id) }); if (r.status !== 200) return;
    var box = $('detail'); clear(box); box.classList.remove('hidden');
    var d = r.data.device;
    box.appendChild(el('b', d.device + ' · ' + d.os + ' · ' + d.browser + ' · ' + place(d)));
    box.appendChild(el('div', '첫 접속 ' + when(d.first) + ' · 마지막 ' + when(d.last) + ' · ID ' + d.id, 'soft'));
    var per = []; Object.keys(d.services).forEach(function (s) { per.push([svcName(s), d.services[s].open || 0, dur(d.services[s].sec), d.services[s].tap || 0]); });
    var t1 = el('table'); box.appendChild(t1); table(t1, ['서비스', '열기', '이용 시간', '터치'], per);
    var ev = []; r.data.events.forEach(function (e) { ev.push([when(e.t), svcName(e.svc), { open: '열기', start: '시작', finish: '완료', use: '사용' }[e.e] || e.e, e.g || '']); });
    var t2 = el('table'); box.appendChild(t2); table(t2, ['시각', '서비스', '행동', '태그'], ev);
    var del = el('button', '이 기기 기록 삭제', 'btn danger'); del.addEventListener('click', async function () { if (!confirm('이 기기의 기록을 삭제할까요?')) return; await api('delete', { body: { id: d.id } }); box.classList.add('hidden'); loadDevices(); });
    box.appendChild(del); box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- 화면 틀 ----------
  function tab(name) {
    ['summary', 'devices', 'tools'].forEach(function (n) { $('t-' + n).classList.toggle('hidden', n !== name); });
    document.querySelectorAll('nav [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
    if (name === 'summary') loadSummary(); if (name === 'devices') loadDevices();
  }
  async function start() {
    var h = location.hash.replace(/^#/, '');
    if (h) {                                                  // 비밀 링크: 값을 보내 쿠키를 받고 주소창에서 즉시 지운다
      history.replaceState(null, '', location.pathname + location.search);
      var l = await fetch(API + '?op=login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: h }) });
      h = null;
      if (l.status === 429) return showMsg('시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.');
      if (l.status !== 200) return showMsg('Not found');
    }
    var me = await api('me');
    if (me.status !== 200) return showMsg('Not found');      // 존재 자체를 숨긴다
    $('msg').classList.add('hidden'); $('app').classList.remove('hidden');
    var st = $('status'); st.appendChild(el('span', me.data.enabled ? '기록 켜짐' : '기록 꺼짐', 'pill ' + (me.data.enabled ? 'on' : 'off')));
    st.appendChild(el('span', me.data.store ? '저장소 연결됨' : '저장소 미연결', 'pill ' + (me.data.store ? 'on' : 'off')));
    st.appendChild(el('span', '보관 ' + me.data.retentionDays + '일', 'pill'));
    document.querySelectorAll('nav [data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.tab); }); });
    document.querySelectorAll('[data-days]').forEach(function (b) { b.addEventListener('click', function () { days = +b.dataset.days; loadSummary(); }); });
    $('logout').addEventListener('click', async function () { await api('logout', { body: {} }); showMsg('Not found'); });
    $('purge').addEventListener('click', async function () {
      if ($('confirm').value !== '삭제') { $('purgeMsg').textContent = '확인 문구 "삭제"를 입력해 주세요.'; return; }
      var r = await api('purge', { body: { confirm: '삭제' } }); $('purgeMsg').textContent = r.status === 200 ? r.data.removed + '개 항목을 삭제했어요.' : '실패했어요.'; $('confirm').value = ''; loadSummary();
    });
    loadSummary();
  }
  // 이미 열려 있는 탭에서 비밀 링크(#값)로 이동하면 페이지가 새로 불러와지지 않으므로 직접 다시 불러온다
  addEventListener('hashchange', function () { if (location.hash.length > 1) location.reload(); });
  start().catch(function () { showMsg('Not found'); });
})();
