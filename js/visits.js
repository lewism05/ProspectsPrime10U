/* ==========================================================================
   PROSPECTS PRIME 10U — SITE TRAFFIC

   Two jobs:
   1. Tell the site it has been opened. One ping per visit, with the player
      chosen on My Player so a visit maps to a family. Nothing personal:
      no name of the adult, no location, no IP kept anywhere.
   2. Show the admin a summary of who is using the app and how often. The
      summary is gated by an ADMIN_CODE set on the Netlify site, which is a
      different code from the coach passcode - other coaches do not get it.

   Everything on the server side is netlify/functions/visit.js.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Visits = (function () {
  'use strict';

  var C = P10.CONFIG;
  var KEY_DID = C.ns + '_did';
  var KEY_ADMIN = C.ns + '_admin';
  var KEY_LAST = C.ns + '_lastping';
  var URL = '/.netlify/functions/visit';
  var REPING_MS = 30 * 60 * 1000;   // a tab left open counts again after half an hour away
  var esc = function (s) { return P10.Views.esc(s); };
  var chart = null;
  var lastSummary = null, lastDays = 30;

  function ls(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key) || '';
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    } catch (e) {}
    return val || '';
  }

  /* A random id this browser keeps for itself. It identifies a phone, not
     a person, and it exists so "how often" can be counted. */
  function deviceId() {
    var id = ls(KEY_DID);
    if (!id) {
      id = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
      ls(KEY_DID, id);
    }
    return id;
  }

  /* ---------------- the ping ---------------- */
  function ping(reason) {
    if (!navigator.onLine) return;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    var now = Date.now();
    var last = parseInt(ls(KEY_LAST), 10) || 0;
    if (reason === 'focus' && now - last < REPING_MS) return;
    ls(KEY_LAST, String(now));
    var player = '';
    try { player = (P10.MyPlayer && P10.MyPlayer.get()) || ''; } catch (e) {}
    var body = JSON.stringify({
      did: deviceId(),
      player: player,
      coach: !!(P10.Store && P10.Store.state.coach),
      phone: window.matchMedia('(max-width: 720px)').matches
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(URL, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ---------------- admin summary ---------------- */
  function load(days) {
    var code = ls(KEY_ADMIN);
    if (!code) return Promise.reject({ needCode: true });
    return fetch(URL + '?days=' + (days || 30), { headers: { 'x-admin-code': code }, cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var mins = Math.floor((Date.now() - d) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var h = Math.floor(mins / 60);
    if (h < 24) return h + ' hr ago';
    var days = Math.floor(h / 24);
    if (days === 1) return 'yesterday';
    if (days < 14) return days + ' days ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function cardShell(inner, note) {
    return '<div class="card mb-16" id="visitsCard">' +
      '<div class="card-head"><div class="card-title">Site Traffic</div>' +
      '<div class="card-note">' + esc(note || 'Admin only') + '</div></div>' +
      '<div class="card-body">' + inner + '</div></div>';
  }

  function codeForm(msg) {
    return cardShell(
      '<div class="hint mb-8">Who has been opening the app and how often. This is separate from coach mode: it needs the admin code set on the site in Netlify, not the coach passcode.</div>' +
      (msg ? '<div class="msg msg-bad mb-8">' + esc(msg) + '</div>' : '') +
      '<div class="row gap-8" style="flex-wrap:wrap">' +
      '<input class="input" type="password" id="adminCodeInput" placeholder="Admin code" autocomplete="off" style="max-width:220px">' +
      '<button class="btn btn-primary" id="adminCodeGo">Show Traffic</button>' +
      '</div>');
  }

  function renderSummary(s, days) {
    var pct = function (n) { return s.total ? Math.round(100 * n / s.total) + '%' : '—'; };
    var tiles =
      '<div class="statbar visits-tiles mb-16">' +
      tile('Visits', s.total, 'Last ' + s.days + ' days') +
      tile('Today', s.today, 'Visits so far today') +
      tile('Devices', s.uniqueDevices, 'Phones and computers') +
      tile('On a phone', pct(s.phone), pct(s.coach) + ' had coach mode on') +
      '</div>';

    var seg = '<div class="seg" id="visitsDays">' + [7, 30, 90].map(function (d) {
      return '<button class="seg-btn' + (d === days ? ' active' : '') + '" data-days="' + d + '">' + d + ' days</button>';
    }).join('') + '</div>';

    var fam = s.players.length
      ? '<div class="table-scroll"><table class="stat" style="min-width:420px"><thead><tr>' +
        '<th class="stick" style="text-align:left">Family (player picked)</th><th>Visits</th><th>Devices</th><th>Days</th><th>Last visit</th></tr></thead><tbody>' +
        s.players.map(function (p) {
          return '<tr><td class="stick" style="text-align:left">' + esc(p.name) + '</td><td>' + p.visits + '</td><td>' + p.devices + '</td><td>' + p.days + '</td><td>' + esc(fmtWhen(p.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="hint">No visits recorded yet.</div>';

    var dev = s.devices.length
      ? '<div class="table-scroll mt-16"><table class="stat" style="min-width:460px"><thead><tr>' +
        '<th class="stick" style="text-align:left">Device</th><th>Player</th><th>Visits</th><th>Days</th><th>First</th><th>Last</th></tr></thead><tbody>' +
        s.devices.slice(0, 60).map(function (d) {
          return '<tr><td class="stick" style="text-align:left"><span class="badge">' + (d.phone ? 'Phone' : 'Computer') + '</span>' + (d.coach ? ' <span class="badge">Coach</span>' : '') + ' <span class="text-dimmer">' + esc(d.id) + '</span></td>' +
            '<td>' + esc(d.player || '—') + '</td><td>' + d.visits + '</td><td>' + d.days + '</td><td>' + esc(fmtWhen(d.first)) + '</td><td>' + esc(fmtWhen(d.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '';

    return '<div class="card mb-16" id="visitsCard">' +
      '<div class="card-head"><div class="card-title">Site Traffic</div>' + seg + '</div>' +
      '<div class="card-body">' + tiles +
      '<div class="chart-box short"><canvas id="chartVisits"></canvas></div>' +
      '<div class="eyebrow mt-16 mb-8">By Family</div>' + fam +
      '<div class="eyebrow mt-16 mb-8">By Device</div>' + dev +
      '<div class="hint mt-16">A visit is one opening of the app; a tab left open counts again after half an hour away. ' +
      'A family is whoever picked that player on My Player, so two parents on two phones show as two devices under one player. ' +
      'Nothing here names an adult, and no IP addresses are kept. ' +
      '<button class="btn btn-sm btn-ghost" id="adminForget" style="margin-left:6px">Forget admin code on this device</button></div>' +
      '</div></div>';
  }

  function tile(lab, val, note) {
    return '<div class="tile"><div class="tile-lab">' + esc(lab) + '</div><div class="tile-val">' + esc(val) + '</div>' +
      (note ? '<div class="tile-trend">' + esc(note) + '</div>' : '') + '</div>';
  }

  function drawChart(s) {
    var el = document.getElementById('chartVisits');
    if (!el || typeof Chart === 'undefined') return;
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    var K = P10.Charts.COLOR;
    var labels = s.perDay.map(function (d) { var p = d.day.split('-'); return (+p[1]) + '/' + (+p[2]); });
    chart = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: [
        { label: 'Visits', data: s.perDay.map(function (d) { return d.visits; }), backgroundColor: K.barA, borderRadius: 3, borderSkipped: false },
        { label: 'Devices', data: s.perDay.map(function (d) { return d.devices; }), backgroundColor: K.barB, borderRadius: 3, borderSkipped: false }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: K.text, font: { family: 'Inter', size: 11 }, boxWidth: 10, usePointStyle: true } },
          tooltip: { backgroundColor: K.tipBg, borderColor: K.tipLine, borderWidth: 1, titleColor: K.tipText, bodyColor: K.text, displayColors: false, padding: 10 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: K.textDim, font: { family: 'Inter', size: 10 }, maxRotation: 0, autoSkip: true } },
          y: { grid: { color: K.grid }, border: { display: false }, ticks: { color: K.textDim, font: { family: 'Roboto Mono', size: 10 }, precision: 0 } }
        }
      }
    });
  }

  function mount(days) {
    var host = document.getElementById('visitsHost');
    if (!host) return;
    days = days || lastDays;
    host.innerHTML = cardShell('<div class="hint">Loading…</div>');
    load(days).then(function (s) {
      lastSummary = s; lastDays = days;
      host.innerHTML = renderSummary(s, days);
      drawChart(s);
    }).catch(function (err) {
      if (err && err.needCode) { host.innerHTML = codeForm(''); return; }
      if (err && err.configured === false) {
        host.innerHTML = cardShell('<div class="msg msg-warn">Not set up yet. Add an environment variable named <strong>ADMIN_CODE</strong> in Netlify ' +
          '(Site configuration → Environment variables), pick any code only you know, then redeploy the site.</div>', 'Needs setup');
        return;
      }
      if (err && String(err.error || '').indexOf('did not match') >= 0) { ls(KEY_ADMIN, null); host.innerHTML = codeForm('That admin code did not match.'); return; }
      host.innerHTML = cardShell('<div class="msg msg-bad">' + esc((err && (err.detail || err.error)) || 'Could not load the traffic summary.') + '</div>');
    });
  }

  /* The Manage tab is drawn by views.js. Wrap its renderer so the traffic
     card lands at the top of that page without editing views.js. Only a
     device holding the admin code ever sees anything but the code box. */
  var origManage = P10.Views.renderManage;
  P10.Views.renderManage = function (st) {
    origManage(st);
    if (!st.coach) return;
    var body = document.getElementById('manageBody');
    if (!body) return;
    var host = document.createElement('div');
    host.id = 'visitsHost';
    var first = body.querySelector('.section-head');
    if (first && first.nextSibling) body.insertBefore(host, first.nextSibling); else body.appendChild(host);
    mount(lastDays);
  };

  document.addEventListener('click', function (e) {
    if (e.target.closest('#adminCodeGo')) {
      var v = (document.getElementById('adminCodeInput') || {}).value || '';
      if (!v.trim()) return;
      ls(KEY_ADMIN, v.trim());
      mount(lastDays);
      return;
    }
    if (e.target.closest('#adminForget')) { ls(KEY_ADMIN, null); mount(lastDays); return; }
    var d = e.target.closest('#visitsDays .seg-btn');
    if (d) { mount(parseInt(d.dataset.days, 10)); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'adminCodeInput') {
      var b = document.getElementById('adminCodeGo'); if (b) b.click();
    }
  });

  /* ---------------- boot ----------------
     The first ping waits for the store to load its saved state, so the
     coach flag and the chosen player are the real ones. */
  P10.Store.subscribe(function (st, reason) { if (reason === 'init') ping('load'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping('focus'); });

  return { ping: ping, mount: mount, load: load };
})();
