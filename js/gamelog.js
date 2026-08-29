/* ==========================================================================
   PROSPECTS PRIME 10U — GAME LOG & MATCHUP INTELLIGENCE

   Why this exists: a GameChanger export is season and last-N aggregates.
   It carries no per-opponent splits, so "how did we do against these guys"
   cannot be computed from stats alone. The coach logs each game once -
   score, who pitched, who batted where - and everything downstream falls
   out of that: head-to-head history, the lineup that was actually run, arm
   usage against a specific club, and a diff between what was run last time
   and what the current form says to run now.

   Entering a game takes about a minute. It is the only manual input in the
   app, and it is what turns a stat page into a scouting report.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.GameLog = (function () {
  'use strict';

  var C = P10.CONFIG;
  var S = P10.Stats;
  var L = P10.Lineup;

  /* ==================================================================
     STORAGE
     Games live in Store.state.games so they persist and publish with
     everything else.
     ================================================================== */
  function all() {
    var g = P10.Store.state.games;
    return Array.isArray(g) ? g : [];
  }

  function save(games) {
    P10.Store.state.games = games;
    P10.Store.persistGames();
  }

  function blank() {
    return {
      id: 'g' + Date.now() + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().slice(0, 10),
      opponent: '',
      away: false,
      us: null,          // our runs
      them: null,        // their runs
      lineup: [],        // player names in batting order
      pitchers: [],      // [{ name, ip, r, bb, k, pitches }]
      notes: ''
    };
  }

  function upsert(game) {
    var games = all().slice();
    var i = games.findIndex(function (g) { return g.id === game.id; });
    if (i >= 0) games[i] = game; else games.push(game);
    games.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    save(games);
    return game;
  }

  function remove(id) {
    save(all().filter(function (g) { return g.id !== id; }));
  }

  function byId(id) {
    return all().filter(function (g) { return g.id === id; })[0] || null;
  }

  /* ==================================================================
     OPPONENT MATCHING
     Team names get typed slightly differently every time. Normalize hard
     so "AR Bombers 10U", "Ar Bombers", and "arkansas bombers 10u" all
     land on the same opponent.
     ================================================================== */
  function oppKey(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\b(\d{1,2}u|u\d{1,2})\b/g, ' ')          // age group
      .replace(/\b(baseball|club|team|academy|select|travel)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sameOpponent(a, b) {
    var ka = oppKey(a), kb = oppKey(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    // one name contained in the other ("bombers" vs "ar bombers")
    return ka.length > 3 && kb.length > 3 && (ka.indexOf(kb) >= 0 || kb.indexOf(ka) >= 0);
  }

  function versus(opponent) {
    return all().filter(function (g) { return sameOpponent(g.opponent, opponent); });
  }

  /* Every distinct opponent we have logged, most recent first. */
  function opponents() {
    var seen = {}, out = [];
    all().forEach(function (g) {
      var k = oppKey(g.opponent);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(g.opponent);
    });
    return out;
  }

  /* ==================================================================
     HEAD TO HEAD
     ================================================================== */
  function headToHead(opponent) {
    var games = versus(opponent);
    if (!games.length) return null;

    var w = 0, l = 0, t = 0, rf = 0, ra = 0, scored = 0;
    games.forEach(function (g) {
      if (g.us === null || g.them === null) return;
      scored++;
      rf += g.us; ra += g.them;
      if (g.us > g.them) w++;
      else if (g.us < g.them) l++;
      else t++;
    });

    var played = games.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    return {
      opponent: opponent,
      games: played,
      count: games.length,
      w: w, l: l, t: t,
      scoredGames: scored,
      runsFor: rf,
      runsAgainst: ra,
      diff: rf - ra,
      avgFor: scored ? rf / scored : null,
      avgAgainst: scored ? ra / scored : null,
      last: played[0] || null
    };
  }

  /* ==================================================================
     ARMS USED AGAINST THIS OPPONENT
     ================================================================== */
  function armsUsed(opponent, players) {
    var byName = {};
    (players || []).forEach(function (p) { byName[p.name] = p; });

    var agg = {};
    versus(opponent).forEach(function (g) {
      (g.pitchers || []).forEach(function (pt) {
        if (!pt.name) return;
        var a = agg[pt.name] || (agg[pt.name] = {
          name: pt.name, outings: 0, ip: 0, r: 0, bb: 0, k: 0, pitches: 0, dates: []
        });
        a.outings++;
        a.ip += Number(pt.ip) || 0;
        a.r += Number(pt.r) || 0;
        a.bb += Number(pt.bb) || 0;
        a.k += Number(pt.k) || 0;
        a.pitches += Number(pt.pitches) || 0;
        a.dates.push(g.date);
      });
    });

    return Object.keys(agg).map(function (n) {
      var a = agg[n];
      a.player = byName[n] || null;
      a.rPerIp = a.ip ? a.r / a.ip : null;
      a.bbPerIp = a.ip ? a.bb / a.ip : null;
      return a;
    }).sort(function (x, y) { return y.ip - x.ip; });
  }

  /* ==================================================================
     FORM SINCE A DATE
     Who has moved, and which way, since we last saw this club. Uses the
     stat windows we have rather than pretending we have game-by-game
     splits: season is the baseline, last 4 is "now".
     ================================================================== */
  function formShift(players) {
    return (players || [])
      .filter(function (p) {
        return p.batSeason && p.batL4 && p.batSeason.ops > 0 && p.batL4.ops > 0;
      })
      .map(function (p) {
        return { player: p, delta: p.batL4.ops - p.batSeason.ops };
      })
      .filter(function (x) { return Math.abs(x.delta) >= 0.08; })
      .sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  }

  /* ==================================================================
     LINEUP DIFF
     What we ran against them last time vs what the engine says now.
     ================================================================== */
  function lineupDiff(lastLineup, players, scenario) {
    var suggested = L.resolve(players, scenario || 'standard');
    var byName = {};
    (players || []).forEach(function (p) { byName[p.name] = p; });

    var oldSpot = {};
    (lastLineup || []).forEach(function (nm, i) { if (nm) oldSpot[nm] = i + 1; });

    var rows = suggested.map(function (s) {
      var was = oldSpot[s.player.name] || null;
      return {
        slot: s.slot,
        player: s.player,
        grade: s.grade,
        role: s.role,
        why: s.why,
        was: was,
        move: was ? was - s.slot : null,   // positive = moving up the order
        isNew: !was
      };
    });

    var dropped = (lastLineup || []).filter(function (nm) {
      return nm && !suggested.some(function (s) { return s.player.name === nm; });
    }).map(function (nm) { return byName[nm] || { name: nm }; });

    return { rows: rows, dropped: dropped, hadLineup: !!(lastLineup && lastLineup.length) };
  }

  /* ==================================================================
     THE FULL PICTURE
     Everything a coach wants in front of them before a rematch.
     ================================================================== */
  function matchupReport(game, players, scenario) {
    if (!game || !game.opponent) return null;
    var h2h = headToHead(game.opponent);
    if (!h2h) return null;

    var last = h2h.last;
    return {
      opponent: game.opponent,
      h2h: h2h,
      last: last,
      arms: armsUsed(game.opponent, players),
      form: formShift(players),
      diff: lineupDiff(last && last.lineup, players, scenario),
      rested: restStatus(players)
    };
  }

  /* ==================================================================
     ARM REST
     Reads the most recent outing for each pitcher out of the log and
     applies USA Baseball's 9-10 rest table to it.
     ================================================================== */
  function restStatus(players) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var lastOuting = {};

    all().forEach(function (g) {
      (g.pitchers || []).forEach(function (pt) {
        if (!pt.name) return;
        var cur = lastOuting[pt.name];
        if (!cur || String(g.date) > String(cur.date)) {
          lastOuting[pt.name] = { date: g.date, pitches: Number(pt.pitches) || 0 };
        }
      });
    });

    return (players || [])
      .filter(function (p) { return p.isPitcher || lastOuting[p.name]; })
      .map(function (p) {
        var o = lastOuting[p.name];
        if (!o || !o.pitches) {
          return { player: p, status: 'unknown', daysRest: null, lastPitches: null, available: true };
        }
        var d = P10.Schedule.parseDate(o.date);
        var days = d ? Math.floor((today - d) / 86400000) : null;

        var required = 0;
        for (var i = 0; i < C.pitchLimits.rest.length; i++) {
          if (o.pitches >= C.pitchLimits.rest[i].pitches) {
            required = C.pitchLimits.rest[i].days;
            break;
          }
        }
        var available = days === null ? true : days >= required;
        return {
          player: p,
          lastDate: o.date,
          lastPitches: o.pitches,
          daysRest: days,
          required: required,
          available: available,
          status: available ? 'available' : 'resting'
        };
      })
      .sort(function (a, b) {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return (b.daysRest || 0) - (a.daysRest || 0);
      });
  }

  return {
    all: all,
    save: save,
    blank: blank,
    upsert: upsert,
    remove: remove,
    byId: byId,
    oppKey: oppKey,
    sameOpponent: sameOpponent,
    versus: versus,
    opponents: opponents,
    headToHead: headToHead,
    armsUsed: armsUsed,
    formShift: formShift,
    lineupDiff: lineupDiff,
    matchupReport: matchupReport,
    restStatus: restStatus
  };
})();
