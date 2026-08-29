/* ==========================================================================
   PROSPECTS 10U — STATS ENGINE
   Extracts stat lines from parsed rows, assembles player objects, assigns
   tiers, and computes team aggregates and percentile context.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Stats = (function () {
  'use strict';

  var C = P10.CONFIG;
  var CSV = P10.CSV;
  var find = function (h, k, s) { return CSV.findCol(h, k, s); };
  var n = CSV.num, pctv = CSV.pct;

  var WINDOWS = ['season', 'last_13', 'last_10', 'last_8', 'last_5', 'last_4', 'last_3', 'last_2', 'last_game'];

  var WINDOW_LABELS = {
    season: 'Full Season',
    last_13: 'Last 13',
    last_10: 'Last 10',
    last_8: 'Last 8',
    last_5: 'Last 5',
    last_4: 'Last 4',
    last_3: 'Last 3',
    last_2: 'Last 2',
    last_game: 'Last Game'
  };

  /* ==================================================================
     EXTRACTORS
     Each returns a normalized stat object, or null when the row has
     nothing usable for that family.
     ================================================================== */

  function batting(row, h) {
    var g = function (k) { var c = find(h, k, 'batting'); return c ? n(row[c]) : null; };

    var pa = g('pa'), ab = g('ab'), hits = g('hits'), bb = g('bb'), k = g('k');
    var avg = g('avg'), obp = g('obp'), slg = g('slg'), ops = g('ops');
    var d2 = g('doubles'), d3 = g('triples'), hr = g('hr');

    // Derive anything the export left out
    if (avg === null && ab && hits !== null) avg = hits / ab;
    if (slg === null && ab && hits !== null) {
      var tb = (hits - (d2 || 0) - (d3 || 0) - (hr || 0)) + 2 * (d2 || 0) + 3 * (d3 || 0) + 4 * (hr || 0);
      if (tb >= 0) slg = tb / ab;
    }
    if (obp === null && pa && hits !== null) obp = (hits + (bb || 0) + (g('hbp') || 0)) / pa;
    if (ops === null && obp !== null && slg !== null) ops = obp + slg;

    if (avg === null && obp === null && slg === null && ops === null && !pa && !ab) return null;

    var denom = pa || ab || 0;

    return {
      pa: pa || 0,
      ab: ab || 0,
      h: hits || 0,
      bb: bb || 0,
      k: k || 0,
      hbp: g('hbp') || 0,
      d2: d2 || 0,
      d3: d3 || 0,
      hr: hr || 0,
      rbi: g('rbi') || 0,
      runs: g('runs') || 0,
      sb: g('sb') || 0,
      avg: avg || 0,
      obp: obp || 0,
      slg: slg || 0,
      ops: ops || 0,
      kRate: denom ? (k || 0) / denom : 0,
      bbRate: denom ? (bb || 0) / denom : 0,
      qab: (function () { var c = find(h, 'qab', 'batting'); return c ? pctv(row[c]) : null; })()
    };
  }

  function pitching(row, h) {
    var g = function (k) { var c = find(h, k, 'pitching'); return c ? n(row[c]) : null; };

    var ipCol = find(h, 'ip', 'pitching');
    var ip = ipCol ? CSV.innings(row[ipCol]) : null;
    if (!ip) return null;

    var bb = g('bb'), k = g('k'), er = g('er'), hits = g('hits');
    var era = g('era'), whip = g('whip');
    var pitches = g('pitches'), strikes = g('strikes');

    var strikeCol = find(h, 'strike', 'pitching');
    var strike = strikeCol ? pctv(row[strikeCol]) : null;
    if (strike === null && pitches && strikes !== null) strike = strikes / pitches;

    if (era === null && er !== null && ip) era = (er * 6) / ip;   // 6-inning game at 10U
    if (whip === null && ip && (bb !== null || hits !== null)) whip = ((bb || 0) + (hits || 0)) / ip;

    var bbip = g('bbip');
    if (bbip === null && ip && bb !== null) bbip = bb / ip;
    var kip = g('kip');
    if (kip === null && ip && k !== null) kip = k / ip;

    return {
      ip: ip,
      era: era === null ? 0 : era,
      whip: whip === null ? 0 : whip,
      bb: bb || 0,
      k: k || 0,
      er: er || 0,
      h: hits || 0,
      wp: g('wp') || 0,
      bf: g('bf') || 0,
      pitches: pitches || 0,
      strikes: strikes || 0,
      strike: strike === null ? 0 : strike,
      bbip: bbip === null ? 0 : bbip,
      kip: kip === null ? 0 : kip
    };
  }

  function fielding(row, h) {
    var g = function (k) { var c = find(h, k, 'fielding'); return c ? n(row[c]) : null; };

    var e = g('errors'), tc = g('chances'), po = g('putouts'), a = g('assists');
    var fpct = g('fpct');
    if (fpct !== null && fpct > 1.5) fpct = fpct / 100;

    if (tc === null && (po !== null || a !== null || e !== null)) tc = (po || 0) + (a || 0) + (e || 0);
    if (fpct === null && tc) fpct = ((po || 0) + (a || 0)) / tc;

    var posCol = find(h, 'position', 'fielding') || find(h, 'position');
    var pos = posCol ? String(row[posCol] || '').trim() : '';

    if (e === null && tc === null && !pos) return null;

    return {
      e: e || 0,
      tc: tc || 0,
      po: po || 0,
      a: a || 0,
      dp: g('dp') || 0,
      fpct: fpct === null ? 0 : fpct,
      errRate: tc ? (e || 0) / tc : 0,
      position: pos
    };
  }

  function catching(row, h) {
    var g = function (k) { var c = find(h, k, 'catching'); return c ? n(row[c]) : null; };
    var pb = g('pb'), cs = g('cs'), sba = g('sba');
    var csPctCol = find(h, 'csPct', 'catching');
    var csPct = csPctCol ? pctv(row[csPctCol]) : null;
    if (csPct === null && (cs !== null || sba !== null)) {
      var att = (cs || 0) + (sba || 0);
      csPct = att ? (cs || 0) / att : null;
    }
    if (pb === null && cs === null && sba === null) return null;
    return { pb: pb || 0, cs: cs || 0, sba: sba || 0, csPct: csPct === null ? 0 : csPct };
  }

  /* ==================================================================
     PLAYER ASSEMBLY
     ================================================================== */

  function findRow(data, cat, win, name) {
    var set = data[cat] && data[cat][win];
    if (!set || !set.data) return null;
    for (var i = 0; i < set.data.length; i++) {
      if (CSV.getPlayerName(set.data[i], set.headers) === name) {
        return { row: set.data[i], headers: set.headers };
      }
    }
    return null;
  }

  function findRowAnyWindow(data, cat, name, preferred) {
    var order = [preferred].concat(WINDOWS.filter(function (w) { return w !== preferred; }));
    for (var i = 0; i < order.length; i++) {
      var hit = findRow(data, cat, order[i], name);
      if (hit) { hit.window = order[i]; return hit; }
    }
    return null;
  }

  function shortName(full) {
    var p = String(full).trim().split(/\s+/);
    if (p.length < 2) return full;
    return p[0][0] + '. ' + p.slice(1).join(' ');
  }

  /* Which stat windows actually have data loaded */
  function availableWindows(data) {
    var out = {};
    ['batting', 'pitching', 'fielding', 'catching'].forEach(function (cat) {
      Object.keys(data[cat] || {}).forEach(function (w) {
        if (data[cat][w] && data[cat][w].data && data[cat][w].data.length) out[w] = true;
      });
    });
    return Object.keys(out);
  }

  /* Build the full player list for a given view window. */
  function buildPlayers(data, viewWindow) {
    var win = viewWindow || 'season';
    var names = {};

    // Seed with the configured roster so cards exist before stats load
    C.roster.forEach(function (r) { names[r.name] = true; });

    // Add anyone found in the data who is not on the roster
    ['batting', 'pitching', 'fielding', 'catching'].forEach(function (cat) {
      Object.keys(data[cat] || {}).forEach(function (w) {
        var set = data[cat][w];
        if (!set || !set.data) return;
        set.data.forEach(function (row) {
          var nm = CSV.getPlayerName(row, set.headers);
          if (nm && nm.length > 1) names[nm] = true;
        });
      });
    });

    var players = Object.keys(names).map(function (name) {
      var meta = C.rosterByName[name.toLowerCase()] || {};

      var p = {
        name: name,
        short: shortName(name),
        num: meta.num !== undefined ? meta.num : null,
        onRoster: !!C.rosterByName[name.toLowerCase()],
        cfgPos: meta.pos || '',
        bats: meta.bats || '',
        throws: meta.throws || ''
      };

      /* ---- batting: primary window + fixed reference windows ---- */
      var bMain = findRow(data, 'batting', win, name) || findRowAnyWindow(data, 'batting', name, 'season');
      var bSeason = findRowAnyWindow(data, 'batting', name, 'season');
      var bL8 = findRow(data, 'batting', 'last_8', name);
      var bL4 = findRow(data, 'batting', 'last_4', name);

      p.bat = bMain ? batting(bMain.row, bMain.headers) : null;
      p.batSeason = bSeason ? batting(bSeason.row, bSeason.headers) : null;
      p.batL8 = bL8 ? batting(bL8.row, bL8.headers) : null;
      p.batL4 = bL4 ? batting(bL4.row, bL4.headers) : null;

      /* ---- pitching ---- */
      var pMain = findRow(data, 'pitching', win, name) || findRowAnyWindow(data, 'pitching', name, 'season');
      var pSeason = findRowAnyWindow(data, 'pitching', name, 'season');
      var pL4 = findRow(data, 'pitching', 'last_4', name);

      p.pit = pMain ? pitching(pMain.row, pMain.headers) : null;
      p.pitSeason = pSeason ? pitching(pSeason.row, pSeason.headers) : null;
      p.pitL4 = pL4 ? pitching(pL4.row, pL4.headers) : null;

      /* ---- fielding + catching (cumulative, no window split) ---- */
      var f = findRowAnyWindow(data, 'fielding', name, 'season');
      p.fld = f ? fielding(f.row, f.headers) : null;

      var c = findRowAnyWindow(data, 'catching', name, 'season');
      p.cat = c ? catching(c.row, c.headers) : null;

      p.hasData = !!(p.bat || p.pit || p.fld || p.cat);
      p.isPitcher = !!(p.pitSeason && p.pitSeason.ip > 0);
      p.isCatcher = !!(p.cat && (p.cat.pb > 0 || p.cat.cs > 0 || p.cat.sba > 0));

      p.position = (p.fld && p.fld.position) || p.cfgPos || '';

      /* ---- trend: OPS now vs season ---- */
      var cur = p.bat && p.bat.ops || 0;
      var base = p.batSeason && p.batSeason.ops || 0;
      p.opsDelta = (cur && base) ? cur - base : 0;

      var recent = (p.batL4 && p.batL4.ops) || 0;
      p.heat = (recent && base) ? recent - base : 0;

      return p;
    });

    /* ---- Tiers by OPS among players with a real sample ---- */
    var qualified = players.filter(function (p) {
      return p.bat && p.bat.ops > 0 && (p.bat.pa >= C.minSample.pa || p.bat.ab >= C.minSample.pa);
    });
    var pool = qualified.length >= 4
      ? qualified
      : players.filter(function (p) { return p.bat && p.bat.ops > 0; });

    var ranked = pool.slice().sort(function (a, b) { return b.bat.ops - a.bat.ops; });
    var nQ = ranked.length;
    ranked.forEach(function (p, i) {
      var f = nQ > 1 ? i / (nQ - 1) : 0;
      p.tier = f <= C.tiers.core ? 1 : f <= C.tiers.support ? 2 : 3;
      p.opsRank = i + 1;
    });
    players.forEach(function (p) { if (!p.tier) p.tier = 3; });

    /* ---- Sort: data-carrying players first, then OPS, then jersey ---- */
    players.sort(function (a, b) {
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      var ao = (a.bat && a.bat.ops) || 0, bo = (b.bat && b.bat.ops) || 0;
      if (bo !== ao) return bo - ao;
      return (a.num || 999) - (b.num || 999);
    });

    /* ---- Percentiles within the team, per stat ---- */
    attachPercentiles(players);

    /* ---- Derived labels ---- */
    players.forEach(function (p) { p.role = describeRole(p); });

    return players;
  }

  /* ==================================================================
     PERCENTILES — where each player sits on the team, 0-100
     ================================================================== */
  function attachPercentiles(players) {
    var specs = [
      ['bat', 'ops', false], ['bat', 'obp', false], ['bat', 'slg', false],
      ['bat', 'avg', false], ['bat', 'kRate', true], ['bat', 'bbRate', false],
      ['pit', 'era', true], ['pit', 'whip', true], ['pit', 'strike', false],
      ['pit', 'kip', false], ['pit', 'bbip', true],
      ['fld', 'fpct', false], ['fld', 'errRate', true]
    ];

    players.forEach(function (p) { p.pct = {}; p.rank = {}; p.rankOf = {}; });

    specs.forEach(function (spec) {
      var grp = spec[0], key = spec[1], invert = spec[2];
      var vals = players
        .filter(function (p) { return p[grp] && typeof p[grp][key] === 'number' && p[grp][key] > 0; })
        .map(function (p) { return { p: p, v: p[grp][key] }; });
      if (vals.length < 2) return;

      vals.sort(function (a, b) { return invert ? a.v - b.v : b.v - a.v; });
      vals.forEach(function (item, i) {
        item.p.pct[key] = Math.round(((vals.length - i) / vals.length) * 100);
        item.p.rank[key] = i + 1;
        item.p.rankOf[key] = vals.length;
      });
    });
  }

  /* 1 -> "1st", 2 -> "2nd" ... */
  function ordinal(n) {
    if (!n) return '';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ==================================================================
     BENCHMARK GRADING
     Returns 'elite' | 'good' | 'avg' | 'watch' | 'low' for any stat.
     ================================================================== */
  function grade(family, key, value) {
    var b = C.bench[family] && C.bench[family][key];
    if (!b || value === null || value === undefined) return null;
    var inv = !!b.invert;
    function beats(a, t) { return inv ? a <= t : a >= t; }
    if (beats(value, b.elite)) return 'elite';
    if (beats(value, b.good)) return 'good';
    if (beats(value, b.avg)) return 'avg';
    if (beats(value, b.watch)) return 'watch';
    return 'low';
  }

  function gradeClass(g) {
    return g === 'elite' || g === 'good' ? 'good'
         : g === 'avg' ? 'warn'
         : g ? 'bad' : '';
  }

  function gradeLabel(g) {
    return ({ elite: 'Elite', good: 'Above Avg', avg: 'Average', watch: 'Developing', low: 'Needs Work' })[g] || '';
  }

  /* ==================================================================
     TEAM AGGREGATES
     ================================================================== */
  function teamStats(players) {
    var bat = players.filter(function (p) { return p.bat && (p.bat.pa > 0 || p.bat.ab > 0); });
    var pit = players.filter(function (p) { return p.pit && p.pit.ip > 0; });
    var fld = players.filter(function (p) { return p.fld && p.fld.tc > 0; });

    function sum(arr, fn) { return arr.reduce(function (a, x) { return a + (fn(x) || 0); }, 0); }

    var pa = sum(bat, function (p) { return p.bat.pa; });
    var ab = sum(bat, function (p) { return p.bat.ab; });
    var h  = sum(bat, function (p) { return p.bat.h; });
    var bb = sum(bat, function (p) { return p.bat.bb; });
    var hbp = sum(bat, function (p) { return p.bat.hbp; });
    var k  = sum(bat, function (p) { return p.bat.k; });
    var d2 = sum(bat, function (p) { return p.bat.d2; });
    var d3 = sum(bat, function (p) { return p.bat.d3; });
    var hr = sum(bat, function (p) { return p.bat.hr; });

    var tb = (h - d2 - d3 - hr) + 2 * d2 + 3 * d3 + 4 * hr;

    var avg = ab ? h / ab : 0;
    var obp = pa ? (h + bb + hbp) / pa : 0;
    var slg = ab ? tb / ab : 0;

    // Fallback to a straight mean when counting stats are missing
    if (!avg && bat.length) avg = sum(bat, function (p) { return p.bat.avg; }) / bat.length;
    if (!obp && bat.length) obp = sum(bat, function (p) { return p.bat.obp; }) / bat.length;
    if (!slg && bat.length) slg = sum(bat, function (p) { return p.bat.slg; }) / bat.length;

    var ip = sum(pit, function (p) { return p.pit.ip; });
    var er = sum(pit, function (p) { return p.pit.er; });
    var pbb = sum(pit, function (p) { return p.pit.bb; });
    var pk = sum(pit, function (p) { return p.pit.k; });
    var ph = sum(pit, function (p) { return p.pit.h; });
    var pitches = sum(pit, function (p) { return p.pit.pitches; });
    var strikes = sum(pit, function (p) { return p.pit.strikes; });

    var era = ip ? (er * 6) / ip : (pit.length ? sum(pit, function (p) { return p.pit.era; }) / pit.length : 0);
    var whip = ip ? (pbb + ph) / ip : (pit.length ? sum(pit, function (p) { return p.pit.whip; }) / pit.length : 0);
    var strikePct = pitches ? strikes / pitches
      : (pit.length ? sum(pit, function (p) { return p.pit.strike; }) / pit.length : 0);

    var e = sum(fld, function (p) { return p.fld.e; });
    var tc = sum(fld, function (p) { return p.fld.tc; });

    return {
      players: players.length,
      withData: players.filter(function (p) { return p.hasData; }).length,
      pa: pa, ab: ab, h: h, bb: bb, k: k, hr: hr,
      avg: avg, obp: obp, slg: slg, ops: obp + slg,
      kRate: pa ? k / pa : 0,
      bbRate: pa ? bb / pa : 0,
      ip: ip, era: era, whip: whip, strikePct: strikePct,
      pBB: pbb, pK: pk,
      bbPerIp: ip ? pbb / ip : 0,
      kPerIp: ip ? pk / ip : 0,
      errors: e, chances: tc,
      fpct: tc ? (tc - e) / tc : 0,
      pitcherCount: pit.length,
      batterCount: bat.length
    };
  }

  /* Season-vs-recent comparison for the trend chips */
  function teamTrend(players) {
    function agg(key) {
      var vals = players.filter(function (p) { return p[key] && p[key].ops > 0; });
      if (!vals.length) return 0;
      return vals.reduce(function (a, p) { return a + p[key].ops; }, 0) / vals.length;
    }
    var season = agg('batSeason');
    var l8 = agg('batL8');
    var l4 = agg('batL4');
    return { season: season, l8: l8 || season, l4: l4 || l8 || season };
  }

  /* ==================================================================
     ROLE LABEL
     ================================================================== */
  function describeRole(p) {
    var bits = [];
    if (p.position) bits.push(p.position);
    if (p.isPitcher) {
      var ip = p.pitSeason.ip;
      bits.push(ip >= 12 ? 'Starter' : ip >= 5 ? 'Reliever' : 'Spot Arm');
    }
    if (p.isCatcher && bits.indexOf('C') < 0) bits.push('Catcher');
    if (!bits.length) bits.push(p.hasData ? 'Position Player' : 'Roster');
    return bits.join(' · ');
  }

  /* ==================================================================
     FORMATTERS
     ================================================================== */
  function rate(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    dec = dec === undefined ? 3 : dec;
    var s = Number(v).toFixed(dec);
    return (v < 1 && v >= 0) ? s.replace(/^0/, '') : s;
  }
  function fixed(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toFixed(dec === undefined ? 2 : dec);
  }
  function pctText(v, dec) {
    if (v === null || v === undefined || isNaN(v) || v === 0) return '—';
    return (v * 100).toFixed(dec === undefined ? 0 : dec) + '%';
  }
  function ipText(v) {
    if (!v) return '—';
    var whole = Math.floor(v + 1e-9);
    var frac = v - whole;
    var third = frac > .6 ? '.2' : frac > .28 ? '.1' : '.0';
    return whole + third;
  }
  function signed(v, dec) {
    if (!v || isNaN(v)) return '';
    var s = rate(Math.abs(v), dec === undefined ? 3 : dec);
    return (v > 0 ? '+' : '-') + s;
  }
  function tierName(t) { return ({ 1: 'Core', 2: 'Support', 3: 'Develop' })[t] || '—'; }

  return {
    WINDOWS: WINDOWS,
    WINDOW_LABELS: WINDOW_LABELS,
    batting: batting,
    pitching: pitching,
    fielding: fielding,
    catching: catching,
    buildPlayers: buildPlayers,
    availableWindows: availableWindows,
    teamStats: teamStats,
    teamTrend: teamTrend,
    grade: grade,
    gradeClass: gradeClass,
    gradeLabel: gradeLabel,
    shortName: shortName,
    rate: rate,
    fixed: fixed,
    pctText: pctText,
    ipText: ipText,
    signed: signed,
    tierName: tierName,
    ordinal: ordinal
  };
})();
