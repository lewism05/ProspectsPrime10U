/* ==========================================================================
   PROSPECTS PRIME 10U — SEASON REVIEW

   Every other page reads aggregate exports (season / last 8 / last 4).
   This one reads data/games.json, which holds the box score of every game,
   so it can answer the questions the aggregates cannot: how the team
   scores game to game, who is hot right now, which arms have been leaned
   on, and where each kid has actually played.

   Nothing here is typed in by hand. data/games.json is built straight from
   the per-game GameChanger exports (tools/build_data.py), and every number
   on this page is computed from it at render time.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Season = (function () {
  'use strict';

  var S = P10.Stats;
  var C = P10.CONFIG;
  var esc = function (s) { return P10.Views.esc(s); };

  var DATA_URL = 'data/games.json';
  var cache = null, loading = false, failed = false;
  var charts = {};
  var openGame = null;

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function sum(arr, fn) { return arr.reduce(function (a, x) { return a + (fn(x) || 0); }, 0); }
  function rate(v, dec) { return S.rate(v, dec === undefined ? 3 : dec); }
  function fmtDate(iso, long) {
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1];
    return long ? m + ' ' + (+p[2]) : (+p[1]) + '/' + (+p[2]);
  }
  function shortOpp(name) {
    return String(name || '').replace(/\b10U\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function ipText(outs) { return Math.floor(outs / 3) + '.' + (outs % 3); }
  function obpOf(b) {
    var den = b.ab + b.bb + b.hbp;
    return den ? (b.h + b.bb + b.hbp) / den : 0;
  }
  function slgOf(b) { return b.ab ? (b.b1 + 2 * b.b2 + 3 * b.b3 + 4 * b.hr) / b.ab : 0; }
  function opsOf(b) { return obpOf(b) + slgOf(b); }
  function addBat(a, b) {
    ['pa', 'ab', 'h', 'b1', 'b2', 'b3', 'hr', 'rbi', 'r', 'bb', 'k', 'hbp', 'sb', 'cs', 'qab', 'roe'].forEach(function (k) {
      a[k] = (a[k] || 0) + (b[k] || 0);
    });
    return a;
  }
  function cardHead(title, note) {
    return '<div class="card-head"><div class="card-title">' + esc(title) + '</div>' +
      (note ? '<div class="card-note">' + esc(note) + '</div>' : '') + '</div>';
  }
  function sectionHead(title, sub) {
    return '<div class="section-head"><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<div class="section-sub">' + esc(sub) + '</div>' : '') + '</div></div>';
  }
  function tile(lab, val, cls, note) {
    return '<div class="tile">' +
      '<div class="tile-lab">' + esc(lab) + '</div>' +
      '<div class="tile-val">' + esc(val) + '</div>' +
      (note ? '<div class="tile-trend ' + (cls || '') + '">' + esc(note) + '</div>' : '') +
      '</div>';
  }
  function signed(n) { return (n > 0 ? '+' : '') + n; }

  /* ---------------- data ---------------- */
  function load() {
    if (cache || loading) return;
    loading = true;
    fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        loading = false;
        if (!json || !json.games) { failed = true; }
        else { cache = json; }
        if ($('page-season') && $('page-season').classList.contains('active')) render(P10.Store.state);
      })
      .catch(function () { loading = false; failed = true; if ($('seasonBody')) render(P10.Store.state); });
  }

  /* ==================================================================
     ANALYSIS - everything below is derived from the game list
     ================================================================== */
  function analyze(d) {
    var games = d.games.slice().sort(function (a, b) { return a.n - b.n; });
    var A = { games: games };

    A.w = games.filter(function (g) { return g.result === 'W'; }).length;
    A.l = games.filter(function (g) { return g.result === 'L'; }).length;
    A.t = games.length - A.w - A.l;
    A.rf = sum(games, function (g) { return g.us; });
    A.ra = sum(games, function (g) { return g.them; });

    /* streak, read from the most recent game backwards */
    var last = games[games.length - 1], n = 0;
    for (var i = games.length - 1; i >= 0 && games[i].result === last.result; i--) n++;
    A.streak = { kind: last.result, n: n };

    function rec(list) {
      var w = list.filter(function (g) { return g.result === 'W'; }).length;
      var l = list.filter(function (g) { return g.result === 'L'; }).length;
      return { w: w, l: l, n: list.length, text: w + '-' + l };
    }
    A.last4 = rec(games.slice(-4));
    A.oneRun = rec(games.filter(function (g) { return Math.abs(g.us - g.them) === 1; }));
    A.blowouts = rec(games.filter(function (g) { return Math.abs(g.us - g.them) >= 8; }));
    A.home = rec(games.filter(function (g) { return !g.away; }));
    A.away = rec(games.filter(function (g) { return g.away; }));
    A.eightPlus = rec(games.filter(function (g) { return g.us >= 8; }));
    A.underEight = rec(games.filter(function (g) { return g.us < 8; }));

    /* weekends / tournaments */
    var wk = {}, wkOrder = [];
    games.forEach(function (g) {
      var k = g.weekend || g.date;
      if (!wk[k]) { wk[k] = []; wkOrder.push(k); }
      wk[k].push(g);
    });
    A.weekends = wkOrder.map(function (k) {
      var r = rec(wk[k]);
      r.label = k; r.rf = sum(wk[k], function (g) { return g.us; }); r.ra = sum(wk[k], function (g) { return g.them; });
      return r;
    });

    /* splits in wins vs losses */
    function split(list) {
      var bat = {}; list.forEach(function (g) { addBat(bat, g.team.bat); });
      var outs = sum(list, function (g) { return g.team.pit ? g.team.pit.outs : 0; });
      var bbA = sum(list, function (g) { return g.team.pit ? g.team.pit.bb : 0; });
      var kA = sum(list, function (g) { return g.team.pit ? g.team.pit.k : 0; });
      var e = sum(list, function (g) { return g.team.fld ? g.team.fld.e : 0; });
      var pitches = sum(list, function (g) { return g.team.pit ? g.team.pit.pitches : 0; });
      var sp = sum(list, function (g) { return g.team.pit && g.team.pit.strikePct ? g.team.pit.strikePct * g.team.pit.pitches : 0; });
      return {
        n: list.length, bat: bat,
        avg: bat.ab ? bat.h / bat.ab : 0, obp: obpOf(bat), ops: opsOf(bat),
        bbPer: list.length ? bat.bb / list.length : 0, kPer: list.length ? bat.k / list.length : 0,
        runsPer: list.length ? sum(list, function (g) { return g.us; }) / list.length : 0,
        raPer: list.length ? sum(list, function (g) { return g.them; }) / list.length : 0,
        bbAllowedIp: outs ? bbA / (outs / 3) : 0, kAllowedIp: outs ? kA / (outs / 3) : 0,
        strikePct: pitches ? sp / pitches : null,
        ePer: list.length ? e / list.length : 0,
        sbPer: list.length ? bat.sb / list.length : 0
      };
    }
    A.wins = split(games.filter(function (g) { return g.result === 'W'; }));
    A.losses = split(games.filter(function (g) { return g.result === 'L'; }));
    A.all = split(games);
    A.recent = split(games.slice(-4));

    /* per player, by game */
    var byName = {};
    games.forEach(function (g, gi) {
      g.players.forEach(function (p) {
        var e = byName[p.name] || (byName[p.name] = {
          name: p.name, num: p.num, gp: 0, season: {}, games: [], pit: [], pos: {}, cat: null
        });
        e.gp++;
        addBat(e.season, p.bat);
        e.games[gi] = p;
        if (p.pit && p.pit.outs > 0) e.pit.push({ game: g, line: p.pit });
        Object.keys(p.pos || {}).forEach(function (k) { e.pos[k] = (e.pos[k] || 0) + p.pos[k]; });
        if (p.cat) {
          e.cat = e.cat || { outs: 0, pb: 0, sb: 0, att: 0, cs: 0 };
          e.cat.outs += p.cat.outs; e.cat.pb += p.cat.pb; e.cat.sb += p.cat.sb; e.cat.att += p.cat.att; e.cat.cs += p.cat.cs;
        }
      });
    });
    A.players = Object.keys(byName).map(function (k) {
      var e = byName[k];
      /* cumulative OPS after each game, for the sparkline */
      var cum = {}, series = [];
      games.forEach(function (g, gi) {
        var p = e.games[gi];
        if (p) addBat(cum, p.bat);
        series.push(cum.ab >= 3 ? opsOf(cum) : null);
      });
      e.series = series;
      var l4 = {};
      games.slice(-4).forEach(function (g) {
        var p = e.games[g.n - 1]; if (p) addBat(l4, p.bat);
      });
      e.last4 = l4;
      e.last4ops = l4.ab ? opsOf(l4) : null;
      e.seasonOps = e.season.ab ? opsOf(e.season) : null;
      e.delta = (e.last4ops !== null && e.seasonOps !== null) ? e.last4ops - e.seasonOps : null;
      /* hitting streak: games with a hit, counted back from the latest appearance */
      var streak = 0;
      for (var gi = games.length - 1; gi >= 0; gi--) {
        var p = e.games[gi];
        if (!p) continue;
        if (p.bat.h > 0) streak++; else if (p.bat.ab > 0) break; else continue;
      }
      e.hitStreak = streak;
      e.multiHit = e.games.filter(function (p) { return p && p.bat.h >= 2; }).length;
      e.onBaseGames = e.games.filter(function (p) { return p && (p.bat.h + p.bat.bb + p.bat.hbp) > 0; }).length;
      e.outs = sum(e.pit, function (o) { return o.line.outs; });
      e.pitches = sum(e.pit, function (o) { return o.line.pitches; });
      e.maxPitches = e.pit.reduce(function (m, o) { return Math.max(m, o.line.pitches); }, 0);
      e.pitBB = sum(e.pit, function (o) { return o.line.bb; });
      e.pitK = sum(e.pit, function (o) { return o.line.k; });
      e.pitR = sum(e.pit, function (o) { return o.line.r; });
      e.pitER = sum(e.pit, function (o) { return o.line.er; });
      var sp = sum(e.pit, function (o) { return o.line.strikePct ? o.line.strikePct * o.line.pitches : 0; });
      e.strikePct = e.pitches ? sp / e.pitches : null;
      e.posTotal = Object.keys(e.pos).reduce(function (a, k) { return a + e.pos[k]; }, 0);
      return e;
    });
    A.players.sort(function (a, b) { return (b.seasonOps || 0) - (a.seasonOps || 0); });

    /* heavy outings against the daily guidance */
    var max = C.pitchLimits && C.pitchLimits.maxPerDay || 75;
    A.heavy = [];
    A.players.forEach(function (e) {
      e.pit.forEach(function (o) {
        if (o.line.pitches > max) A.heavy.push({ name: e.name, game: o.game, pitches: o.line.pitches, outs: o.line.outs });
      });
    });
    A.heavy.sort(function (a, b) { return b.pitches - a.pitches; });
    A.maxPitches = max;

    /* head to head, every club we have seen more than once first */
    var opp = {}, oppOrder = [];
    games.forEach(function (g) {
      var k = P10.GameLog.oppKey(g.opponent);
      if (!opp[k]) { opp[k] = { name: g.opponent, games: [] }; oppOrder.push(k); }
      opp[k].games.push(g);
    });
    A.opponents = oppOrder.map(function (k) {
      var o = opp[k], r = rec(o.games);
      r.name = o.name; r.games = o.games;
      r.rf = sum(o.games, function (g) { return g.us; }); r.ra = sum(o.games, function (g) { return g.them; });
      return r;
    }).sort(function (a, b) { return b.n - a.n || (b.rf - b.ra) - (a.rf - a.ra); });

    /* team per-game series for charts */
    A.series = games.map(function (g) {
      var b = g.team.bat;
      return {
        label: fmtDate(g.date) + ' ' + (g.away ? '@ ' : 'vs ') + shortOpp(g.opponent),
        us: g.us, them: g.them, diff: g.us - g.them, result: g.result,
        obp: obpOf(b), avg: b.ab ? b.h / b.ab : 0, bb: b.bb, k: b.k, sb: b.sb,
        bbAllowed: g.team.pit ? g.team.pit.bb : 0, e: g.team.fld ? g.team.fld.e : 0
      };
    });
    return A;
  }

  /* ==================================================================
     INSIGHTS - plain sentences, each one computed, none of them typed
     ================================================================== */
  function insights(A) {
    var out = [];
    var push = function (sev, tag, title, detail) { out.push({ sev: sev, tag: tag, title: title, detail: detail }); };
    var n = A.games.length;

    /* run production */
    push('low', 'RUN', 'Outscoring opponents ' + A.rf + ' to ' + A.ra,
      'That is ' + rate(A.rf / n, 1) + ' runs a game scored against ' + rate(A.ra / n, 1) + ' allowed. ' +
      'When the offense gets to 8 runs the record is ' + A.eightPlus.text + '; under 8 it is ' + A.underEight.text + '.');

    /* wins vs losses: what separates them */
    if (A.wins.n && A.losses.n) {
      var dObp = A.wins.obp - A.losses.obp;
      var dBB = A.wins.bbAllowedIp - A.losses.bbAllowedIp;
      var dE = A.wins.ePer - A.losses.ePer;
      var bits = [];
      bits.push('Team on-base of ' + rate(A.wins.obp) + ' in wins against ' + rate(A.losses.obp) + ' in losses');
      bits.push(rate(A.wins.bbAllowedIp, 2) + ' walks allowed per inning in wins, ' + rate(A.losses.bbAllowedIp, 2) + ' in losses');
      bits.push(rate(A.wins.ePer, 1) + ' errors a game in wins, ' + rate(A.losses.ePer, 1) + ' in losses');
      var biggest = Math.abs(dObp) * 10 >= Math.max(Math.abs(dBB), Math.abs(dE))
        ? 'The bats are the biggest difference between the two columns.'
        : Math.abs(dBB) >= Math.abs(dE) ? 'Free passes on the mound are the biggest difference between the two columns.'
        : 'Defense is the biggest difference between the two columns.';
      push('med', 'W/L', 'What separates the wins from the losses', bits.join('; ') + '. ' + biggest);
    }

    /* close games */
    if (A.oneRun.n) {
      push(A.oneRun.l > A.oneRun.w ? 'med' : 'low', '1-RUN', A.oneRun.text + ' in one-run games',
        A.oneRun.n + ' of the ' + n + ' games were decided by a single run' +
        (A.blowouts.n ? '; ' + A.blowouts.n + ' were decided by 8 or more (' + A.blowouts.text + ').' : '.'));
    }

    /* recent form */
    var dAvg = A.recent.avg - A.all.avg;
    if (A.recent.n >= 3 && Math.abs(dAvg) >= 0.06) {
      push(dAvg < 0 ? 'high' : 'low', 'L4',
        dAvg < 0 ? 'The bats have cooled off' : 'The bats are heating up',
        'Team average is ' + rate(A.recent.avg) + ' over the last ' + A.recent.n + ' games against ' + rate(A.all.avg) +
        ' for the season, with on-base at ' + rate(A.recent.obp) + ' (season ' + rate(A.all.obp) + '). Record in that stretch: ' + A.last4.text + '.');
    }

    /* plate discipline */
    var b = A.all.bat;
    if (b.bb >= b.k) {
      push('low', 'EYE', 'More walks than strikeouts',
        b.bb + ' walks drawn against ' + b.k + ' strikeouts on the season. At 10U that patience is where most of the runs come from.');
    } else {
      push('med', 'EYE', 'Strikeouts outnumber walks', b.k + ' strikeouts against ' + b.bb + ' walks. Swinging at pitches out of the zone is costing free bases.');
    }

    /* running game */
    var att = b.sb + b.cs;
    if (att) {
      push('low', 'SPD', b.sb + ' stolen bases in ' + att + ' tries',
        Math.round(100 * b.sb / att) + '% success, about ' + rate(b.sb / n, 1) + ' steals a game. ' +
        (b.sb / n >= 6 ? 'Very aggressive on the bases, and it is working.' : 'Solid base running.'));
    }

    /* pitching */
    if (A.all.bbAllowedIp) {
      var sev = A.all.bbAllowedIp > 1.4 ? 'high' : A.all.bbAllowedIp > 0.85 ? 'med' : 'low';
      push(sev, 'ARM', rate(A.all.bbAllowedIp, 2) + ' walks allowed per inning',
        (A.all.strikePct ? Math.round(A.all.strikePct * 100) + '% strikes overall. ' : '') +
        (sev === 'low' ? 'The staff is filling up the zone.' : 'Walks are the number to chase down on the mound - every free base at this age scores more often than not.'));
    }

    /* heavy outings */
    if (A.heavy.length) {
      push('high', 'ARM', A.heavy.length + ' outing' + (A.heavy.length > 1 ? 's' : '') + ' over the ' + A.maxPitches + '-pitch daily guidance',
        A.heavy.map(function (h) { return h.name.split(' ').slice(-1)[0] + ' ' + h.pitches + ' on ' + fmtDate(h.game.date, true); }).join(', ') +
        '. USA Baseball lists ' + A.maxPitches + ' as the daily maximum for ages 9-10.');
    }

    /* defense */
    var eTotal = sum(A.games, function (g) { return g.team.fld ? g.team.fld.e : 0; });
    var clean = A.games.filter(function (g) { return g.team.fld && g.team.fld.e === 0; }).length;
    push(eTotal / n > 1.5 ? 'med' : 'low', 'GLV', clean + ' error-free games out of ' + n,
      eTotal + ' errors on the season, ' + rate(eTotal / n, 1) + ' a game. Record in error-free games: ' +
      (function () { var l = A.games.filter(function (g) { return g.team.fld && g.team.fld.e === 0; });
        return l.filter(function (g) { return g.result === 'W'; }).length + '-' + l.filter(function (g) { return g.result === 'L'; }).length; })() + '.');

    /* hot hitter */
    var hot = A.players.filter(function (p) { return p.last4.pa >= 6 && p.delta !== null; })
      .sort(function (a, b) { return b.delta - a.delta; })[0];
    if (hot && hot.delta > 0.15) {
      push('low', 'HOT', hot.name + ' is the hottest bat',
        rate(hot.last4ops) + ' OPS over the last 4 games against ' + rate(hot.seasonOps) + ' for the season.');
    }
    var streaker = A.players.filter(function (p) { return p.hitStreak >= 3; }).sort(function (a, b) { return b.hitStreak - a.hitStreak; })[0];
    if (streaker) {
      push('low', 'HOT', streaker.name + ' has a hit in ' + streaker.hitStreak + ' straight games', 'Counting back from the most recent game he batted in.');
    }

    var order = { high: 0, med: 1, low: 2 };
    out.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return out;
  }

  /* ==================================================================
     RENDER
     ================================================================== */
  function render(st) {
    var host = $('seasonBody');
    if (!host) return;
    destroyCharts();

    if (!cache) {
      load();
      host.innerHTML = sectionHead('Season Review', 'Game by game') +
        '<div class="card"><div class="card-body"><div class="hint">' +
        (failed ? 'The game-by-game file (data/games.json) could not be loaded. It is built from the per-game GameChanger exports.'
                : 'Loading the game log…') +
        '</div></div></div>';
      return;
    }

    var A = analyze(cache);
    var n = A.games.length;
    var html = sectionHead('Season Review', n + ' games · ' + A.w + '-' + A.l + (A.t ? '-' + A.t : '') + ' · ' + esc(cache.season || C.team.season));

    /* ---- tiles ---- */
    html += '<div class="statbar season-tiles mb-16">' +
      tile('Record', A.w + '–' + A.l, '', (A.streak.kind === 'W' ? 'Won ' : 'Lost ') + A.streak.n + ' straight') +
      tile('Run Diff', signed(A.rf - A.ra), A.rf - A.ra >= 0 ? 'up' : 'down', A.rf + ' scored · ' + A.ra + ' allowed') +
      tile('Runs / Game', rate(A.rf / n, 1), '', 'Allowing ' + rate(A.ra / n, 1)) +
      tile('Last 4', A.last4.text, A.last4.w > A.last4.l ? 'up' : A.last4.w < A.last4.l ? 'down' : '',
        'Hitting ' + rate(A.recent.avg) + ' in that stretch') +
      tile('Steals', A.all.bat.sb, '', Math.round(100 * A.all.bat.sb / Math.max(1, A.all.bat.sb + A.all.bat.cs)) + '% success') +
      '</div>';

    /* ---- results chart + list ---- */
    html += '<div class="card mb-16">' + cardHead('Game By Game', 'Tap a game for the box score') +
      '<div class="card-body"><div class="chart-box"><canvas id="chartSeasonDiff"></canvas></div></div>' +
      '<div class="card-body flush season-games">' + A.games.slice().reverse().map(gameRow).join('') + '</div>' +
      '</div>';

    /* ---- insights + splits ---- */
    var ins = insights(A);
    html += '<div class="grid g-main mb-16">';
    html += '<div class="card">' + cardHead('What The Numbers Say', ins.length + ' notes, all computed') +
      '<div class="card-body">' +
      ins.map(function (f) {
        return '<div class="issue sev-' + f.sev + '">' +
          '<div class="issue-tag">' + esc(f.tag) + '</div>' +
          '<div class="grow"><div class="issue-t">' + esc(f.title) + '</div>' +
          '<div class="issue-d">' + esc(f.detail) + '</div></div></div>';
      }).join('') +
      '</div></div>';
    html += splitsCard(A);
    html += '</div>';

    /* ---- opponents + weekends ---- */
    html += '<div class="grid g-2 mb-16 g-top">' + opponentsCard(A) + weekendsCard(A) + '</div>';

    /* ---- scoring + on-base charts ---- */
    html += '<div class="grid g-2 mb-16">' +
      '<div class="card">' + cardHead('Runs Scored vs Allowed', 'Every game, in order') +
      '<div class="card-body"><div class="chart-box"><canvas id="chartSeasonRuns"></canvas></div></div></div>' +
      '<div class="card">' + cardHead('Team On-Base By Game', 'Dots are each game, the line is a 4-game average') +
      '<div class="card-body"><div class="chart-box"><canvas id="chartSeasonObp"></canvas></div>' +
      '<div class="hint mt-8">On-base is the number that tracks runs best at 10U. The line smooths the bounce of a single game so the trend shows.</div>' +
      '</div></div>' +
      '</div>';

    /* ---- hit chart ---- */
    html += hitChartCard(A);

    /* ---- player trends ---- */
    html += trendsCard(A);

    /* ---- arms + positions ---- */
    html += '<div class="grid g-2 mb-16">' + armsCard(A) + positionsCard(A) + '</div>';

    host.innerHTML = html;
    drawCharts(A);
  }

  /* ---------------- game row + box score ---------------- */
  function gameRow(g) {
    var isOpen = openGame === g.id;
    var arms = g.players.filter(function (p) { return p.pit && p.pit.outs > 0; });
    var top = g.players.slice().sort(function (a, b) {
      return (b.bat.h + b.bat.bb + b.bat.rbi) - (a.bat.h + a.bat.bb + a.bat.rbi) || b.bat.h - a.bat.h;
    })[0];
    var topTxt = top && (top.bat.h || top.bat.rbi)
      ? S.shortName(top.name) + ' ' + top.bat.h + '-' + top.bat.ab + (top.bat.rbi ? ', ' + top.bat.rbi + ' RBI' : '') : '';
    return '<div class="sg' + (isOpen ? ' open' : '') + '" data-season-game="' + esc(g.id) + '">' +
      '<button class="sg-head" type="button" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
      '<span class="sg-date"><b>' + esc(fmtDate(g.date, true)) + '</b><i>G' + g.n + '</i></span>' +
      '<span class="sg-main"><span class="sg-opp"><span class="ha">' + (g.away ? '@' : 'vs') + '</span>' + esc(shortOpp(g.opponent)) + '</span>' +
      '<span class="sg-sub">' + esc([g.location, arms.map(function (p) { return S.shortName(p.name) + ' ' + ipText(p.pit.outs); }).join(', ')].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span class="sg-score ' + (g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : 'tie') + '"><b>' + g.us + '–' + g.them + '</b><i>' + g.result + '</i></span>' +
      '</button>' +
      (isOpen ? '<div class="sg-body">' + boxScore(g, topTxt) + '</div>' : '') +
      '</div>';
  }

  function boxScore(g, topTxt) {
    var bats = g.players.filter(function (p) { return p.bat.pa > 0; });
    var arms = g.players.filter(function (p) { return p.pit && p.pit.outs > 0; });
    var b = g.team.bat;
    var html = '<div class="row gap-8 mb-8" style="flex-wrap:wrap">' +
      '<span class="badge">' + esc(g.innings) + ' inn</span>' +
      '<span class="badge">' + b.h + ' H · ' + b.bb + ' BB · ' + b.k + ' K · ' + b.sb + ' SB</span>' +
      (g.team.fld ? '<span class="badge">' + g.team.fld.e + ' E</span>' : '') +
      (topTxt ? '<span class="badge">Top bat: ' + esc(topTxt) + '</span>' : '') +
      '</div>';
    html += '<div class="table-scroll"><table class="stat season-box"><thead><tr>' +
      '<th class="stick">Batter</th><th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th><th>SB</th><th>QAB</th></tr></thead><tbody>' +
      bats.map(function (p) {
        var x = p.bat;
        return '<tr class="clickable" data-player="' + esc(p.name) + '"><td class="stick"><span class="pnum">' + (p.num === null ? '–' : p.num) + '</span>' + esc(S.shortName(p.name)) + '</td>' +
          '<td>' + x.ab + '</td><td>' + x.r + '</td><td' + (x.h >= 2 ? ' class="text-good"' : '') + '>' + x.h + '</td><td>' + x.b2 + '</td><td>' + x.b3 + '</td><td>' + x.hr + '</td>' +
          '<td>' + x.rbi + '</td><td>' + x.bb + '</td><td' + (x.k >= 2 ? ' class="text-warn"' : '') + '>' + x.k + '</td><td>' + x.sb + '</td><td>' + x.qab + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (arms.length) {
      html += '<div class="table-scroll mt-8"><table class="stat season-box"><thead><tr>' +
        '<th class="stick">Pitcher</th><th>IP</th><th>#P</th><th>BF</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>STR%</th><th>Dec</th></tr></thead><tbody>' +
        arms.map(function (p) {
          var x = p.pit, dec = x.w ? 'W' : x.l ? 'L' : x.sv ? 'SV' : '';
          var heavy = x.pitches > (C.pitchLimits.maxPerDay || 75);
          return '<tr class="clickable" data-player="' + esc(p.name) + '"><td class="stick"><span class="pnum">' + (p.num === null ? '–' : p.num) + '</span>' + esc(S.shortName(p.name)) + '</td>' +
            '<td>' + ipText(x.outs) + '</td><td' + (heavy ? ' class="text-bad" title="Over the daily guidance"' : '') + '>' + x.pitches + '</td><td>' + x.bf + '</td><td>' + x.h + '</td><td>' + x.r + '</td><td>' + x.er + '</td>' +
            '<td>' + x.bb + '</td><td>' + x.k + '</td><td>' + (x.strikePct ? Math.round(x.strikePct * 100) + '%' : '—') + '</td><td>' + dec + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return html;
  }

  /* ---------------- wins vs losses ---------------- */
  function splitsCard(A) {
    if (!A.wins.n || !A.losses.n) return '';
    var rows = [
      ['Runs scored', rate(A.wins.runsPer, 1), rate(A.losses.runsPer, 1)],
      ['Runs allowed', rate(A.wins.raPer, 1), rate(A.losses.raPer, 1)],
      ['Team AVG', rate(A.wins.avg), rate(A.losses.avg)],
      ['Team OBP', rate(A.wins.obp), rate(A.losses.obp)],
      ['Walks drawn', rate(A.wins.bbPer, 1), rate(A.losses.bbPer, 1)],
      ['Strikeouts', rate(A.wins.kPer, 1), rate(A.losses.kPer, 1)],
      ['Steals', rate(A.wins.sbPer, 1), rate(A.losses.sbPer, 1)],
      ['BB allowed / inn', rate(A.wins.bbAllowedIp, 2), rate(A.losses.bbAllowedIp, 2)],
      ['K / inn', rate(A.wins.kAllowedIp, 2), rate(A.losses.kAllowedIp, 2)],
      ['Strike %', A.wins.strikePct ? Math.round(A.wins.strikePct * 100) + '%' : '—', A.losses.strikePct ? Math.round(A.losses.strikePct * 100) + '%' : '—'],
      ['Errors', rate(A.wins.ePer, 1), rate(A.losses.ePer, 1)]
    ];
    return '<div class="card">' + cardHead('Wins vs Losses', 'Per game') +
      '<div class="table-scroll"><table class="stat season-splits"><thead><tr><th class="stick">Stat</th>' +
      '<th class="text-good">' + A.wins.n + ' W</th><th class="text-bad">' + A.losses.n + ' L</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="stick">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card-body"><div class="hint">Same team, two columns. The stats that move the most between them are the ones to practice.</div></div>' +
      '</div>';
  }

  /* ---------------- opponents + weekends ---------------- */
  function resultDots(games) {
    return games.map(function (g) {
      return '<i class="rdot ' + (g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : 'tie') + '" title="' +
        esc(fmtDate(g.date, true) + ' ' + g.us + '-' + g.them) + '">' + g.result + '</i>';
    }).join('');
  }
  function opponentsCard(A) {
    if (!A.opponents.length) return '';
    return '<div class="card">' + cardHead('Head To Head', A.opponents.length + ' opponents') +
      '<div class="card-body flush">' +
      A.opponents.map(function (o) {
        var d = o.rf - o.ra;
        return '<div class="h2h">' +
          '<span class="h2h-name">' + esc(shortOpp(o.name)) + '<i>' + o.n + ' game' + (o.n > 1 ? 's' : '') + ' · ' + o.rf + '-' + o.ra + ' runs</i></span>' +
          '<span class="h2h-dots">' + resultDots(o.games) + '</span>' +
          '<span class="h2h-rec ' + (o.w > o.l ? 'text-good' : o.w < o.l ? 'text-bad' : '') + '">' + o.text + '</span>' +
          '</div>';
      }).join('') +
      '</div><div class="card-body" style="border-top:1px solid var(--line-soft)"><div class="hint">Clubs played more than once sit at the top. The coaches\' room uses the same history for the scouting report before a rematch.</div></div></div>';
  }
  function weekendsCard(A) {
    if (!A.weekends.length) return '';
    return '<div class="card">' + cardHead('By Weekend', A.weekends.length + ' weekends') +
      '<div class="card-body flush">' +
      A.weekends.map(function (w) {
        var gs = A.games.filter(function (g) { return (g.weekend || g.date) === w.label; });
        var d = w.rf - w.ra;
        return '<div class="h2h">' +
          '<span class="h2h-name">' + esc(w.label) + '<i>' + w.n + ' game' + (w.n > 1 ? 's' : '') + ' · ' + w.rf + '-' + w.ra + ' runs (' + signed(d) + ')</i></span>' +
          '<span class="h2h-dots">' + resultDots(gs) + '</span>' +
          '<span class="h2h-rec ' + (w.w > w.l ? 'text-good' : w.w < w.l ? 'text-bad' : '') + '">' + w.text + '</span>' +
          '</div>';
      }).join('') +
      '</div><div class="card-body" style="border-top:1px solid var(--line-soft)">' +
      '<div class="eyebrow mb-8">Season Line</div>' + seasonLine(A) +
      '<div class="hint mt-8">Travel ball is played in weekends, so this is the season the way the team lived it.</div></div></div>';
  }

  function seasonLine(A) {
    var b = A.all.bat, outs = sum(A.games, function (g) { return g.team.pit ? g.team.pit.outs : 0; });
    var pit = { h: 0, bb: 0, k: 0, er: 0 };
    A.games.forEach(function (g) { if (g.team.pit) { pit.h += g.team.pit.h; pit.bb += g.team.pit.bb; pit.k += g.team.pit.k; pit.er += g.team.pit.er; } });
    var ip = outs / 3;
    function cell(v, l) { return '<div class="sl"><b>' + esc(v) + '</b><i>' + esc(l) + '</i></div>'; }
    return '<div class="sl-row">' +
      cell(rate(b.ab ? b.h / b.ab : 0), 'AVG') + cell(rate(obpOf(b)), 'OBP') + cell(rate(slgOf(b)), 'SLG') + cell(rate(opsOf(b)), 'OPS') +
      cell(b.h, 'H') + cell(b.b2, '2B') + cell(b.b3, '3B') + cell(b.hr, 'HR') + cell(b.bb, 'BB') + cell(b.k, 'K') + cell(b.sb, 'SB') +
      '</div><div class="sl-row">' +
      cell(ipText(outs), 'IP') + cell(rate(ip ? pit.er * 6 / ip : 0, 2), 'ERA') + cell(rate(ip ? (pit.bb + pit.h) / ip : 0, 2), 'WHIP') +
      cell(pit.k, 'K') + cell(pit.bb, 'BB') + cell(A.all.strikePct ? Math.round(A.all.strikePct * 100) + '%' : '—', 'STR') +
      '</div>';
  }

  /* ---------------- hit chart ---------------- */
  function hitChartCard(A) {
    var games = A.games;
    var players = A.players.filter(function (p) { return p.season.pa > 0; });
    var head = games.map(function (g) {
      return '<th class="hc-g ' + (g.result === 'W' ? 'win' : 'loss') + '" title="' + esc(fmtDate(g.date, true) + ' ' + (g.away ? '@ ' : 'vs ') + g.opponent + ' · ' + g.us + '-' + g.them) + '">' +
        '<span>' + g.n + '</span></th>';
    }).join('');
    var body = players.map(function (p) {
      var cells = games.map(function (g, gi) {
        var x = p.games[gi];
        if (!x || !x.bat.pa) return '<td class="hc-c none"></td>';
        var b = x.bat, ob = b.h + b.bb + b.hbp;
        var cls = b.h >= 2 ? 'multi' : b.h === 1 ? 'hit' : ob > 0 ? 'ob' : b.k >= 2 ? 'kk' : 'out';
        var title = S.shortName(p.name) + ' · G' + g.n + ': ' + b.h + '-' + b.ab + (b.bb ? ', ' + b.bb + ' BB' : '') + (b.hbp ? ', HBP' : '') +
          (b.k ? ', ' + b.k + ' K' : '') + (b.rbi ? ', ' + b.rbi + ' RBI' : '') + (b.sb ? ', ' + b.sb + ' SB' : '') + (b.hr ? ', HR' : b.b3 ? ', 3B' : b.b2 ? ', 2B' : '');
        return '<td class="hc-c ' + cls + '" title="' + esc(title) + '"><span>' + (b.h ? b.h : (ob ? '·' : '')) + '</span></td>';
      }).join('');
      return '<tr data-player="' + esc(p.name) + '" class="clickable"><td class="stick hc-name">' + esc(S.shortName(p.name)) +
        '<i>' + rate(p.season.ab ? p.season.h / p.season.ab : 0) + '</i></td>' + cells +
        '<td class="hc-tot">' + p.season.h + '</td></tr>';
    }).join('');
    return '<div class="card mb-16">' + cardHead('Hit Chart', 'Hits in every game · ' + games.length + ' games') +
      '<div class="table-scroll"><table class="stat hitchart"><thead><tr><th class="stick">Player</th>' + head + '<th>H</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-body"><div class="row gap-12 hc-legend" style="flex-wrap:wrap">' +
      '<span><i class="multi"></i>Multi-hit game</span><span><i class="hit"></i>One hit</span><span><i class="ob"></i>On base, no hit</span>' +
      '<span><i class="out"></i>Did not reach</span><span><i class="kk"></i>2+ strikeouts</span><span><i class="none"></i>Did not bat</span>' +
      '</div><div class="hint mt-8">Column headers are game numbers, green for wins and red for losses. Tap a row to open that player; on a computer, hover a cell for the line.</div></div></div>';
  }

  /* ---------------- trends ---------------- */
  function spark(series, w, h) {
    var pts = series.map(function (v, i) { return v === null ? null : [i, v]; }).filter(Boolean);
    if (pts.length < 2) return '';
    var min = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var max = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    if (max - min < 0.05) { max += 0.05; min -= 0.05; }
    var n = series.length - 1 || 1;
    var d = pts.map(function (p, i) {
      var x = (p[0] / n) * (w - 4) + 2, y = h - 3 - ((p[1] - min) / (max - min)) * (h - 6);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var last = pts[pts.length - 1], first = pts[0];
    var up = last[1] >= first[1];
    var lx = (last[0] / n) * (w - 4) + 2, ly = h - 3 - ((last[1] - min) / (max - min)) * (h - 6);
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="' + (up ? 'var(--good)' : 'var(--bad)') + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.2" fill="' + (up ? 'var(--good)' : 'var(--bad)') + '"/></svg>';
  }

  function trendsCard(A) {
    var rows = A.players.filter(function (p) { return p.season.pa > 0; });
    return '<div class="card mb-16">' + cardHead('Who Is Trending', 'Season line, then the last 4 games') +
      '<div class="table-scroll"><table class="stat season-trends"><thead><tr>' +
      '<th class="stick">Player</th><th>GP</th><th>AVG</th><th>OBP</th><th>OPS</th><th>Last 4 OPS</th><th>Swing</th><th>Season OPS, game by game</th><th>Hit streak</th><th>Multi-hit</th><th>On base</th><th>SB</th></tr></thead><tbody>' +
      rows.map(function (p) {
        var b = p.season;
        var d = p.delta;
        var dTxt = d === null ? '<span class="text-dimmer">—</span>'
          : Math.abs(d) < 0.03 ? '<span class="text-dimmer">even</span>'
          : '<span class="' + (d > 0 ? 'text-good' : 'text-bad') + '">' + (d > 0 ? '▲ ' : '▼ ') + rate(Math.abs(d)) + '</span>';
        return '<tr class="clickable" data-player="' + esc(p.name) + '">' +
          '<td class="stick"><span class="pnum">' + (p.num === null ? '–' : p.num) + '</span>' + esc(p.name) + '</td>' +
          '<td>' + p.gp + '</td><td>' + rate(b.ab ? b.h / b.ab : 0) + '</td><td>' + rate(obpOf(b)) + '</td><td><strong>' + rate(opsOf(b)) + '</strong></td>' +
          '<td>' + (p.last4ops === null ? '—' : rate(p.last4ops)) + '</td><td>' + dTxt + '</td>' +
          '<td class="sparkcell">' + spark(p.series, 120, 28) + '</td>' +
          '<td>' + (p.hitStreak ? p.hitStreak + ' G' : '—') + '</td><td>' + p.multiHit + '</td><td>' + p.onBaseGames + '/' + p.gp + '</td><td>' + b.sb + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card-body"><div class="hint">The sparkline is each player\'s running season OPS after every game, so a line that climbs is a kid who got better as the fall went on. ' +
      '"On base" is games he reached base at least once.</div></div></div>';
  }

  /* ---------------- arms ---------------- */
  function armsCard(A) {
    var arms = A.players.filter(function (p) { return p.outs > 0; }).sort(function (a, b) { return b.outs - a.outs; });
    if (!arms.length) return '';
    var max = A.maxPitches;
    return '<div class="card">' + cardHead('Arm Usage', 'Every outing, pitch by pitch') +
      '<div class="card-body flush">' +
      arms.map(function (p) {
        var ip = p.outs / 3;
        var era = ip ? (p.pitER * 6) / ip : 0;
        var dots = p.pit.map(function (o) {
          var heavy = o.line.pitches > max;
          return '<span class="arm-dot' + (heavy ? ' heavy' : '') + '" style="--w:' + Math.min(100, Math.round(100 * o.line.pitches / max)) + '%" ' +
            'title="' + esc(fmtDate(o.game.date, true) + ' ' + (o.game.away ? '@ ' : 'vs ') + shortOpp(o.game.opponent) + ': ' + ipText(o.line.outs) + ' IP, ' + o.line.pitches + ' pitches, ' + o.line.k + ' K, ' + o.line.bb + ' BB, ' + o.line.r + ' R') + '">' +
            '<i></i><b>' + o.line.pitches + '</b></span>';
        }).join('');
        return '<div class="arm" data-player="' + esc(p.name) + '">' +
          '<div class="arm-top"><span class="arm-name"><span class="pnum">' + (p.num === null ? '–' : p.num) + '</span>' + esc(p.name) + '</span>' +
          '<span class="arm-line">' + ipText(p.outs) + ' IP · ' + p.pit.length + ' outing' + (p.pit.length > 1 ? 's' : '') + ' · ' + p.pitches + ' pitches</span></div>' +
          '<div class="arm-stats"><span>' + rate(era, 2) + ' <i>ERA</i></span><span>' + rate(ip ? p.pitBB / ip : 0, 2) + ' <i>BB/IP</i></span>' +
          '<span>' + p.pitK + ' <i>K</i></span><span>' + (p.strikePct ? Math.round(p.strikePct * 100) + '%' : '—') + ' <i>STR</i></span>' +
          '<span' + (p.maxPitches > max ? ' class="text-bad"' : '') + '>' + p.maxPitches + ' <i>MAX</i></span></div>' +
          '<div class="arm-dots">' + dots + '</div>' +
          '</div>';
      }).join('') +
      '</div><div class="card-body" style="border-top:1px solid var(--line-soft)"><div class="hint">Each bar is one outing, filled to the ' + max + '-pitch daily guidance for ages 9-10. ' +
      'A red bar went over it. Pitch counts come straight from the scorebook.</div></div></div>';
  }

  /* ---------------- positions ---------------- */
  function positionsCard(A) {
    var POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    var rows = A.players.filter(function (p) { return p.posTotal > 0; }).sort(function (a, b) { return b.posTotal - a.posTotal; });
    if (!rows.length) return '';
    var maxOuts = rows.reduce(function (m, p) { return Math.max(m, Math.max.apply(null, POS.map(function (k) { return p.pos[k] || 0; }))); }, 1);
    var catchers = rows.filter(function (p) { return p.cat && p.cat.outs > 0; }).sort(function (a, b) { return b.cat.outs - a.cat.outs; });
    return '<div class="card">' + cardHead('Where Everyone Played', 'Innings at each position') +
      '<div class="table-scroll"><table class="stat posgrid"><thead><tr><th class="stick">Player</th>' +
      POS.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '<th>Inn</th></tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr class="clickable" data-player="' + esc(p.name) + '"><td class="stick">' + esc(S.shortName(p.name)) + '</td>' +
          POS.map(function (k) {
            var o = p.pos[k] || 0;
            if (!o) return '<td class="pg-c"></td>';
            var a = 0.18 + 0.82 * (o / maxOuts);
            return '<td class="pg-c on" style="--a:' + a.toFixed(2) + '" title="' + esc(S.shortName(p.name) + ' · ' + k + ' · ' + ipText(o) + ' innings') + '">' + ipText(o) + '</td>';
          }).join('') + '<td class="pg-t">' + ipText(p.posTotal) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (catchers.length ? '<div class="card-body" style="border-top:1px solid var(--line-soft)">' +
        '<div class="eyebrow mb-8">Behind The Plate</div>' +
        catchers.map(function (p) {
          var c = p.cat, pct = c.att ? Math.round(100 * c.cs / c.att) : 0;
          return '<div class="row gap-8 mb-8" style="flex-wrap:wrap;font-size:12.5px" data-player="' + esc(p.name) + '">' +
            '<span class="grow"><strong>' + esc(S.shortName(p.name)) + '</strong> <span class="text-dimmer">' + ipText(c.outs) + ' inn</span></span>' +
            '<span class="badge">' + c.cs + ' CS of ' + c.att + ' (' + pct + '%)</span><span class="badge">' + c.pb + ' PB</span></div>';
        }).join('') +
        '<div class="hint">At 10U most steals are on the pitcher\'s delivery, not the catcher. Passed balls are the better measure of the catching.</div></div>' : '') +
      '</div>';
  }

  /* ==================================================================
     CHARTS (Chart.js, same palette as the rest of the app)
     ================================================================== */
  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} delete charts[k]; });
  }
  function colors() { return P10.Charts.COLOR; }
  function base(extra) {
    var K = colors();
    var o = {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 450, easing: 'easeOutQuart' },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false, labels: { color: K.text, font: { family: 'Inter', size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
        tooltip: {
          backgroundColor: K.tipBg || 'rgba(10,13,18,.96)', borderColor: K.tipLine || 'rgba(255,255,255,.12)', borderWidth: 1,
          titleColor: K.tipText || '#F4F7FA', bodyColor: K.text,
          titleFont: { family: 'Inter', size: 12, weight: '600' }, bodyFont: { family: 'Roboto Mono', size: 11 },
          padding: 10, cornerRadius: 6, displayColors: false
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: K.textDim, font: { family: 'Inter', size: 10 }, maxRotation: 0, autoSkip: true } },
        y: { grid: { color: K.grid }, border: { display: false }, ticks: { color: K.textDim, font: { family: 'Roboto Mono', size: 10 }, padding: 6 } }
      }
    };
    return merge(o, extra || {});
  }
  function merge(a, b) {
    var out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object') out[k] = merge(a[k], b[k]);
      else out[k] = b[k];
    });
    return out;
  }
  function make(id, cfg) {
    var el = $(id);
    if (!el || typeof Chart === 'undefined') return;
    try { charts[id] = new Chart(el.getContext('2d'), cfg); } catch (e) { console.error('season chart', id, e); }
  }

  function drawCharts(A) {
    var K = colors();
    var s = A.series;
    var labels = s.map(function (x, i) { return 'G' + (i + 1); });

    make('chartSeasonDiff', {
      type: 'bar',
      data: { labels: labels, datasets: [{
        data: s.map(function (x) { return x.diff; }),
        backgroundColor: s.map(function (x) { return x.diff >= 0 ? K.good : K.bad; }),
        borderRadius: 4, borderSkipped: false, barPercentage: .7, categoryPercentage: .85
      }] },
      options: base({
        plugins: { tooltip: { callbacks: {
          title: function (c) { return s[c[0].dataIndex].label; },
          label: function (c) { var x = s[c.dataIndex]; return (x.result === 'W' ? 'Won ' : x.result === 'L' ? 'Lost ' : 'Tied ') + x.us + '-' + x.them; }
        } } },
        scales: { y: { ticks: { callback: function (v) { return (v > 0 ? '+' : '') + v; } } } }
      })
    });

    make('chartSeasonRuns', {
      type: 'bar',
      data: { labels: labels, datasets: [
        { label: 'Scored', data: s.map(function (x) { return x.us; }), backgroundColor: K.barA, borderRadius: 3, borderSkipped: false },
        { label: 'Allowed', data: s.map(function (x) { return x.them; }), backgroundColor: K.barB, borderRadius: 3, borderSkipped: false }
      ] },
      options: base({
        plugins: { legend: { display: true, position: 'bottom' }, tooltip: { callbacks: {
          title: function (c) { return s[c[0].dataIndex].label; },
          label: function (c) { return c.dataset.label + ' ' + c.parsed.y; }
        } } },
        scales: { y: { ticks: { precision: 0 } } }
      })
    });

    var roll = s.map(function (x, i) {
      var win = s.slice(Math.max(0, i - 3), i + 1);
      var bat = {}; win.forEach(function (g, j) { addBat(bat, A.games[Math.max(0, i - 3) + j].team.bat); });
      return obpOf(bat);
    });
    make('chartSeasonObp', {
      type: 'line',
      data: { labels: labels, datasets: [
        { label: '4-game', data: roll, borderColor: K.chrome, backgroundColor: K.fillSoft, borderWidth: 2.5, pointRadius: 0, fill: true, tension: .35, order: 1 },
        { label: 'Game', data: s.map(function (x) { return x.obp; }), showLine: false, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: s.map(function (x) { return x.result === 'W' ? K.good : K.bad; }), pointBorderColor: K.point || '#0E1218', pointBorderWidth: 1.5, order: 0 }
      ] },
      options: base({
        plugins: { tooltip: { callbacks: {
          title: function (c) { return s[c[0].dataIndex].label; },
          label: function (c) { return c.dataset.label + ' OBP ' + rate(c.parsed.y); }
        } } },
        scales: { y: { ticks: { callback: function (v) { return rate(v); } } } }
      })
    });
  }

  /* ==================================================================
     EVENTS
     ================================================================== */
  document.addEventListener('click', function (e) {
    var head = e.target.closest('.sg-head');
    if (!head) return;
    var wrap = head.closest('[data-season-game]');
    if (!wrap) return;
    var id = wrap.dataset.seasonGame;
    openGame = openGame === id ? null : id;
    var g = cache && cache.games.filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    var html = gameRow(g);
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var next = tmp.firstChild;
    /* only one box score open at a time */
    document.querySelectorAll('.sg.open').forEach(function (el) {
      if (el !== wrap) {
        var og = cache.games.filter(function (x) { return x.id === el.dataset.seasonGame; })[0];
        var t2 = document.createElement('div'); t2.innerHTML = gameRow(og);
        el.replaceWith(t2.firstChild);
      }
    });
    wrap.replaceWith(next);
    e.stopPropagation();
  }, true);

  /* Clicks inside a box score row should still open the player drawer, and
     the app's global handler does that for any [data-player]. The capture
     listener above only swallows clicks on the row header. */

  /* ------------------------------------------------------------------
     Game log hygiene. Games now arrive from the published file with
     ids that start with "gc-". A coach who typed the same games in by
     hand before this existed would see each one twice, so a local entry
     that matches a published game on date and opponent is dropped once.
     ------------------------------------------------------------------ */
  P10.Store.subscribe(function (st, reason) {
    if (reason !== 'published' && reason !== 'init') return;
    var games = st.games || [];
    var pub = games.filter(function (g) { return /^gc-/.test(String(g.id)); });
    if (!pub.length) return;
    var keep = games.filter(function (g) {
      if (/^gc-/.test(String(g.id))) return true;
      return !pub.some(function (p) { return p.date === g.date && P10.GameLog.sameOpponent(p.opponent, g.opponent); });
    });
    if (keep.length !== games.length) {
      st.games = keep;
      P10.Store.persistGames();
    }
  });


  /* ==================================================================
     ROUTING
     app.js keeps its tab list private, so this page registers itself
     from the outside: a capture-phase listener catches the Season tab
     before the app's router sees it and does the same four things the
     router does (nav state, page state, window bar, hash). Every other
     tab still goes through app.js untouched, and its goTab() clears
     this page's active state the same way it clears any other.

     To make it native instead, add 'season' to TABS and ROOM_OF in
     app.js and a `case 'season': P10.Season.render(st); break;` to
     renderTab(); this block then simply never fires.
     ================================================================== */
  function activate(opts) {
    document.querySelectorAll('.navtab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === 'season');
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-season');
    });
    var wb = $('windowBar'); if (wb) wb.classList.add('hidden');
    var sn = $('subnav'), nt = $('navToggle');
    if (sn) sn.classList.remove('open');
    if (nt) { nt.classList.remove('open'); nt.setAttribute('aria-expanded', 'false'); }
    if (P10.Charts && P10.Charts.destroyAll) P10.Charts.destroyAll();
    render(P10.Store.state);
    if (!opts || !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#season'); } catch (e) {}
  }

  function isActive() {
    var pg = $('page-season');
    return !!(pg && pg.classList.contains('active'));
  }

  document.addEventListener('click', function (e) {
    var tab = e.target.closest('.navtab[data-tab="season"], [data-goto="season"]');
    if (!tab) return;
    e.stopPropagation();
    e.preventDefault();
    activate();
  }, true);

  /* The theme button repaints the active tab through app.js, which does
     not know about this one; redraw so the charts pick up the palette. */
  var tb = $('themeBtn');
  if (tb) tb.addEventListener('click', function () {
    setTimeout(function () { if (isActive()) render(P10.Store.state); }, 0);
  });

  /* Deep link: app.js boots to the dashboard for a hash it does not know. */
  var wantedAtBoot = (location.hash || '') === '#season';
  P10.Store.subscribe(function (st, reason) {
    if (reason === 'init' && wantedAtBoot) {
      wantedAtBoot = false;
      setTimeout(function () { activate({ noScroll: true }); }, 0);
    }
    /* New published numbers while this page is up: redraw it too. */
    if (reason === 'published' && isActive()) render(st);
  });

  /* Lets a tool hand the page its data directly (tests, previews). */
  function setData(json) { cache = json; failed = false; loading = false; }

  return { render: render, load: load, analyze: analyze, insights: insights, activate: activate, setData: setData };
})();
