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
  var KEY_NAME = C.ns + '_whoami';
  var KEY_SKIP = C.ns + '_whoami_skip';
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
  /* The admin code lives in sessionStorage: gone when the tab closes. */
  function ss(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key) || '';
      if (val === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val);
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
    if (reason !== 'name') ls(KEY_LAST, String(now));
    var player = '';
    try { player = (P10.MyPlayer && P10.MyPlayer.get()) || ''; } catch (e) {}
    var body = JSON.stringify({
      did: deviceId(),
      name: ls(KEY_NAME),
      role: ls(KEY_ROLE),
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
    var code = ss(KEY_ADMIN);
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
      '<div class="card-note">' + esc(note || 'Admin') + '</div></div>' +
      '<div class="card-body">' + inner + '</div></div>';
  }

  /* Before the code is entered the page gives nothing away: no title, no
     numbers, just a code box. */
  function codeForm(msg) {
    return '<div class="card mb-16" id="visitsCard"><div class="card-body">' +
      (msg ? '<div class="msg msg-bad mb-8">' + esc(msg) + '</div>' : '') +
      '<div class="row gap-8" style="flex-wrap:wrap">' +
      '<input class="input" type="password" id="adminCodeInput" placeholder="Admin code" autocomplete="off" style="max-width:220px">' +
      '<button class="btn btn-primary" id="adminCodeGo">Continue</button>' +
      '</div></div></div>';
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

    var ppl = (s.people || []).length
      ? '<div class="table-scroll"><table class="stat" style="min-width:460px"><thead><tr>' +
        '<th class="stick" style="text-align:left">Person</th><th>Visits</th><th>Devices</th><th>Days</th><th>Player</th><th>Role</th><th>Last visit</th></tr></thead><tbody>' +
        s.people.map(function (p) {
          return '<tr><td class="stick" style="text-align:left">' + esc(p.name) + '</td><td><strong>' + p.visits + '</strong></td><td>' + p.devices + '</td><td>' + p.days + '</td><td>' + esc(p.players || '—') + '</td><td>' + esc(fmtWhen(p.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="hint">No visits recorded yet.</div>';

    var fam = s.players.length
      ? '<div class="table-scroll"><table class="stat" style="min-width:420px"><thead><tr>' +
        '<th class="stick" style="text-align:left">Family (player picked)</th><th>Visits</th><th>Devices</th><th>Days</th><th>Last visit</th></tr></thead><tbody>' +
        s.players.map(function (p) {
          return '<tr><td class="stick" style="text-align:left">' + esc(p.name) + '</td><td>' + p.visits + '</td><td>' + p.devices + '</td><td>' + p.days + '</td><td>' + esc(fmtWhen(p.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="hint">No visits recorded yet.</div>';

    var dev = s.devices.length
      ? '<div class="table-scroll mt-16"><table class="stat" style="min-width:460px"><thead><tr>' +
        '<th class="stick" style="text-align:left">Device</th><th>Person</th><th>Player</th><th>Visits</th><th>Days</th><th>First</th><th>Last</th></tr></thead><tbody>' +
        s.devices.slice(0, 60).map(function (d) {
          return '<tr><td class="stick" style="text-align:left"><span class="badge">' + (d.phone ? 'Phone' : 'Computer') + '</span>' + (d.coach ? ' <span class="badge">Coach</span>' : '') + ' <span class="text-dimmer">' + esc(d.id) + '</span></td>' +
            '<td>' + esc(d.name || '—') + '</td><td>' + esc(d.player || '—') + '</td><td>' + d.visits + '</td><td>' + d.days + '</td><td>' + esc(fmtWhen(d.first)) + '</td><td>' + esc(fmtWhen(d.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '';

    return '<div class="card mb-16" id="visitsCard">' +
      '<div class="card-head"><div class="card-title">Site Traffic</div>' + seg + '</div>' +
      '<div class="card-body">' + tiles +
      '<div class="chart-box short"><canvas id="chartVisits"></canvas></div>' +
      '<div class="eyebrow mt-16 mb-8">By Person</div>' + ppl +
      '<div class="eyebrow mt-16 mb-8">By Family</div>' + fam +
      '<div class="eyebrow mt-16 mb-8">By Device</div>' + dev +
      '<div class="hint mt-16">A visit is one opening of the app; a tab left open counts again after half an hour away. ' +
      'A person is the name saved on the Profile tab; a family is whoever picked that player. ' +
      'Visits with no name still count and show as "(no name entered)". No IP addresses are kept. ' +
      '<button class="btn btn-sm btn-ghost" id="adminForget" style="margin-left:6px">Lock</button></div>' +
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
    host.innerHTML = ss(KEY_ADMIN) ? cardShell('<div class="hint">Loading…</div>') : codeForm('');
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
      if (err && String(err.error || '').indexOf('did not match') >= 0) { ss(KEY_ADMIN, null); host.innerHTML = codeForm('That admin code did not match.'); return; }
      host.innerHTML = cardShell('<div class="msg msg-bad">' + esc((err && (err.detail || err.error)) || 'Could not load the traffic summary.') + '</div>');
    });
  }

  /* ==================================================================
     PROFILE
     The app has no accounts, so the only way to know who is using it is
     to ask. The Profile tab takes a name and which player is theirs, saves
     both on the device, points My Player at that kid, and from then on
     every visit from this phone carries the name. Voluntary: a visit with
     no profile still counts, it just shows as "(no name entered)".
     ================================================================== */
  var KEY_ROLE = C.ns + '_whoami_role';
  var ROLES = ['Parent', 'Grandparent', 'Family', 'Coach', 'Player'];

  function profile() {
    return { name: ls(KEY_NAME), player: (P10.MyPlayer && P10.MyPlayer.get()) || '', role: ls(KEY_ROLE) };
  }

  function renderProfile() {
    var body = document.getElementById('profileBody');
    if (!body) return;
    var pr = profile();
    var roster = C.roster.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    body.innerHTML =
      '<div class="section-head"><div><h2>Profile</h2><div class="section-sub">Takes ten seconds and you only do it once</div></div></div>' +
      '<div class="card card-accent mb-16"><div class="card-body">' +
      (pr.name ? '<div class="msg msg-good mb-16">Saved as <strong>' + esc(pr.name) + '</strong>' + (pr.player ? ' · ' + esc(pr.player) : '') + '. Change anything below and save again.</div>'
               : '<div class="hint mb-16">Put in your name and which player is yours so the coaches know who is on the app. My Player gets set to your kid at the same time.</div>') +
      '<div class="field"><label for="profName">Your name</label>' +
      '<input class="input" type="text" id="profName" placeholder="First and last" autocomplete="name" maxlength="40" value="' + esc(pr.name) + '"></div>' +
      '<div class="field mt-16"><label for="profPlayer">Your player</label>' +
      '<select class="input" id="profPlayer">' +
      '<option value="">Pick a player</option>' +
      roster.map(function (r) { return '<option value="' + esc(r.name) + '"' + (r.name === pr.player ? ' selected' : '') + '>' + esc(r.name) + (r.num !== null && r.num !== undefined ? ' · #' + r.num : '') + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field mt-16"><label>I am his</label>' +
      '<div class="seg" id="profRole">' + ROLES.map(function (r) {
        return '<button type="button" class="seg-btn' + (r === pr.role ? ' active' : '') + '" data-role="' + r + '">' + r + '</button>';
      }).join('') + '</div></div>' +
      '<div id="profMsg"></div>' +
      '<div class="row gap-8 mt-16" style="flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="profSave">Save Profile</button>' +
      (pr.name ? '<button class="btn btn-ghost" id="profClear">Clear</button>' : '') +
      '</div>' +
      '<div class="hint mt-16">This stays on your phone. The site only keeps a count of visits with the name you enter here - no email, no phone number, nothing else.</div>' +
      '</div></div>';
  }

  function activateProfile(opts) {
    document.querySelectorAll('.navtab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'profile'); });
    document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('active', p.id === 'page-profile'); });
    var wb = document.getElementById('windowBar'); if (wb) wb.classList.add('hidden');
    var sn = document.getElementById('subnav'), nt = document.getElementById('navToggle');
    if (sn) sn.classList.remove('open');
    if (nt) { nt.classList.remove('open'); nt.setAttribute('aria-expanded', 'false'); }
    if (P10.Charts && P10.Charts.destroyAll) P10.Charts.destroyAll();
    renderProfile();
    if (!opts || !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#profile'); } catch (e) {}
  }

  function paintFooter() {
    var el = document.getElementById('footWho');
    if (!el) return;
    var name = ls(KEY_NAME);
    el.innerHTML = name
      ? 'You: <strong>' + esc(name) + '</strong> · <a href="#profile" data-goto="profile">profile</a>'
      : '<a href="#profile" data-goto="profile">Set up your profile</a>';
  }

  /* A small nudge at the top of Home until a profile exists. */
  var origDash = P10.Views.renderDashboard;
  P10.Views.renderDashboard = function (st) {
    origDash(st);
    paintFooter();
    var old = document.getElementById('whoCard'); if (old) old.remove();
    if (ls(KEY_NAME) || ss(KEY_SKIP)) return;
    var page = document.getElementById('page-dashboard');
    var bar = document.getElementById('statbar');
    if (!page) return;
    var host = document.createElement('div');
    host.innerHTML = '<div class="card card-accent mb-16" id="whoCard"><div class="card-body">' +
      '<div class="row gap-12" style="flex-wrap:wrap;align-items:center">' +
      '<div class="grow"><div class="card-title" style="font-size:15px;margin-bottom:4px">Welcome to the team site</div>' +
      '<div class="hint">Set up a quick profile with your name and your player so the coaches know who is on here.</div></div>' +
      '<button class="btn btn-primary" data-goto="profile">Set Up Profile</button>' +
      '<button class="btn btn-ghost" id="whoSkip">Later</button>' +
      '</div></div></div>';
    page.insertBefore(host.firstChild, bar || page.firstChild);
  };

  document.addEventListener('click', function (e) {
    var go = e.target.closest('.navtab[data-tab="profile"], [data-goto="profile"]');
    if (go) { e.preventDefault(); e.stopPropagation(); activateProfile(); return; }
  }, true);

  document.addEventListener('click', function (e) {
    var role = e.target.closest('#profRole .seg-btn');
    if (role) {
      document.querySelectorAll('#profRole .seg-btn').forEach(function (b) { b.classList.toggle('active', b === role); });
      return;
    }
    if (e.target.closest('#profSave')) {
      var name = ((document.getElementById('profName') || {}).value || '').trim();
      var player = (document.getElementById('profPlayer') || {}).value || '';
      var roleBtn = document.querySelector('#profRole .seg-btn.active');
      var msg = document.getElementById('profMsg');
      if (!name) {
        if (msg) msg.innerHTML = '<div class="msg msg-bad mt-8">Put your name in first.</div>';
        var i = document.getElementById('profName'); if (i) i.focus();
        return;
      }
      ls(KEY_NAME, name.slice(0, 40));
      ls(KEY_ROLE, roleBtn ? roleBtn.dataset.role : null);
      if (P10.MyPlayer) P10.MyPlayer.set(player);
      ping('name');
      paintFooter();
      var card = document.getElementById('whoCard'); if (card) card.remove();
      renderProfile();
      if (P10.app && P10.app.toast) P10.app.toast('Saved. Thanks, ' + name.split(' ')[0] + '.', 'good');
      return;
    }
    if (e.target.closest('#profClear')) {
      ls(KEY_NAME, null); ls(KEY_ROLE, null);
      renderProfile(); paintFooter();
      return;
    }
    if (e.target.closest('#whoSkip')) {
      ss(KEY_SKIP, '1');
      var c = document.getElementById('whoCard'); if (c) c.remove();
      return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'profName') { var b = document.getElementById('profSave'); if (b) b.click(); }
  });
  P10.Store.subscribe(function (st, reason) {
    if (reason === 'init') {
      paintFooter();
      if ((location.hash || '') === '#profile') setTimeout(function () { activateProfile({ noScroll: true }); }, 0);
    }
  });

  /* ==================================================================
     THE ADMIN PAGE
     Reached from the small Admin link in the footer. It is not a tab, not
     part of either room, and nothing in coach mode leads to it. The code
     is asked for every time the page is opened and held only for this
     browser session, so a shared laptop does not stay unlocked.
     ================================================================== */
  function activate() {
    document.querySelectorAll('.navtab').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('active', p.id === 'page-admin'); });
    var wb = document.getElementById('windowBar'); if (wb) wb.classList.add('hidden');
    var sn = document.getElementById('subnav'), nt = document.getElementById('navToggle');
    if (sn) sn.classList.remove('open');
    if (nt) { nt.classList.remove('open'); nt.setAttribute('aria-expanded', 'false'); }
    if (P10.Charts && P10.Charts.destroyAll) P10.Charts.destroyAll();
    var body = document.getElementById('adminBody');
    if (body) body.innerHTML = '<div class="section-head"><div><h2>Admin</h2></div></div><div id="visitsHost"></div>';
    try { sessionStorage.removeItem(KEY_ADMIN); } catch (e) {}
    mount(lastDays);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#admin'); } catch (e) {}
    setTimeout(function () { var i = document.getElementById('adminCodeInput'); if (i) i.focus(); }, 50);
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-goto="admin"]');
    if (!link) return;
    e.preventDefault(); e.stopPropagation();
    activate();
  }, true);

  P10.Store.subscribe(function (st, reason) {
    if (reason === 'init' && (location.hash || '') === '#admin') setTimeout(activate, 0);
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#adminCodeGo')) {
      var v = (document.getElementById('adminCodeInput') || {}).value || '';
      if (!v.trim()) return;
      ss(KEY_ADMIN, v.trim());
      mount(lastDays);
      return;
    }
    if (e.target.closest('#adminForget')) { ss(KEY_ADMIN, null); mount(lastDays); return; }
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
