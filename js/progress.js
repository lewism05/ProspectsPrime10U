/* ==========================================================================
   PROSPECTS PRIME 10U — DEVELOPMENT SCORE & AWARDS

   Every youth stat app ranks kids against each other. At 10U that is mostly
   noise: a nine-player roster produces averages that swing eighty points on
   two ground balls. What actually carries signal is trajectory - is the
   strikeout rate falling, are the walks climbing, is he squaring it up more
   than he was a month ago.

   So the Development Score measures a player against his OWN past self.
   Fifty is holding steady. Above fifty is improving. A kid on a struggling
   team can score ninety, and the best hitter on the roster can score forty
   if he has stalled. That is the point.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Progress = (function () {
  'use strict';

  var C = P10.CONFIG;
  var S = P10.Stats;
  var G = P10.GameLog;

  /* ==================================================================
     DEVELOPMENT SCORE
     ================================================================== */

  /* Weights. QAB leads because it is the most honest measure of whether a
     ten-year-old is doing the right things at the plate, and the least
     hostage to whether the ball found a glove. */
  var W = { qab: 0.35, contact: 0.25, discipline: 0.20, strike: 0.20 };

  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function stdev(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(mean(a.map(function (v) { return (v - m) * (v - m); })));
  }

  /* Raw deltas: recent window against the player's own season baseline. */
  function deltas(p) {
    var base = p.batSeason, now = p.batL4 || p.batL8;
    var out = { qab: null, contact: null, discipline: null, strike: null, sample: 0 };

    if (base && now) {
      out.sample = now.pa || now.ab || 0;
      if (base.qab != null && now.qab != null) out.qab = now.qab - base.qab;
      // Contact improves when the strikeout rate FALLS, hence the sign flip.
      if (base.kRate && now.kRate != null) out.contact = base.kRate - now.kRate;
      if (base.bbRate != null && now.bbRate != null) out.discipline = now.bbRate - base.bbRate;
    }

    var pb = p.pitSeason, pn = p.pitL4;
    if (pb && pn && pb.strike && pn.strike) out.strike = pn.strike - pb.strike;

    return out;
  }

  /* Score the whole roster at once - a z-score only means something
     relative to the spread of everyone else's movement. */
  function scoreAll(players) {
    var rows = players.map(function (p) { return { player: p, d: deltas(p) }; });

    var pools = {};
    ['qab', 'contact', 'discipline', 'strike'].forEach(function (k) {
      pools[k] = rows.map(function (r) { return r.d[k]; })
                     .filter(function (v) { return v !== null && !isNaN(v); });
    });

    var stats = {};
    Object.keys(pools).forEach(function (k) {
      stats[k] = { m: mean(pools[k]), sd: stdev(pools[k]) };
    });

    function z(k, v) {
      if (v === null || v === undefined || isNaN(v)) return null;
      var st = stats[k];
      if (!st || !st.sd) return 0;                 // everyone moved together
      return Math.max(-2.5, Math.min(2.5, (v - st.m) / st.sd));
    }

    rows.forEach(function (r) {
      var parts = [], used = 0;
      ['qab', 'contact', 'discipline', 'strike'].forEach(function (k) {
        var zv = z(k, r.d[k]);
        if (zv === null) return;
        parts.push(W[k] * zv);
        used += W[k];
      });

      if (!used || r.d.sample < C.minSample.pa) {
        r.score = null;
        r.reason = r.d.sample < C.minSample.pa
          ? 'Needs ' + C.minSample.pa + ' plate appearances in the recent window'
          : 'Not enough windows loaded to compare';
        return;
      }

      // Renormalise so a player missing an input is not penalised for it.
      var composite = parts.reduce(function (a, b) { return a + b; }, 0) / used;
      r.score = Math.round(Math.max(0, Math.min(100, 50 + composite * 12.5)));
      r.inputs = {
        qab: r.d.qab, contact: r.d.contact,
        discipline: r.d.discipline, strike: r.d.strike
      };
    });

    return rows;
  }

  function scoreFor(players, name) {
    return scoreAll(players).filter(function (r) { return r.player.name === name; })[0] || null;
  }

  function band(score) {
    if (score === null || score === undefined) return { label: 'Not enough data', cls: '' };
    if (score >= 72) return { label: 'Climbing fast', cls: 'good' };
    if (score >= 58) return { label: 'Trending up', cls: 'good' };
    if (score >= 43) return { label: 'Holding steady', cls: '' };
    if (score >= 30) return { label: 'Slipping', cls: 'warn' };
    return { label: 'Needs attention', cls: 'bad' };
  }

  /* Plain sentences a parent can read without a glossary. */
  function explain(row) {
    if (!row || row.score === null) return [];
    var out = [], i = row.inputs || {};
    if (i.qab != null && Math.abs(i.qab) >= .04) {
      out.push((i.qab > 0 ? 'Quality at-bats up ' : 'Quality at-bats down ') +
               Math.abs(Math.round(i.qab * 100)) + ' points');
    }
    if (i.contact != null && Math.abs(i.contact) >= .04) {
      out.push((i.contact > 0 ? 'Striking out less, down ' : 'Striking out more, up ') +
               Math.abs(Math.round(i.contact * 100)) + ' points');
    }
    if (i.discipline != null && Math.abs(i.discipline) >= .03) {
      out.push((i.discipline > 0 ? 'Walking more, up ' : 'Walking less, down ') +
               Math.abs(Math.round(i.discipline * 100)) + ' points');
    }
    if (i.strike != null && Math.abs(i.strike) >= .03) {
      out.push((i.strike > 0 ? 'Throwing more strikes, up ' : 'Throwing fewer strikes, down ') +
               Math.abs(Math.round(i.strike * 100)) + ' points');
    }
    return out;
  }

  /* ==================================================================
     GAME SCORES
     Used to pick a game MVP. Pitching uses Tom Tango's Game Score v2,
     which counts total runs rather than earned - right for 10U, where
     the earned/unearned call rests on a volunteer scorekeeper and most
     runs are unearned anyway.
     ================================================================== */
  var GS_CONSTANT = 40;   // tune so a typical outing lands near 50

  function pitcherGameScore(line) {
    if (!line || !line.ip) return null;
    var outs = Math.round(line.ip * 3);
    return Math.round(
      GS_CONSTANT + 2 * outs + (line.k || 0)
      - 2 * (line.bb || 0) - 2 * (line.h || 0) - 3 * (line.r || 0)
    );
  }

  /* No standard exists for rating a hitter's single game, so this is
     wRAA - a real statistic - rescaled onto the same 50-centred axis so
     the two are directly comparable when picking one MVP. */
  var LW = { bb: 0.55, hbp: 0.57, b1: 0.70, b2: 1.00, b3: 1.27, hr: 1.65 };
  var WOBA_SCALE = 1.25;

  function woba(b) {
    var pa = b.pa || b.ab || 0;
    if (!pa) return null;
    var singles = Math.max(0, (b.h || 0) - (b.d2 || 0) - (b.d3 || 0) - (b.hr || 0));
    return (LW.bb * (b.bb || 0) + LW.hbp * (b.hbp || 0) + LW.b1 * singles +
            LW.b2 * (b.d2 || 0) + LW.b3 * (b.d3 || 0) + LW.hr * (b.hr || 0)) / pa;
  }

  function hitterGameScore(gameLine, teamWoba) {
    if (!gameLine) return null;
    var pa = gameLine.pa || gameLine.ab || 0;
    if (!pa) return null;
    var w = woba(gameLine);
    if (w === null) return null;
    var wraa = ((w - (teamWoba || 0.320)) / WOBA_SCALE) * pa;
    return Math.round(50 + 20 * wraa);
  }

  function teamWoba(players) {
    var ws = players.map(function (p) { return p.batSeason ? woba(p.batSeason) : null; })
                    .filter(function (v) { return v !== null; });
    return ws.length ? mean(ws) : 0.320;
  }

  /* ==================================================================
     AWARDS
     Eight categories rather than one MVP. On a nine-player roster a
     single award goes to the same two kids all season and everybody
     notices.
     ================================================================== */
  var CATEGORIES = [
    { key: 'mvp',       name: 'Game MVP',      blurb: 'Best game last time out' },
    { key: 'improved',  name: 'Most Improved', blurb: 'Biggest jump against his own baseline' },
    { key: 'grinder',   name: 'The Grinder',   blurb: 'Highest quality at-bat rate' },
    { key: 'eye',       name: 'Best Eye',      blurb: 'Best walk-to-strikeout ratio' },
    { key: 'strikes',   name: 'Strike Thrower', blurb: 'Highest strike percentage' },
    { key: 'glove',     name: 'Iron Glove',    blurb: 'Most chances without an error' },
    { key: 'toughout',  name: 'Tough Out',     blurb: 'Hardest man to strike out' },
    { key: 'setter',    name: 'Table Setter',  blurb: 'Highest on-base percentage' }
  ];

  function best(players, getter, min) {
    var pool = players
      .map(function (p) { return { player: p, v: getter(p) }; })
      .filter(function (x) { return x.v !== null && x.v !== undefined && !isNaN(x.v) && x.v > (min || 0); });
    if (!pool.length) return null;
    pool.sort(function (a, b) { return b.v - a.v; });
    return pool[0];
  }

  /* Game MVP needs per-game numbers. Hitting comes from a "last game"
     export if one is loaded; pitching from the most recent logged game,
     which is usually there because the coach logs every game anyway. */
  function gameMvp(players, st) {
    var tw = teamWoba(players);
    var cands = [];

    var lastGameSet = st.data && st.data.batting && st.data.batting.last_game;
    if (lastGameSet && lastGameSet.data) {
      players.forEach(function (p) {
        var row = lastGameSet.data.filter(function (r) {
          return P10.CSV.getPlayerName(r, lastGameSet.headers) === p.name;
        })[0];
        if (!row) return;
        var line = S.batting(row, lastGameSet.headers);
        var gs = hitterGameScore(line, tw);
        if (gs !== null) cands.push({ player: p, score: gs, how: 'bat', line: line });
      });
    }

    var games = G.all();
    if (games.length) {
      (games[0].pitchers || []).forEach(function (pt) {
        var p = players.filter(function (x) { return x.name === pt.name; })[0];
        if (!p) return;
        var gs = pitcherGameScore({
          ip: Number(pt.ip) || 0, k: Number(pt.k) || 0,
          bb: Number(pt.bb) || 0, r: Number(pt.r) || 0, h: 0
        });
        if (gs !== null) cands.push({ player: p, score: gs, how: 'arm', line: pt });
      });
    }

    if (!cands.length) return null;
    cands.sort(function (a, b) { return b.score - a.score; });
    return cands[0];
  }

  function compute(players, st) {
    var dev = scoreAll(players);
    var devBy = {};
    dev.forEach(function (r) { devBy[r.player.name] = r; });

    var min = C.minSample;
    var out = {};

    var mvp = gameMvp(players, st);
    if (mvp) {
      out.mvp = {
        player: mvp.player,
        detail: mvp.how === 'arm'
          ? S.ipText(Number(mvp.line.ip) || 0) + ' IP, ' + (mvp.line.k || 0) + ' K, ' +
            (mvp.line.r || 0) + ' R'
          : (mvp.line.h || 0) + '-for-' + (mvp.line.ab || 0) +
            ((mvp.line.bb ? ', ' + mvp.line.bb + ' BB' : '')),
        value: 'Game score ' + mvp.score
      };
    }

    /* Only award this to somebody genuinely trending up. Crowning a "Most
       Improved" whose own subtitle reads "holding steady" is incoherent,
       and the award stops meaning anything the first time it happens. */
    var imp = dev.filter(function (r) { return r.score !== null && r.score >= 58; })
                 .sort(function (a, b) { return b.score - a.score; })[0];
    if (imp) {
      out.improved = {
        player: imp.player,
        detail: explain(imp)[0] || band(imp.score).label,
        value: 'Dev ' + imp.score
      };
    }

    var g = best(players, function (p) {
      return p.bat && (p.bat.pa >= min.pa) ? p.bat.qab : null;
    });
    if (g) out.grinder = { player: g.player, detail: 'Quality at-bat rate',
                           value: Math.round(g.v * 100) + '%' };

    var eye = best(players, function (p) {
      if (!p.bat || p.bat.pa < min.pa || !p.bat.k) return null;
      return p.bat.bb / p.bat.k;
    });
    if (eye) out.eye = { player: eye.player, detail: eye.player.bat.bb + ' walks, ' +
                         eye.player.bat.k + ' strikeouts', value: S.fixed(eye.v, 2) + ' BB/K' };

    var strk = best(players, function (p) {
      return p.pit && p.pit.ip >= min.ip ? p.pit.strike : null;
    });
    if (strk) out.strikes = { player: strk.player,
                              detail: S.ipText(strk.player.pit.ip) + ' innings',
                              value: Math.round(strk.v * 100) + '% strikes' };

    var glove = best(players, function (p) {
      return p.fld && p.fld.e === 0 ? p.fld.tc : null;
    }, 4);
    if (glove) out.glove = { player: glove.player, detail: 'No errors all season',
                             value: glove.v + ' chances' };

    var tough = best(players, function (p) {
      return p.bat && p.bat.pa >= min.pa && p.bat.kRate > 0 ? (1 - p.bat.kRate) : null;
    });
    if (tough) out.toughout = { player: tough.player, detail: 'Lowest strikeout rate',
                                value: Math.round(tough.player.bat.kRate * 100) + '% K' };

    var setter = best(players, function (p) {
      return p.bat && p.bat.pa >= min.pa ? p.bat.obp : null;
    });
    if (setter) out.setter = { player: setter.player, detail: 'Reaches base most often',
                               value: S.rate(setter.v) };

    /* Spread them out. Without this the same two kids take everything, and
       on a nine-player roster everybody notices by week three. This is a
       deliberate thumb on the scale, so Game MVP is left alone - it stays a
       pure result. */
    if (P10.Store.state.gameState.rotateAwards !== false) {
      var taken = {};
      if (out.mvp) taken[out.mvp.player.name] = 1;
      CATEGORIES.forEach(function (cat) {
        if (cat.key === 'mvp' || !out[cat.key]) return;
        var winner = out[cat.key].player.name;
        if (!taken[winner]) { taken[winner] = 1; return; }
        // Already has one - hand it to the next eligible name if there is one.
        var alt = nextBest(players, cat.key, taken, st);
        if (alt) out[cat.key] = alt;
        else taken[winner]++;
      });
    }

    return { awards: out, categories: CATEGORIES, dev: dev, devBy: devBy };
  }

  function nextBest(players, key, taken, st) {
    var min = C.minSample;
    var pool = players.filter(function (p) { return !taken[p.name]; });
    if (!pool.length) return null;

    var map = {
      grinder:  [function (p) { return p.bat && p.bat.pa >= min.pa ? p.bat.qab : null; },
                 'Quality at-bat rate', function (v) { return Math.round(v * 100) + '%'; }],
      eye:      [function (p) { return p.bat && p.bat.pa >= min.pa && p.bat.k ? p.bat.bb / p.bat.k : null; },
                 'Walks against strikeouts', function (v) { return S.fixed(v, 2) + ' BB/K'; }],
      strikes:  [function (p) { return p.pit && p.pit.ip >= min.ip ? p.pit.strike : null; },
                 'On the mound', function (v) { return Math.round(v * 100) + '% strikes'; }],
      glove:    [function (p) { return p.fld && p.fld.e === 0 ? p.fld.tc : null; },
                 'No errors all season', function (v) { return v + ' chances'; }],
      toughout: [function (p) { return p.bat && p.bat.pa >= min.pa && p.bat.kRate > 0 ? 1 - p.bat.kRate : null; },
                 'Low strikeout rate', function (v) { return Math.round((1 - v) * 100) + '% K'; }],
      setter:   [function (p) { return p.bat && p.bat.pa >= min.pa ? p.bat.obp : null; },
                 'Reaches base often', function (v) { return S.rate(v); }],
      improved: [function (p) { return null; }, '', function () { return ''; }]
    };
    var spec = map[key];
    if (!spec) return null;
    var b = best(pool, spec[0], key === 'glove' ? 4 : 0);
    if (!b) return null;
    taken[b.player.name] = 1;
    return { player: b.player, detail: spec[1], value: spec[2](b.v) };
  }

  return {
    scoreAll: scoreAll,
    scoreFor: scoreFor,
    band: band,
    explain: explain,
    deltas: deltas,
    pitcherGameScore: pitcherGameScore,
    hitterGameScore: hitterGameScore,
    woba: woba,
    teamWoba: teamWoba,
    compute: compute,
    CATEGORIES: CATEGORIES
  };
})();
