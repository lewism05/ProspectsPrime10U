/* ==========================================================================
   PROSPECTS PRIME 10U — VIEWS
   Every render function. Each takes the store state and writes HTML into
   its section container. No framework, no build step - just strings.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Views = (function () {
  'use strict';

  var S = P10.Stats;
  var C = P10.CONFIG;
  var I = P10.Insights;
  var L = P10.Lineup;
  var Sch = P10.Schedule;
  var Ch = P10.Charts;

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function set(id, html) { var el = $(id); if (el) el.innerHTML = html; }

  function empty(icon, title, detail, actionHtml) {
    return '<div class="card"><div class="empty">' +
      '<div class="empty-rule"></div>' +
      '<div class="empty-t">' + esc(title) + '</div>' +
      '<div class="empty-d">' + esc(detail) + '</div>' +
      (actionHtml || '') +
      '</div></div>';
  }

  function gradeChip(family, key, value) {
    var g = S.grade(family, key, value);
    if (!g) return '';
    return '<span class="badge badge-' + S.gradeClass(g) + '">' + S.gradeLabel(g) + '</span>';
  }

  function deltaText(v, dec) {
    if (!v || Math.abs(v) < 0.001) return '<span class="text-dimmer">even</span>';
    var cls = v > 0 ? 'text-good' : 'text-bad';
    var arrow = v > 0 ? '▲' : '▼';
    return '<span class="' + cls + '">' + arrow + ' ' + S.rate(Math.abs(v), dec === undefined ? 3 : dec) + '</span>';
  }

  function playerNameCell(p) {
    return '<div class="pname">' +
      '<span class="pnum">' + (p.num !== null && p.num !== undefined ? p.num : '–') + '</span>' +
      '<span class="grow"><span class="pname-txt">' + esc(p.name) + '</span>' +
      (p.position ? '<div class="pname-sub">' + esc(p.position) + '</div>' : '') +
      '</span></div>';
  }

  function needData() {
    return empty('', 'No stats loaded yet',
      'Upload a GameChanger CSV export from the Manage tab and every page fills in. ' +
      'Until then the roster is here and everything else waits.',
      P10.Store.state.coach
        ? '<button class="btn btn-primary" data-goto="manage">Upload Stats</button>'
        : '<div class="hint">Your coach publishes new numbers after each series.</div>');
  }

  /* ==================================================================
     HERO + STAT BAR
     ================================================================== */
  /* Sample data no longer shouts from a banner. It still has to be
     discoverable though, so it is marked on the data pill in the masthead
     and called out in Manage - quiet, but not hidden. */
  function sampleBanner() { return ''; }

  function renderHero(st) {
    var t = st.team;
    var meta = [];

    meta.push(heroTag('Season', C.team.season));
    meta.push(heroTag('Roster', C.roster.length + ' Players'));
    if (C.team.homeField) meta.push(heroTag('Home', C.team.homeField));

    var nx = Sch.next();
    if (nx) meta.push(heroTag('Next', (nx.opponent || 'TBD') + ' · ' + Sch.countdownText(nx)));

    set('heroMeta', meta.join(''));

    var rec = [];
    if (t && t.withData) {
      rec.push(recBlock(S.rate(t.ops), 'OPS'));
      rec.push(recBlock(S.rate(t.avg), 'AVG'));
      if (t.ip > 0) rec.push(recBlock(S.fixed(t.era, 2), 'ERA'));
    } else {
      rec.push(recBlock(C.roster.length, 'Roster'));
      rec.push(recBlock(C.team.ageGroup, 'Division'));
    }
    set('heroRecord', rec.join(''));
    set('footSeason', esc(C.team.season));
  }

  function heroTag(label, value) {
    return '<span class="hero-tag"><b>' + esc(label) + '</b>' + esc(value) + '</span>';
  }

  function recBlock(val, lab) {
    return '<div class="hrec"><div class="hrec-val">' + esc(val) + '</div><div class="hrec-lab">' + esc(lab) + '</div></div>';
  }

  function renderStatbar(st) {
    var t = st.team, players = st.players;

    if (!t || !t.withData) {
      set('statbar',
        tile('Roster', C.roster.length, '', '') +
        tile('Division', C.team.ageGroup, '', '') +
        tile('Season', C.team.season, '', '') +
        tile('Status', 'Awaiting stats', '', '', true));
      return;
    }

    var trend = st.trend || {};
    var opsDelta = (trend.l4 || 0) - (trend.season || 0);

    var hot = players.filter(function (p) { return p.batL4 && p.batL4.ops > 0; })
      .sort(function (a, b) { return (b.batL4.ops - (b.batSeason ? b.batSeason.ops : 0)) - (a.batL4.ops - (a.batSeason ? a.batSeason.ops : 0)); })[0];

    var arm = L.pitcherRank(players)[0];

    var html = '';
    html += tile('Team OPS', S.rate(t.ops),
      opsDelta ? (opsDelta > 0 ? 'up' : 'down') : '',
      (opsDelta ? (opsDelta > 0 ? '▲ ' : '▼ ') + S.rate(Math.abs(opsDelta)) + ' last 4' : 'Steady'));

    html += tile('Team OBP', S.rate(t.obp), '',
      S.gradeLabel(S.grade('batting', 'obp', t.obp)) + ' for 10U');

    if (t.ip > 0) {
      html += tile('Team ERA', S.fixed(t.era, 2), '',
        Math.round(t.strikePct * 100) + '% strikes · ' + S.fixed(t.bbPerIp, 2) + ' BB/IP');
    } else {
      html += tile('Team AVG', S.rate(t.avg), '', t.h + ' hits in ' + t.ab + ' AB');
    }

    if (hot) {
      var d = hot.batL4.ops - (hot.batSeason ? hot.batSeason.ops : 0);
      html += tile('Hottest Bat', hot.short, d > 0 ? 'up' : '',
        S.rate(hot.batL4.ops) + ' OPS last 4', true);
    }

    if (arm) {
      html += tile('Top Arm', arm.player.short, 'up',
        Math.round(arm.strike * 100) + '% strikes · ' + S.fixed(arm.era, 2) + ' ERA', true);
    }

    set('statbar', html);
  }

  function tile(lab, val, trendCls, trendTxt, isText) {
    return '<div class="tile">' +
      '<div class="tile-lab">' + esc(lab) + '</div>' +
      '<div class="tile-val' + (isText ? ' txt' : '') + '">' + esc(val) + '</div>' +
      (trendTxt ? '<div class="tile-trend ' + (trendCls || '') + '">' + esc(trendTxt) + '</div>' : '') +
      '</div>';
  }

  /* ==================================================================
     DASHBOARD
     ================================================================== */
  function renderDashboard(st) {
    var players = st.players, t = st.team;

    if (!t || !t.withData) {
      set('dashboardBody', nextGameCard(st) + needData());
      return;
    }

    var html = '';

    /* ---- Row 1: team trend (wide) + next game ---- */
    html += '<div class="grid g-main mb-16">';
    html += '<div class="card card-accent">' +
      cardHead('Team Trend', 'Average OPS by window') +
      '<div class="card-body"><div class="chart-box short"><canvas id="chartTeamTrend"></canvas></div></div>' +
      '</div>';
    html += nextGameCard(st);
    html += '</div>';

    /* ---- Row 2: three leaderboards ---- */
    html += '<div class="grid g-3 mb-16">';

    html += leaderCard('Top Bats', players
      .filter(function (p) { return p.bat && p.bat.ops > 0; })
      .sort(function (a, b) { return b.bat.ops - a.bat.ops; })
      .slice(0, 6)
      .map(function (p) { return { p: p, val: S.rate(p.bat.ops), delta: p.heat }; }));

    html += leaderCard('Getting On Base', players
      .filter(function (p) { return p.bat && p.bat.obp > 0; })
      .sort(function (a, b) { return b.bat.obp - a.bat.obp; })
      .slice(0, 6)
      .map(function (p) { return { p: p, val: S.rate(p.bat.obp) }; }));

    var arms = L.pitcherRank(players);
    if (arms.length) {
      html += '<div class="card">' + cardHead('Staff Order', 'Strikes first') +
        '<div class="card-body flush"><div class="lead-list">' +
        arms.slice(0, 6).map(function (a, i) {
          return '<div class="lead-row" data-player="' + esc(a.player.name) + '">' +
            '<span class="lead-rank">' + (i + 1) + '</span>' +
            '<span class="lead-name grow">' + esc(a.player.name) +
            '<div class="pname-sub">' + Math.round(a.strike * 100) + '% strikes · ' +
            S.ipText(a.ip) + ' IP</div></span>' +
            '<span class="slot-grade grade-' + a.grade + '">' + a.grade + '</span>' +
            '</div>';
        }).join('') +
        '</div></div></div>';
    } else {
      html += leaderCard('Most Hits', players
        .filter(function (p) { return p.bat && p.bat.h > 0; })
        .sort(function (a, b) { return b.bat.h - a.bat.h; })
        .slice(0, 6)
        .map(function (p) { return { p: p, val: String(p.bat.h) }; }));
    }

    html += '</div>';

    /* ---- Row 3: OPS chart + practice priority ---- */
    html += '<div class="grid g-main">';

    html += '<div class="card">' +
      cardHead('OPS Leaderboard', S.WINDOW_LABELS[st.viewWindow]) +
      '<div class="card-body"><div class="chart-box tall"><canvas id="chartOps"></canvas></div>' +
      '<div class="hint mt-8">Green bars are elite for 10U, silver is above average, gold means there is room to grow. ' +
      'Tap any name in a table or card to open that player.</div>' +
      '</div></div>';

    var focus = I.teamFocus(players, t);
    if (focus.length) {
      html += '<div class="card">' +
        cardHead('Practice Priority', 'Auto-detected') +
        '<div class="card-body">' +
        focus.slice(0, 3).map(function (f) {
          return '<div class="issue sev-' + (f.priority >= 3 ? 'high' : f.priority === 2 ? 'med' : 'low') + '">' +
            '<div class="issue-tag">' + esc((f.area || '').slice(0,3)) + '</div>' +
            '<div class="grow"><div class="issue-t">' + esc(f.title) + ' <span class="badge">' + esc(f.stat) + '</span></div>' +
            '<div class="issue-d">' + esc(f.detail) + '</div></div></div>';
        }).join('') +
        '<button class="btn btn-ghost btn-block mt-8" data-goto="development">See The Drills</button>' +
        '</div></div>';
    }

    html += '</div>';

    set('dashboardBody', html);

    Ch.teamTrend('chartTeamTrend', st.trend);
    Ch.opsBar('chartOps', players);
  }

  function cardHead(title, note) {
    return '<div class="card-head"><div class="card-title">' + esc(title) + '</div>' +
      (note ? '<div class="card-note">' + esc(note) + '</div>' : '') + '</div>';
  }

  function leaderCard(title, rows) {
    if (!rows.length) return '';
    return '<div class="card">' + cardHead(title) +
      '<div class="card-body tight"><div class="lead-list">' +
      rows.map(function (r, i) {
        return '<div class="lead-row" data-player="' + esc(r.p.name) + '">' +
          '<span class="lead-rank">' + (i + 1) + '</span>' +
          '<span class="lead-name">' + esc(r.p.name) + '</span>' +
          '<span class="lead-val">' + esc(r.val) + '</span>' +
          (r.delta !== undefined ? '<span class="lead-delta">' + deltaText(r.delta) + '</span>' : '') +
          '</div>';
      }).join('') +
      '</div></div></div>';
  }

  /* ---------------- Next game card ---------------- */
  function nextGameCard(st) {
    var g = Sch.next();
    if (!g) {
      if (!C.schedule.length) {
        return '<div class="card"><div class="card-body">' +
          '<div class="row gap-12"><div>' +
          '<div class="card-title">No schedule loaded</div>' +
          '<div class="hint">Add your 2026 games in <code>js/config.js</code> and they show up here with a weather forecast for each one.</div>' +
          '</div></div></div></div>';
      }
      return '<div class="card"><div class="card-body">' +
        '<div class="card-title">Season complete</div>' +
        '<div class="hint">No upcoming games on the schedule.</div></div></div>';
    }

    var wx = P10.Views._weather;
    var f = Sch.forecastFor(g.date, wx);
    var play = Sch.playability(f);

    return '<div class="card card-accent">' +
      cardHead('Next Game', Sch.countdownText(g)) +
      '<div class="card-body">' +
      '<div class="row gap-16" style="flex-wrap:wrap">' +
        '<div class="game-date" style="border:none;padding:0;width:auto">' +
          '<div class="game-mon">' + esc(g.mon) + '</div>' +
          '<div class="game-day">' + esc(g.dayNum) + '</div>' +
          '<div class="game-dow">' + esc(g.dow) + '</div>' +
        '</div>' +
        '<div class="grow">' +
          '<div class="game-vs"><span class="ha">' + (g.away ? '@' : 'vs') + '</span>' + esc(g.opponent || 'TBD') + '</div>' +
          '<div class="game-loc">' + esc(g.location || C.team.homeField || '') + (g.time ? ' · ' + esc(g.time) : '') + '</div>' +
        '</div>' +
        (f ? '<div class="stack" style="align-items:flex-end">' +
          '<div class="row gap-6"><span style="font-size:26px">' + Sch.wxIcon(f.code) + '</span>' +
          '<span class="num" style="font-size:20px">' + f.hi + '°</span></div>' +
          '<div class="text-dimmer" style="font-size:11px">' + esc(Sch.wxLabel(f.code)) + ' · ' + f.pop + '% rain</div>' +
        '</div>' : '') +
      '</div>' +
      (play ? '<div class="msg msg-' + play.cls + '">' + esc(play.text) + '</div>' : '') +
      '</div></div>';
  }

  /* ==================================================================
     ROSTER
     ================================================================== */
  var rosterSort = 'ops';

  function setRosterSort(v) { rosterSort = v; }

  function renderRoster(st) {
    var players = st.players.slice();

    if (rosterSort === 'num') {
      players.sort(function (a, b) { return (a.num === null ? 999 : a.num) - (b.num === null ? 999 : b.num); });
    } else if (rosterSort === 'name') {
      players.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    var withData = players.filter(function (p) { return p.hasData; }).length;
    set('rosterSub', withData
      ? withData + ' of ' + players.length + ' players have stats loaded · ' + S.WINDOW_LABELS[st.viewWindow]
      : players.length + ' players · no stats loaded yet');

    set('rosterGrid', players.map(function (p) { return playerCard(p, st.players); }).join(''));
  }

  function playerCard(p, all) {
    var b = p.bat || {};
    var ach = I.achievements(p, all).slice(0, 2);

    var s1, s2, s3, l1, l2, l3;
    if (p.hasData && b.ops > 0) {
      // QAB% leads when we have it - it is the most honest number at 10U.
      if (b.qab) { s1 = Math.round(b.qab * 100) + '%'; l1 = 'QAB'; }
      else { s1 = S.rate(b.avg); l1 = 'AVG'; }
      s2 = S.rate(b.obp); l2 = 'OBP';
      s3 = S.rate(b.ops); l3 = 'OPS';
    } else if (p.pit && p.pit.ip > 0) {
      s1 = S.ipText(p.pit.ip); l1 = 'IP';
      s2 = S.fixed(p.pit.era, 2); l2 = 'ERA';
      s3 = Math.round(p.pit.strike * 100) + '%'; l3 = 'STR';
    } else {
      s1 = '—'; l1 = 'AVG'; s2 = '—'; l2 = 'OBP'; s3 = '—'; l3 = 'OPS';
    }

    return '<div class="pcard" data-player="' + esc(p.name) + '">' +
      '<div class="pcard-top">' +
        '<div class="pcard-num">' + (p.num !== null && p.num !== undefined ? p.num : '–') + '</div>' +
        '<div class="pcard-id grow">' +
          '<div class="pcard-name">' + esc(p.name) + '</div>' +
          '<div class="pcard-role">' + esc(p.role) + '</div>' +
        '</div>' +
      '</div>' +
      (ach.length || p.hasData ? '<div class="pcard-flags">' +
        (p.hasData && b.ops > 0 ? '<span class="tier-badge tier-' + p.tier + '">' + S.tierName(p.tier) + '</span>' : '') +
        ach.map(function (a) { return '<span class="badge">' + esc(a.label) + '</span>'; }).join('') +
        '</div>' : '') +
      '<div class="pcard-stats">' +
        '<div class="pcard-stat"><div class="v">' + esc(s1) + '</div><div class="l">' + l1 + '</div></div>' +
        '<div class="pcard-stat"><div class="v">' + esc(s2) + '</div><div class="l">' + l2 + '</div></div>' +
        '<div class="pcard-stat"><div class="v">' + esc(s3) + '</div><div class="l">' + l3 + '</div></div>' +
      '</div></div>';
  }

  /* ==================================================================
     SORTABLE STAT TABLE
     ================================================================== */
  var tableSort = {};

  function sortTable(tableId, key) {
    var cur = tableSort[tableId];
    if (cur && cur.key === key) cur.desc = !cur.desc;
    else tableSort[tableId] = { key: key, desc: true };
  }

  function statTable(id, cols, rows, opts) {
    opts = opts || {};
    var sort = tableSort[id] || { key: opts.defaultSort || cols[1].key, desc: true };
    tableSort[id] = sort;

    var sorted = rows.slice().sort(function (a, b) {
      var col = cols.filter(function (c) { return c.key === sort.key; })[0];
      var av = col && col.sortVal ? col.sortVal(a) : (col ? col.val(a) : 0);
      var bv = col && col.sortVal ? col.sortVal(b) : (col ? col.val(b) : 0);
      if (typeof av === 'string' || typeof bv === 'string') {
        return sort.desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
      }
      av = av || 0; bv = bv || 0;
      return sort.desc ? bv - av : av - bv;
    });

    var head = '<tr>' + cols.map(function (c, i) {
      var isSorted = sort.key === c.key;
      return '<th class="' + (c.sortable === false ? '' : 'sortable ') + (i === 0 ? 'stick ' : '') +
        (isSorted ? 'sorted' : '') + '" data-table="' + id + '" data-key="' + esc(c.key) + '" title="' + esc(c.title || c.label) + '">' +
        esc(c.label) + '<span class="arrow">' + (isSorted && !sort.desc ? '▲' : '▼') + '</span></th>';
    }).join('') + '</tr>';

    var body = sorted.map(function (r, idx) {
      return '<tr class="clickable' + (idx === 0 && sort.desc && opts.highlightLeader !== false ? ' is-leader' : '') +
        '" data-player="' + esc(r.name) + '">' +
        cols.map(function (c, i) {
          return '<td' + (i === 0 ? ' class="stick"' : '') + '>' + (c.render ? c.render(r) : esc(c.val(r))) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    return '<div class="table-scroll"><table class="stat" id="' + id + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  /* ==================================================================
     BATTING
     ================================================================== */
  function renderBatting(st) {
    var rows = st.players.filter(function (p) { return p.bat && (p.bat.pa > 0 || p.bat.ab > 0 || p.bat.ops > 0); });

    if (!rows.length) { set('battingBody', sectionHead('Batting', 'Hitting stat lines') + needData()); return; }

    var bb = C.bench.batting;

    var cols = [
      { key: 'name', label: 'Player', sortable: true, val: function (p) { return p.name; }, render: playerNameCell },
      { key: 'pa', label: 'PA', title: 'Plate appearances', val: function (p) { return p.bat.pa || p.bat.ab || 0; } },
      { key: 'ab', label: 'AB', title: 'At bats', val: function (p) { return p.bat.ab; } },
      { key: 'h', label: 'H', title: 'Hits', val: function (p) { return p.bat.h; } },
      { key: 'avg', label: 'AVG', title: 'Batting average', val: function (p) { return p.bat.avg; },
        render: function (p) { return colored(S.rate(p.bat.avg), S.grade('batting', 'avg', p.bat.avg)); } },
      { key: 'obp', label: 'OBP', title: 'On-base percentage', val: function (p) { return p.bat.obp; },
        render: function (p) { return colored(S.rate(p.bat.obp), S.grade('batting', 'obp', p.bat.obp)); } },
      { key: 'slg', label: 'SLG', title: 'Slugging', val: function (p) { return p.bat.slg; },
        render: function (p) { return colored(S.rate(p.bat.slg), S.grade('batting', 'slg', p.bat.slg)); } },
      { key: 'ops', label: 'OPS', title: 'OBP + SLG', val: function (p) { return p.bat.ops; },
        render: function (p) { return '<strong>' + colored(S.rate(p.bat.ops), S.grade('batting', 'ops', p.bat.ops)) + '</strong>'; } },
      { key: 'qab', label: 'QAB%', title: 'Quality at-bat rate - the best single number at this age',
        val: function (p) { return p.bat.qab || 0; },
        render: function (p) { return p.bat.qab ? '<strong>' + colored(Math.round(p.bat.qab * 100) + '%', S.grade('batting', 'qab', p.bat.qab)) + '</strong>' : '—'; } },
      { key: 'bb', label: 'BB', title: 'Walks', val: function (p) { return p.bat.bb; } },
      { key: 'k', label: 'K', title: 'Strikeouts', val: function (p) { return p.bat.k; } },
      { key: 'kRate', label: 'K%', title: 'Strikeout rate - lower is better', val: function (p) { return p.bat.kRate; },
        render: function (p) { return p.bat.kRate ? colored(Math.round(p.bat.kRate * 100) + '%', S.grade('batting', 'kRate', p.bat.kRate)) : '—'; } },
      { key: 'sb', label: 'SB', title: 'Stolen bases', val: function (p) { return p.bat.sb; } },
      { key: 'trend', label: 'L4', title: 'OPS change over the last 4 games', sortable: true,
        val: function (p) { return p.heat; }, render: function (p) { return deltaText(p.heat); } }
    ];

    var html = sectionHead('Batting', rows.length + ' hitters · ' + S.WINDOW_LABELS[st.viewWindow]);

    html += '<div class="card mb-16">' + statTable('tblBatting', cols, rows, { defaultSort: 'ops' }) + '</div>';

    html += '<div class="grid g-2">' +
      '<div class="card">' + cardHead('OBP + SLG Split', 'What builds each OPS') +
        '<div class="card-body"><div class="chart-box"><canvas id="chartObpSlg"></canvas></div></div></div>' +
      '<div class="card">' + cardHead('Plate Discipline', 'Walk rate vs strikeout rate') +
        '<div class="card-body"><div class="chart-box"><canvas id="chartDiscipline"></canvas></div>' +
        '<div class="hint mt-8">Up and to the left is where you want to be: more walks than strikeouts. ' +
        'Green dots walk at least as often as they strike out.</div></div></div>' +
      '</div>';

    html += benchmarkCard('batting', [
      ['avg', 'Batting Average', bb.avg],
      ['obp', 'On-Base %', bb.obp],
      ['slg', 'Slugging', bb.slg],
      ['ops', 'OPS', bb.ops],
      ['qab', 'Quality At Bat %', bb.qab]
    ]);

    set('battingBody', html);
    Ch.obpSlg('chartObpSlg', rows);
    Ch.disciplineChart('chartDiscipline', rows);
  }

  function colored(text, grade) {
    var cls = S.gradeClass(grade);
    if (!cls) return esc(text);
    return '<span class="text-' + cls + '">' + esc(text) + '</span>';
  }

  function sectionHead(title, sub, right) {
    return '<div class="section-head"><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<div class="section-sub">' + esc(sub) + '</div>' : '') + '</div>' +
      (right || '') + '</div>';
  }

  function benchmarkCard(family, specs) {
    return '<div class="card mt-16">' +
      cardHead('10U Benchmarks', 'What the numbers mean at this age') +
      '<div class="card-body"><div class="table-scroll"><table class="stat" style="min-width:460px">' +
      '<thead><tr><th class="stick">Stat</th><th>Needs Work</th><th>Average</th><th>Above Avg</th><th>Elite</th></tr></thead><tbody>' +
      specs.map(function (s) {
        var b = s[2];
        var fmt = family === 'pitching' && (s[0] === 'era' || s[0] === 'whip' || s[0] === 'bbip' || s[0] === 'kip')
          ? function (v) { return S.fixed(v, 2); }
          : (b.elite < 1 && b.elite > 0 && s[0] !== 'strike') ? function (v) { return S.rate(v); }
          : s[0] === 'strike' ? function (v) { return Math.round(v * 100) + '%'; }
          : function (v) { return S.rate(v); };
        return '<tr><td class="stick"><strong>' + esc(s[1]) + '</strong></td>' +
          '<td class="text-bad">' + (b.invert ? '&gt; ' : '&lt; ') + fmt(b.watch) + '</td>' +
          '<td class="text-warn">' + fmt(b.avg) + '</td>' +
          '<td class="text-good">' + fmt(b.good) + '</td>' +
          '<td class="text-good"><strong>' + fmt(b.elite) + '</strong></td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div class="hint mt-8">These are calibrated for competitive 10U travel ball. Edit them in ' +
      '<code>js/config.js</code> if your league plays tougher or softer than this.</div>' +
      '</div></div>';
  }

  /* ==================================================================
     PITCHING
     ================================================================== */
  function renderPitching(st) {
    var rows = st.players.filter(function (p) { return p.pit && p.pit.ip > 0; });

    if (!rows.length) {
      set('pitchingBody', sectionHead('Pitching', 'Mound stat lines') +
        (st.team && st.team.withData
          ? empty('', 'No pitching data', 'The loaded export has no innings pitched. Upload a pitching CSV to fill this in.')
          : needData()));
      return;
    }

    var bp = C.bench.pitching;
    var ranked = L.pitcherRank(st.players);

    var cols = [
      { key: 'name', label: 'Pitcher', val: function (p) { return p.name; }, render: playerNameCell },
      { key: 'ip', label: 'IP', title: 'Innings pitched', val: function (p) { return p.pit.ip; },
        render: function (p) { return S.ipText(p.pit.ip); } },
      { key: 'era', label: 'ERA', title: 'Earned run average', val: function (p) { return p.pit.era; },
        render: function (p) { return colored(S.fixed(p.pit.era, 2), S.grade('pitching', 'era', p.pit.era)); } },
      { key: 'whip', label: 'WHIP', title: 'Walks + hits per inning', val: function (p) { return p.pit.whip; },
        render: function (p) { return p.pit.whip ? colored(S.fixed(p.pit.whip, 2), S.grade('pitching', 'whip', p.pit.whip)) : '—'; } },
      { key: 'strike', label: 'STR%', title: 'Percentage of pitches that are strikes', val: function (p) { return p.pit.strike; },
        render: function (p) { return p.pit.strike ? '<strong>' + colored(Math.round(p.pit.strike * 100) + '%', S.grade('pitching', 'strike', p.pit.strike)) + '</strong>' : '—'; } },
      { key: 'bb', label: 'BB', title: 'Walks', val: function (p) { return p.pit.bb; } },
      { key: 'bbip', label: 'BB/IP', title: 'Walks per inning - the number that matters most at 10U', val: function (p) { return p.pit.bbip; },
        render: function (p) { return p.pit.bbip ? colored(S.fixed(p.pit.bbip, 2), S.grade('pitching', 'bbip', p.pit.bbip)) : '—'; } },
      { key: 'k', label: 'K', title: 'Strikeouts', val: function (p) { return p.pit.k; } },
      { key: 'kip', label: 'K/IP', title: 'Strikeouts per inning', val: function (p) { return p.pit.kip; },
        render: function (p) { return p.pit.kip ? S.fixed(p.pit.kip, 2) : '—'; } },
      { key: 'pitches', label: '#P', title: 'Total pitches thrown', val: function (p) { return p.pit.pitches; },
        render: function (p) { return p.pit.pitches || '—'; } }
    ];

    var html = sectionHead('Pitching', rows.length + ' arms · ' + S.WINDOW_LABELS[st.viewWindow]);

    html += '<div class="card mb-16">' + statTable('tblPitching', cols, rows, { defaultSort: 'ip' }) + '</div>';

    html += '<div class="grid g-main">';

    html += '<div class="card">' + cardHead('Strikes vs Walks', 'Bars are strike %, line is walks per inning') +
      '<div class="card-body"><div class="chart-box"><canvas id="chartPitching"></canvas></div>' +
      '<div class="hint mt-8">At 10U, strike percentage predicts wins better than velocity or strikeouts. ' +
      'Anything over ' + Math.round(bp.strike.good * 100) + '% is a kid you can hand the ball to in a tight game.</div>' +
      '</div></div>';

    // Staff order
    html += '<div class="card">' + cardHead('Suggested Staff Order', 'Weighted toward strike-throwing') +
      '<div class="card-body flush">' +
      ranked.map(function (a, i) {
        return '<div class="lineup-slot" data-player="' + esc(a.player.name) + '" style="cursor:pointer">' +
          '<span class="slot-n">' + (i + 1) + '</span>' +
          '<span class="slot-main"><span class="slot-name">' + esc(a.player.name) + '</span>' +
          '<div class="slot-why">' + Math.round(a.strike * 100) + '% strikes · ' + S.fixed(a.bbip, 2) + ' BB/IP · ' + S.ipText(a.ip) + ' IP</div></span>' +
          '<span class="slot-grade grade-' + a.grade + '">' + a.grade + '</span>' +
          '</div>';
      }).join('') +
      '</div></div>';

    html += '</div>';

    // Pitch count guidance
    html += '<div class="card mt-16">' + cardHead('Pitch Count & Rest', 'USA Baseball guidance for ages 9-10') +
      '<div class="card-body">' +
      '<div class="msg msg-warn">Daily maximum at this age: <strong>' + C.pitchLimits.maxPerDay + ' pitches</strong>. ' +
      'This is an arm-health rule, not a suggestion.</div>' +
      '<div class="table-scroll mt-16"><table class="stat" style="min-width:380px">' +
      '<thead><tr><th class="stick">Pitches Thrown</th><th>Required Rest</th></tr></thead><tbody>' +
      C.pitchLimits.rest.map(function (r, i, arr) {
        var upper = i === 0 ? C.pitchLimits.maxPerDay : arr[i - 1].pitches - 1;
        return '<tr><td class="stick">' + r.pitches + (upper > r.pitches ? '–' + upper : '+') + '</td>' +
          '<td>' + (r.days === 0 ? 'None' : r.days + ' calendar day' + (r.days > 1 ? 's' : '')) + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div></div>';

    html += benchmarkCard('pitching', [
      ['era', 'ERA', bp.era],
      ['whip', 'WHIP', bp.whip],
      ['strike', 'Strike %', bp.strike],
      ['bbip', 'Walks / Inning', bp.bbip],
      ['kip', 'Strikeouts / Inning', bp.kip]
    ]);

    set('pitchingBody', html);
    Ch.pitchingChart('chartPitching', rows);
  }

  /* ==================================================================
     DEFENSE
     ================================================================== */
  function renderDefense(st) {
    var fld = st.players.filter(function (p) { return p.fld && (p.fld.tc > 0 || p.fld.position); });
    var cat = st.players.filter(function (p) { return p.cat && (p.cat.pb > 0 || p.cat.cs > 0 || p.cat.sba > 0); });

    if (!fld.length && !cat.length) {
      set('defenseBody', sectionHead('Defense', 'Fielding and catching') +
        (st.team && st.team.withData
          ? empty('', 'No fielding data', 'The loaded export has no fielding columns. Upload a fielding CSV to fill this in.')
          : needData()));
      return;
    }

    var html = sectionHead('Defense', 'Fielding and catching · season totals');

    if (fld.length) {
      var cols = [
        { key: 'name', label: 'Player', val: function (p) { return p.name; }, render: playerNameCell },
        { key: 'pos', label: 'Pos', sortable: false, val: function (p) { return p.fld.position || p.cfgPos || ''; },
          render: function (p) { return esc(p.fld.position || p.cfgPos || '—'); } },
        { key: 'tc', label: 'TC', title: 'Total chances', val: function (p) { return p.fld.tc; } },
        { key: 'po', label: 'PO', title: 'Putouts', val: function (p) { return p.fld.po; } },
        { key: 'a', label: 'A', title: 'Assists', val: function (p) { return p.fld.a; } },
        { key: 'e', label: 'E', title: 'Errors', val: function (p) { return p.fld.e; },
          render: function (p) { return p.fld.e > 0 ? '<span class="text-bad">' + p.fld.e + '</span>' : '0'; } },
        { key: 'fpct', label: 'FPCT', title: 'Fielding percentage', val: function (p) { return p.fld.fpct; },
          render: function (p) { return p.fld.fpct ? colored(S.rate(p.fld.fpct), S.grade('fielding', 'fpct', p.fld.fpct)) : '—'; } },
        { key: 'dp', label: 'DP', title: 'Double plays', val: function (p) { return p.fld.dp; } }
      ];
      html += '<div class="card mb-16">' + cardHead('Fielding') +
        statTable('tblFielding', cols, fld, { defaultSort: 'tc' }) + '</div>';
    }

    if (cat.length) {
      var ccols = [
        { key: 'name', label: 'Catcher', val: function (p) { return p.name; }, render: playerNameCell },
        { key: 'pb', label: 'PB', title: 'Passed balls', val: function (p) { return p.cat.pb; },
          render: function (p) { return p.cat.pb > 0 ? '<span class="text-warn">' + p.cat.pb + '</span>' : '0'; } },
        { key: 'sba', label: 'SBA', title: 'Stolen bases allowed', val: function (p) { return p.cat.sba; } },
        { key: 'cs', label: 'CS', title: 'Caught stealing', val: function (p) { return p.cat.cs; },
          render: function (p) { return p.cat.cs > 0 ? '<span class="text-good">' + p.cat.cs + '</span>' : '0'; } },
        { key: 'csPct', label: 'CS%', title: 'Caught stealing rate', val: function (p) { return p.cat.csPct; },
          render: function (p) { return p.cat.csPct ? colored(Math.round(p.cat.csPct * 100) + '%', S.grade('catching', 'csPct', p.cat.csPct)) : '—'; } }
      ];
      html += '<div class="card mb-16">' + cardHead('Catching') +
        statTable('tblCatching', ccols, cat, { defaultSort: 'cs' }) +
        '<div class="card-body"><div class="hint">At 10U most stolen bases are given away by the pitcher, not the catcher. ' +
        'Judge the catcher on passed balls and blocking first, throw-outs second.</div></div></div>';
    }

    html += benchmarkCard('fielding', [
      ['fpct', 'Fielding %', C.bench.fielding.fpct]
    ]);

    set('defenseBody', html);
  }

  /* ==================================================================
     SCHEDULE
     ================================================================== */
  function renderSchedule(st) {
    var up = Sch.upcoming(), pastGames = Sch.past();

    if (!C.schedule.length) {
      set('scheduleBody', sectionHead('Schedule', C.team.season + ' season') +
        empty('', 'No games on the schedule',
          'Add your season games to the schedule array in js/config.js. Each one gets a card with a weather forecast, and the coach lineup tools use them for matchup planning.'));
      return;
    }

    var wx = P10.Views._weather;
    var html = sectionHead('Schedule', up.length + ' upcoming · ' + pastGames.length + ' played');

    if (up.length) {
      html += '<div class="eyebrow mb-8">Upcoming</div><div class="stack gap-8 mb-24">' +
        up.map(function (g, i) { return gameCard(g, wx, i === 0, st); }).join('') + '</div>';
    }
    if (pastGames.length) {
      html += '<div class="eyebrow mb-8">Played</div><div class="stack gap-8">' +
        pastGames.map(function (g) { return gameCard(g, wx, false, st, true); }).join('') + '</div>';
    }

    set('scheduleBody', html);
  }

  function gameCard(g, wx, isNext, st, isPast) {
    var f = !isPast ? Sch.forecastFor(g.date, wx) : null;
    var play = Sch.playability(f);
    var strength = Sch.strengthOf(g.id !== undefined ? g.id : g.idx);

    return '<div class="game' + (isNext ? ' next' : '') + '" data-game="' + (g.id !== undefined ? g.id : g.idx) + '">' +
      '<div class="game-head">' +
        '<div class="game-date">' +
          '<div class="game-mon">' + esc(g.mon) + '</div>' +
          '<div class="game-day">' + esc(g.dayNum) + '</div>' +
          '<div class="game-dow">' + esc(g.dow) + '</div>' +
        '</div>' +
        '<div class="game-mid">' +
          '<div class="game-vs"><span class="ha">' + (g.away ? '@' : 'vs') + '</span>' + esc(g.opponent || 'TBD') + '</div>' +
          '<div class="game-loc">' + esc(g.location || '') + (g.time ? ' · ' + esc(g.time) : '') +
          (isNext ? ' · <span class="text-warn">' + esc(Sch.countdownText(g)) + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="game-right">' +
          (f ? '<div class="game-wx"><span class="wxi">' + Sch.wxIcon(f.code) + '</span>' +
            '<span class="num">' + f.hi + '°</span>' +
            '<span class="wxt text-dimmer">' + f.pop + '%</span></div>' : '') +
          '<span class="game-caret">▼</span>' +
        '</div>' +
      '</div>' +
      '<div class="game-body">' +
        (f ? '<div class="msg msg-' + play.cls + ' mb-16" style="margin-top:0">' +
          Sch.wxIcon(f.code) + ' ' + esc(Sch.wxLabel(f.code)) + ' · High ' + f.hi + '° / Low ' + f.lo + '° · ' +
          f.pop + '% rain · ' + f.wind + ' mph wind<br><strong>' + esc(play.text) + '</strong></div>' : '') +
        (st.coach ? coachGamePanel(g, strength, st) : parentGamePanel(g, st)) +
      '</div></div>';
  }

  function parentGamePanel(g, st) {
    return '<div class="hint">' +
      (g.away ? 'Away game' : 'Home game') +
      (g.location ? ' at ' + esc(g.location) : '') +
      (g.time ? ', first pitch ' + esc(g.time) : '') + '. ' +
      'Arrive about 45 minutes early for warmups.</div>';
  }

  function coachGamePanel(g, strength, st) {
    var gid = g.id !== undefined ? g.id : g.idx;
    var card = L.resolve(st.players, strength);
    var arms = L.pitcherRank(st.players).slice(0, 3);

    /* If we have played this club before, the scouting report replaces the
       generic suggestion - it is strictly more useful. */
    var report = P10.Matchup.render(g, st, strength);
    var hasHistory = !!P10.GameLog.headToHead(g.opponent);

    return (hasHistory ? '<div class="mb-16">' + report + '</div>' : '<div class="mb-16">' + report + '</div>') +
      '<div class="field" style="margin-bottom:14px">' +
      '<label>Opponent Strength</label>' +
      '<div class="seg" data-strength-game="' + gid + '">' +
        ['weak', 'standard', 'elite'].map(function (s) {
          return '<button class="seg-btn' + (strength === s ? ' active' : '') + '" data-strength="' + s + '">' +
            esc(L.SCENARIOS[s].label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="hint">This retunes the suggested lineup. Tougher opponent leans on on-base and contact; ' +
      'weaker opponent lets the power bats move up.</div>' +
      '</div>' +
      (card.length && !hasHistory ? '<div class="grid g-2">' +
        '<div><div class="eyebrow mb-8">Suggested Order</div>' +
        card.map(function (s) {
          return '<div class="lineup-slot"><span class="slot-n">' + s.slot + '</span>' +
            '<span class="slot-main"><span class="slot-name">' + esc(s.player.name) + '</span>' +
            '<div class="slot-why">' + esc(s.role) + '</div></span>' +
            '<span class="slot-grade grade-' + s.grade + '">' + s.grade + '</span></div>';
        }).join('') + '</div>' +
        '<div><div class="eyebrow mb-8">Arms Available</div>' +
        (arms.length ? arms.map(function (a, i) {
          return '<div class="lineup-slot"><span class="slot-n">' + (i + 1) + '</span>' +
            '<span class="slot-main"><span class="slot-name">' + esc(a.player.name) + '</span>' +
            '<div class="slot-why">' + Math.round(a.strike * 100) + '% strikes · ' + S.fixed(a.era, 2) + ' ERA</div></span>' +
            '<span class="slot-grade grade-' + a.grade + '">' + a.grade + '</span></div>';
        }).join('') : '<div class="hint">No pitching data loaded.</div>') +
        '</div></div>'
        : hasHistory ? ''
        : '<div class="hint">Load batting stats to get a suggested lineup for this game.</div>');
  }

  /* ==================================================================
     DEVELOPMENT
     ================================================================== */
  function renderDevelopment(st) {
    var players = st.players, t = st.team;

    if (!t || !t.withData) {
      set('developmentBody', sectionHead('Development', 'Drills matched to what the numbers say') + needData());
      return;
    }

    var focus = I.teamFocus(players, t);
    var html = sectionHead('Development', 'Drills are chosen from what the stats actually flag');

    /* ---- Team focus ---- */
    html += '<div class="card card-accent mb-16">' +
      cardHead('This Week\'s Team Focus', focus.length + ' area' + (focus.length === 1 ? '' : 's')) +
      '<div class="card-body">' +
      focus.map(function (f) {
        return '<div class="issue sev-' + (f.priority >= 3 ? 'high' : f.priority === 2 ? 'med' : 'low') + '">' +
          '<div class="issue-tag">' + esc((f.area || '').slice(0,3)) + '</div>' +
          '<div class="grow"><div class="issue-t">' + esc(f.title) +
          ' <span class="badge">' + esc(f.stat) + '</span> <span class="badge">' + esc(f.area) + '</span></div>' +
          '<div class="issue-d">' + esc(f.detail) + '</div></div></div>';
      }).join('') +
      '</div></div>';

    /* ---- Drills for team focus ---- */
    var teamDrills = P10.drillsFor(focus.map(function (f) { return f.key; }), 2);
    if (teamDrills.length) {
      html += '<div class="card mb-16">' +
        cardHead('Practice Plan', teamDrills.length + ' drills · about ' +
          teamDrills.reduce(function (a, d) { return a + (parseInt(d.time, 10) || 0); }, 0) + ' minutes') +
        '<div class="card-body">' + teamDrills.map(drillCard).join('') + '</div></div>';
    }

    /* ---- Per-player ---- */
    var withIssues = players
      .map(function (p) { return { p: p, issues: I.playerIssues(p) }; })
      .filter(function (x) { return x.issues.length; })
      .sort(function (a, b) { return b.issues[0].severity - a.issues[0].severity; });

    if (withIssues.length) {
      html += '<div class="section-head mt-24"><div><h2>Individual Focus</h2>' +
        '<div class="section-sub">' + withIssues.length + ' players with a flagged area. Tap a name for their full card and drills.</div></div></div>';

      html += '<div class="grid g-2">' + withIssues.map(function (x) {
        return '<div class="card"><div class="card-head" style="cursor:pointer" data-player="' + esc(x.p.name) + '">' +
          '<div class="card-title">' +
          '<span class="pnum">' + (x.p.num !== null ? x.p.num : '–') + '</span> ' + esc(x.p.name) + '</div>' +
          '<div class="card-note">' + x.issues.length + ' area' + (x.issues.length === 1 ? '' : 's') + '</div></div>' +
          '<div class="card-body">' +
          x.issues.slice(0, 3).map(function (is) {
            return '<div class="issue sev-' + (is.severity >= 3 ? 'high' : is.severity === 2 ? 'med' : 'low') + '">' +
              '<div class="grow"><div class="issue-t">' + esc(is.title) + ' <span class="badge">' + esc(is.area) + '</span></div>' +
              '<div class="issue-d">' + esc(is.detail) + '</div></div></div>';
          }).join('') +
          '<button class="btn btn-ghost btn-block mt-8" data-player="' + esc(x.p.name) + '">Open Player Card</button>' +
          '</div></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="card mt-16"><div class="card-body">' +
        '<div class="msg msg-good">Nobody is flagging below the 10U benchmarks right now. ' +
        'Good time to work on situational baseball and baserunning.</div></div></div>';
    }

    set('developmentBody', html);
  }

  function drillCard(d) {
    var audience = d.audience === 'coach' ? 'Team practice'
      : d.audience === 'parent' ? 'Backyard'
      : 'On their own';
    return '<div class="drill">' +
      '<div class="drill-h"><div class="drill-t">' + esc(d.title) + '</div>' +
      '<span class="badge">' + esc(d.time) + '</span></div>' +
      '<div class="drill-cue">' + esc(d.cue) + '</div>' +
      '<ol class="drill-steps">' + d.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<div class="drill-meta"><span class="badge">' + esc(audience) + '</span>' +
      '<span class="badge">' + esc(d.gear) + '</span></div>' +
      '</div>';
  }

  /* ==================================================================
     LINEUP (coach)
     ================================================================== */
  var lineupScenario = 'standard';
  function setLineupScenario(v) { lineupScenario = v; }

  function renderLineup(st) {
    if (!st.coach) { set('lineupBody', lockedCard('Lineup Builder')); return; }

    var eligible = st.players.filter(function (p) { return p.bat && p.bat.ops > 0; });
    if (!eligible.length) {
      set('lineupBody', sectionHead('Lineup Builder', 'Coach tools') + needData());
      return;
    }

    var card = L.resolve(st.players, lineupScenario);
    var benchList = L.bench(st.players, card);
    var isManual = !!(st.lineups[lineupScenario] && st.lineups[lineupScenario].length);

    var html = sectionHead('Lineup Builder', 'Ratings weight on-base and contact, not just OPS',
      '<div class="seg" id="scenarioSeg">' +
        ['weak', 'standard', 'elite'].map(function (s) {
          return '<button class="seg-btn' + (lineupScenario === s ? ' active' : '') + '" data-scenario="' + s + '">' +
            esc(L.SCENARIOS[s].label) + '</button>';
        }).join('') + '</div>');

    html += '<div class="grid g-main">';

    /* ---- Card ---- */
    html += '<div class="card card-accent">' +
      '<div class="card-head"><div class="card-title">Batting Order</div>' +
      '<div class="row gap-8"><span class="card-note">' + (isManual ? 'Edited' : 'Suggested') + '</span>' +
      (isManual ? '<button class="btn btn-sm btn-ghost" id="resetLineup">Reset</button>' : '') +
      '</div></div>' +
      '<div class="card-body flush">' +
      card.map(function (s) {
        return '<div class="lineup-slot">' +
          '<span class="slot-n">' + s.slot + '</span>' +
          '<span class="slot-main">' +
            '<span class="slot-name">' + esc(s.player.name) +
            ' <span class="text-dimmer" style="font-weight:400">#' + (s.player.num !== null ? s.player.num : '–') + '</span></span>' +
            '<div class="slot-why">' + esc(s.why) + '</div>' +
          '</span>' +
          '<span class="slot-grade grade-' + s.grade + '" title="Fit for this spot">' + s.grade + '</span>' +
          '<button class="icon-btn" data-swap-slot="' + (s.slot - 1) + '" title="Change this spot">⇄</button>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div class="card-body" style="border-top:1px solid var(--line-soft)">' +
      '<div class="hint">Grades are fit for <em>that specific spot</em>, not overall quality. ' +
      'A great power bat can grade C in the leadoff spot and A in the four-hole. ' +
      'Use ⇄ to override any slot - your edits stick until you reset.</div>' +
      '<button class="btn btn-ghost btn-block mt-8" id="printLineup">Print / Save Lineup Card</button>' +
      '</div></div>';

    /* ---- Right column ---- */
    html += '<div class="stack gap-16">';

    if (benchList.length) {
      html += '<div class="card">' + cardHead('Not In The Order', benchList.length + ' players') +
        '<div class="card-body flush">' +
        benchList.map(function (p) {
          var best = p.bat && p.bat.ops > 0 ? L.bestSlot(p, lineupScenario) : null;
          return '<div class="lineup-slot" data-player="' + esc(p.name) + '" style="cursor:pointer">' +
            '<span class="slot-n">' + (p.num !== null ? p.num : '–') + '</span>' +
            '<span class="slot-main"><span class="slot-name">' + esc(p.name) + '</span>' +
            '<div class="slot-why">' + (best ? 'Best fit: spot ' + best.slot + ' · ' + best.role : 'No batting data') + '</div></span>' +
            (best ? '<span class="slot-grade grade-' + best.grade + '">' + best.grade + '</span>' : '') +
            '</div>';
        }).join('') + '</div></div>';
    }

    // Speed tags
    html += '<div class="card">' + cardHead('Speed Tags', 'Improves lineup accuracy') +
      '<div class="card-body">' +
      '<div class="hint mb-16">Stolen bases are a rough proxy for speed. Tag each kid and the leadoff and nine-hole ' +
      'ratings get noticeably better.</div>' +
      st.players.filter(function (p) { return p.bat && p.bat.ops > 0; }).map(function (p) {
        var cur = (st.gameState.speeds || {})[p.name] || '';
        return '<div class="row gap-8 mb-8"><span class="grow" style="font-size:12.5px">' + esc(p.name) + '</span>' +
          '<div class="seg" data-speed-player="' + esc(p.name) + '">' +
          ['slow', 'normal', 'fast'].map(function (s) {
            return '<button class="seg-btn' + (cur === s ? ' active' : '') + '" data-speed="' + s + '">' +
              s.charAt(0).toUpperCase() + s.slice(1) + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '</div></div>';

    html += '</div></div>';

    set('lineupBody', html);
  }

  function lockedCard(what) {
    return '<div class="card"><div class="empty">' +
      '<div class="empty-rule"></div>' +
      '<div class="empty-t">' + esc(what) + ' is coach-only</div>' +
      '<div class="empty-d">This section holds lineup decisions and playing-time analysis. ' +
      'Enter the coach passcode in Settings to unlock it.</div>' +
      '<button class="btn btn-primary" id="unlockFromLock">Enter Coach Code</button>' +
      '</div></div>';
  }

  /* ==================================================================
     MANAGE (coach)
     ================================================================== */
  function renderManage(st) {
    if (!st.coach) { set('manageBody', lockedCard('Manage')); return; }

    var meta = st.meta || {};
    var loaded = [];
    ['batting', 'pitching', 'fielding', 'catching'].forEach(function (cat) {
      Object.keys(st.data[cat] || {}).forEach(function (w) {
        var set_ = st.data[cat][w];
        loaded.push({ cat: cat, win: w, rows: set_.data.length, file: set_.file || '' });
      });
    });

    var html = sectionHead('Manage', 'Upload stats, publish, and check playing time');

    /* ---- Upload ---- */
    html += '<div class="card card-accent mb-16">' +
      cardHead('Upload GameChanger CSVs', 'Drop several at once') +
      '<div class="card-body">' +
      '<div class="dropzone" id="dropzone">' +
        '<input type="file" id="fileInput" multiple accept=".csv,text/csv" hidden>' +
        
        '<div class="dropzone-t">Drop CSVs here or click to browse</div>' +
        '<div class="dropzone-h">Batting · Pitching · Fielding · Catching. Name files with the window ' +
        '("season", "last 8", "last 4") and they sort themselves.</div>' +
      '</div>' +
      '<div id="fileList"></div>' +
      '<div id="uploadMsg"></div>' +
      '<div class="row gap-8 mt-16" style="justify-content:flex-end">' +
        '<button class="btn btn-ghost" id="clearFiles">Clear</button>' +
        '<button class="btn btn-primary" id="processFiles" disabled>Update Dashboard</button>' +
      '</div>' +
      '</div></div>';

    /* ---- Loaded data ---- */
    html += '<div class="card mb-16">' +
      cardHead('Loaded Data',
        (meta.updatedAt ? 'Updated ' + timeAgo(meta.updatedAt) : 'Nothing loaded') +
        (meta.publishedAt ? ' · published ' + timeAgo(meta.publishedAt) : ' · never published')) +
      '<div class="card-body">' +
      (loaded.length
        ? '<div class="table-scroll"><table class="stat" style="min-width:420px">' +
          '<thead><tr><th class="stick">Category</th><th>Window</th><th>Players</th><th>File</th></tr></thead><tbody>' +
          loaded.map(function (l) {
            return '<tr><td class="stick">' + esc(l.cat.charAt(0).toUpperCase() + l.cat.slice(1)) + '</td>' +
              '<td>' + esc(S.WINDOW_LABELS[l.win] || l.win) + '</td>' +
              '<td>' + l.rows + '</td>' +
              '<td class="text-dimmer" style="text-align:right;max-width:180px;overflow:hidden;text-overflow:ellipsis">' + esc(l.file) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="hint">No stat files loaded yet.</div>') +
      '<div class="row gap-8 mt-16" style="flex-wrap:wrap">' +
        '<button class="btn btn-ghost" id="exportData">Export Backup</button>' +
        '<button class="btn btn-ghost" id="importData">Import Backup</button>' +
        '<button class="btn btn-primary" id="publishData">Publish For Everyone</button>' +
        '<button class="btn btn-ghost" id="loadSample">Load Sample Data</button>' +
        '<button class="btn btn-danger" id="clearData">Clear All Data</button>' +
      '</div>' +
      '<div class="hint mt-8"><strong>Load Sample Data</strong> fills every screen with fake numbers so you ' +
      'can see how the app behaves before real stats exist. A banner appears while it is on, and ' +
      'Clear All Data removes it completely.</div>' +
      '<div class="hint mt-8">Uploading a CSV changes <em>this device</em>. ' +
      '<strong>Publishing</strong> writes it to the site so every phone and laptop gets it. ' +
      'A CSV upload publishes on its own; this button is for pushing again after edits ' +
      'like lineups or the game log.</div>' +
      '<div id="publishState" class="mt-8"></div>' +
      '</div></div>';

    /* ---- Playing time ---- */
    var gaps = I.opportunityGaps(st.players);
    if (st.players.some(function (p) { return p.bat && p.bat.pa > 0; })) {
      html += '<div class="card mb-16">' +
        cardHead('Playing Time', 'Plate appearances per player') +
        '<div class="card-body">' +
        '<div class="chart-box"><canvas id="chartPlayingTime"></canvas></div>' +
        (gaps.length
          ? '<div class="msg msg-warn mt-16"><strong>' + gaps.length + ' player' + (gaps.length > 1 ? 's are' : ' is') +
            ' getting noticeably fewer at-bats:</strong> ' +
            gaps.map(function (g) { return esc(g.player.name) + ' (' + g.pa + ' PA, ' + g.gap + '% below the median)'; }).join(', ') +
            '. At 10U, reps are how kids get better - a kid who does not hit does not improve.</div>'
          : '<div class="msg msg-good mt-16">Plate appearances are spread evenly across the roster. That is exactly right for this age.</div>') +
        '</div></div>';
    }

    /* ---- Team photos ---- */
    html += '<div class="card mb-16">' +
      cardHead('Team Photos', 'Shared with everyone') +
      '<div class="card-body">' +
      '<div class="hint mb-16">The site is static, so there is no server for a phone to upload to. ' +
      'A photo a parent adds lives on their device and nowhere else. The photos <strong>everybody</strong> ' +
      'sees are files committed to <code>assets/players/</code>. Add them here, download the pack, ' +
      'drop the files in that folder and push - then they are on every device.</div>' +
      '<div class="photogrid">' +
      st.players.map(function (p) {
        var local = P10.Cards.getPhoto(p.name);
        return '<div class="photocell" data-photo-player="' + esc(p.name) + '">' +
          '<div class="pc-img' + (local || P10.Cards.hasTeamPhoto(p.name) ? '' : ' none') + '">' +
            (local ? '<img src="' + local + '" alt="">'
             : P10.Cards.hasTeamPhoto(p.name)
               ? '<img src="' + esc(P10.Cards.teamPhotoUrl(p.name)) + '" alt="">'
               : '') +
            '<span class="pc-add">＋</span>' +
          '</div>' +
          '<div class="pc-name">' + esc(p.short || p.name) + '</div>' +
          '<div class="pc-src">' + (local ? 'This device' : P10.Cards.hasTeamPhoto(p.name) ? 'Team photo' : 'None') + '</div>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div class="row gap-8 mt-16" style="flex-wrap:wrap">' +
        '<button class="btn btn-primary" id="downloadPhotos">Download Photo Pack</button>' +
        '<button class="btn btn-ghost" id="clearPhotos">Clear My Local Photos</button>' +
      '</div>' +
      '<div class="hint mt-8">The pack saves each photo already named the way the site expects ' +
      '(<code>jackson-lewis.jpg</code>). Nothing to rename.</div>' +
      '</div></div>';

    /* ---- Game log ---- */
    html += P10.Matchup.renderLog(st);

    /* ---- Roster editor note ---- */
    html += '<div class="card">' + cardHead('Roster & Schedule') +
      '<div class="card-body">' +
      '<div class="hint">Roster names, jersey numbers, the schedule, the coach passcode and the 10U benchmarks all live in ' +
      '<code>js/config.js</code>. Edit that one file and redeploy - nothing else needs to change.</div>' +
      '<div class="table-scroll mt-16"><table class="stat" style="min-width:340px">' +
      '<thead><tr><th class="stick">#</th><th style="text-align:left">Player</th><th>Stats?</th></tr></thead><tbody>' +
      C.roster.map(function (r) {
        var p = st.players.filter(function (x) { return x.name === r.name; })[0];
        return '<tr><td class="stick">' + r.num + '</td>' +
          '<td style="text-align:left">' + esc(r.name) + '</td>' +
          '<td>' + (p && p.hasData ? '<span class="text-good">Yes</span>' : '<span class="text-dimmer">No</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '</div></div>';

    set('manageBody', html);
    Ch.playingTime('chartPlayingTime', st.players);
  }

  function timeAgo(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return 'unknown';
    var mins = Math.floor((Date.now() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    return d.toLocaleDateString();
  }

  /* ==================================================================
     PLAYER DRAWER
     ================================================================== */
  function renderDrawer(name, st) {
    var p = st.players.filter(function (x) { return x.name === name; })[0];
    if (!p) return;

    $('drawerNum').textContent = p.num !== null && p.num !== undefined ? p.num : '–';
    $('drawerName').textContent = p.name;
    $('drawerRole').textContent = p.role + (p.hasData && p.bat && p.bat.ops > 0 ? ' · ' + S.tierName(p.tier) : '');

    var html = '';

    /* The baseball card leads every player view. It mounts after the rest
       of the drawer is written so the reveal spin plays on a settled DOM. */
    html += '<div id="cardHost"></div>';

    if (!p.hasData) {
      html += '<div class="empty" style="padding-top:8px"><div class="empty-t">No stats yet</div>' +
        '<div class="empty-d">' + esc(p.name) + ' is on the roster but has no stat lines in the loaded data. ' +
        'The card fills in automatically once stats are uploaded.</div></div>';
      set('drawerBody', html);
      P10.Cards.mount($('cardHost'), p, st.players);
      return;
    }

    var ach = I.achievements(p, st.players);
    if (ach.length) {
      html += '<div class="dsec"><div class="row gap-4" style="flex-wrap:wrap">' +
        ach.map(function (a) { return '<span class="ach">' + esc(a.label) + '</span>'; }).join('') +
        '</div></div>';
    }

    /* ---- Batting ---- */
    if (p.bat && (p.bat.ops > 0 || p.bat.pa > 0)) {
      html += '<div class="dsec"><div class="dsec-h">Batting · ' + esc(S.WINDOW_LABELS[st.viewWindow]) + '</div>' +
        '<div class="dstats">' +
        dstat(S.rate(p.bat.avg), 'AVG', S.grade('batting', 'avg', p.bat.avg)) +
        dstat(S.rate(p.bat.obp), 'OBP', S.grade('batting', 'obp', p.bat.obp)) +
        dstat(S.rate(p.bat.slg), 'SLG', S.grade('batting', 'slg', p.bat.slg)) +
        dstat(S.rate(p.bat.ops), 'OPS', S.grade('batting', 'ops', p.bat.ops)) +
        '</div>' +
        '<div class="dstats mt-8">' +
        dstat(p.bat.qab ? Math.round(p.bat.qab * 100) + '%' : '—', 'QAB', S.grade('batting', 'qab', p.bat.qab)) +
        dstat(p.bat.pa || p.bat.ab, 'PA') +
        dstat(p.bat.h, 'HITS') +
        dstat(p.bat.bb, 'BB') +
        '</div>';

      // team rank meters
      var meters = [];
      [['OPS', 'ops'], ['OBP', 'obp'], ['SLG', 'slg'], ['Contact', 'kRate']].forEach(function (m) {
        if (p.pct[m[1]]) meters.push({ label: m[0], pct: p.pct[m[1]], rank: p.rank[m[1]], of: p.rankOf[m[1]] });
      });
      if (meters.length) {
        html += '<div class="mt-16"><div class="eyebrow mb-8">Team Rank</div>' +
          meters.map(function (m) {
            var cls = m.pct >= 70 ? 'good' : m.pct >= 40 ? '' : 'warn';
            return '<div class="meter-row"><span class="ml">' + esc(m.label) + '</span>' +
              '<span class="meter"><span class="meter-fill ' + cls + '" style="width:' + m.pct + '%"></span></span>' +
              '<span class="mv">' + S.ordinal(m.rank) + '</span></div>';
          }).join('') +
          '<div class="hint mt-8">Out of ' + meters[0].of + ' players with enough at-bats to compare. ' +
          '"Contact" ranks by strikeout rate, so first place means he strikes out least.</div>' +
          '</div>';
      }

      html += '<div class="mt-16"><div class="eyebrow mb-8">OPS Trend</div>' +
        '<div class="chart-box short"><canvas id="chartDrawerSpark"></canvas></div></div>';

      html += '</div>';
    }

    /* ---- Pitching ---- */
    if (p.pit && p.pit.ip > 0) {
      html += '<div class="dsec"><div class="dsec-h">Pitching</div>' +
        '<div class="dstats">' +
        dstat(S.ipText(p.pit.ip), 'IP') +
        dstat(S.fixed(p.pit.era, 2), 'ERA', S.grade('pitching', 'era', p.pit.era)) +
        dstat(p.pit.strike ? Math.round(p.pit.strike * 100) + '%' : '—', 'STRIKE', S.grade('pitching', 'strike', p.pit.strike)) +
        dstat(S.fixed(p.pit.bbip, 2), 'BB/IP', S.grade('pitching', 'bbip', p.pit.bbip)) +
        '</div></div>';
    }

    /* ---- Fielding ---- */
    if (p.fld && p.fld.tc > 0) {
      html += '<div class="dsec"><div class="dsec-h">Fielding</div>' +
        '<div class="dstats">' +
        dstat(p.fld.tc, 'CHANCES') +
        dstat(p.fld.po, 'PUTOUTS') +
        dstat(p.fld.e, 'ERRORS') +
        dstat(p.fld.fpct ? S.rate(p.fld.fpct) : '—', 'FPCT', S.grade('fielding', 'fpct', p.fld.fpct)) +
        '</div></div>';
    }

    /* ---- Catching ---- */
    if (p.cat && (p.cat.pb > 0 || p.cat.sba > 0 || p.cat.cs > 0)) {
      html += '<div class="dsec"><div class="dsec-h">Catching</div>' +
        '<div class="dstats">' +
        dstat(p.cat.pb, 'PB') +
        dstat(p.cat.cs, 'CS') +
        dstat(p.cat.sba, 'SB ALLOWED') +
        dstat(p.cat.csPct ? Math.round(p.cat.csPct * 100) + '%' : '—', 'CS%') +
        '</div></div>';
    }

    /* ---- Strengths ---- */
    var strengths = I.playerStrengths(p);
    if (strengths.length) {
      html += '<div class="dsec"><div class="dsec-h">What He Does Well</div>' +
        strengths.map(function (s) {
          return '<div class="issue sev-low" style="border-left-color:var(--good)">' +
            '<div class="issue-tag ok">OK</div><div class="issue-d">' + esc(s) + '</div></div>';
        }).join('') + '</div>';
    }

    /* ---- Issues + drills ---- */
    var issues = I.playerIssues(p);
    if (issues.length) {
      html += '<div class="dsec"><div class="dsec-h">Work On This</div>' +
        issues.map(function (is) {
          return '<div class="issue sev-' + (is.severity >= 3 ? 'high' : is.severity === 2 ? 'med' : 'low') + '">' +
            '<div class="grow"><div class="issue-t">' + esc(is.title) + ' <span class="badge">' + esc(is.area) + '</span></div>' +
            '<div class="issue-d">' + esc(is.detail) + '</div></div></div>';
        }).join('') + '</div>';

      var drills = P10.drillsFor(issues.map(function (i2) { return i2.key; }), 2);
      if (drills.length) {
        html += '<div class="dsec"><div class="dsec-h">Drills That Fix It</div>' +
          drills.map(drillCard).join('') + '</div>';
      }
    }

    /* ---- Lineup fit (coach only) ---- */
    if (st.coach && p.bat && p.bat.ops > 0) {
      html += '<div class="dsec"><div class="dsec-h">Lineup Fit</div>' +
        '<div class="table-scroll"><table class="stat" style="min-width:0">' +
        '<thead><tr><th class="stick">Spot</th><th style="text-align:left">Role</th><th>Fit</th></tr></thead><tbody>' +
        [1,2,3,4,5,6,7,8,9].map(function (slot) {
          var sc = L.fitScore(p, slot, lineupScenario);
          var g = L.grade(sc);
          return '<tr><td class="stick">' + slot + '</td>' +
            '<td style="text-align:left">' + esc(L.SLOTS[slot].label) + '</td>' +
            '<td><span class="slot-grade grade-' + g + '" style="display:inline-flex">' + g + '</span></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    set('drawerBody', html);
    P10.Cards.mount($('cardHost'), p, st.players);
    if (p.bat && p.bat.ops > 0) Ch.playerSpark('chartDrawerSpark', p);
  }

  function dstat(v, l, grade) {
    var cls = grade ? ' text-' + S.gradeClass(grade) : '';
    return '<div class="dstat"><div class="v' + cls + '">' + esc(v) + '</div><div class="l">' + esc(l) + '</div></div>';
  }

  /* ==================================================================
     EXPORT
     ================================================================== */
  return {
    _weather: null,
    esc: esc,
    renderHero: renderHero,
    sampleBanner: sampleBanner,
    renderStatbar: renderStatbar,
    renderDashboard: renderDashboard,
    renderRoster: renderRoster,
    renderBatting: renderBatting,
    renderPitching: renderPitching,
    renderDefense: renderDefense,
    renderSchedule: renderSchedule,
    renderDevelopment: renderDevelopment,
    renderLineup: renderLineup,
    renderManage: renderManage,
    renderDrawer: renderDrawer,
    setRosterSort: setRosterSort,
    setLineupScenario: setLineupScenario,
    getLineupScenario: function () { return lineupScenario; },
    sortTable: sortTable,
    timeAgo: timeAgo,
    drillCard: drillCard
  };
})();
