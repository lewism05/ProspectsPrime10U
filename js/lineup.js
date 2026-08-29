/* ==========================================================================
   PROSPECTS PRIME 10U — LINEUP ENGINE
   Scores every player against every batting-order slot, builds a suggested
   card, and explains WHY each name sits where it sits.

   Slot philosophy for 10U (different from MLB - this is on purpose):
     1  Table setter. On-base is everything. Speed is a bonus, not the point.
     2  Best pure contact bat. Moves the leadoff runner, rarely strikes out.
     3  Best overall hitter. Most at-bats of any middle spot.
     4  Most damage. Extra-base pop with runners on.
     5  Second-best power. Protects the 4-hole.
     6-7 Solid contact, keeps the line moving back to the top.
     8-9 Development spots. Lower sample or lower current production, but
         at this age everyone still hits - this is not a punishment.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Lineup = (function () {
  'use strict';

  var C = P10.CONFIG;
  var S = P10.Stats;

  /* Weighting per slot. Each key is a normalized 0-1 player attribute. */
  var SLOTS = {
    1: { obp: 1.00, contact: .55, speed: .45, power: .05, label: 'Table Setter' },
    2: { obp: .80,  contact: .95, speed: .30, power: .20, label: 'Bat Control' },
    3: { obp: .75,  contact: .60, speed: .15, power: .80, label: 'Best Hitter' },
    4: { obp: .45,  contact: .40, speed: .05, power: 1.00, label: 'Run Producer' },
    5: { obp: .45,  contact: .45, speed: .10, power: .80, label: 'Protection' },
    6: { obp: .60,  contact: .70, speed: .25, power: .40, label: 'Keep It Moving' },
    7: { obp: .60,  contact: .70, speed: .30, power: .25, label: 'Second Leadoff' },
    8: { obp: .55,  contact: .60, speed: .25, power: .20, label: 'Development' },
    9: { obp: .70,  contact: .55, speed: .45, power: .15, label: 'Turns The Lineup' }
  };

  /* Opponent scenario nudges the weights. */
  var SCENARIOS = {
    weak:     { power: 1.20, obp: 0.90, contact: 1.00, speed: 1.10, label: 'Weaker Opponent' },
    standard: { power: 1.00, obp: 1.00, contact: 1.00, speed: 1.00, label: 'Even Matchup' },
    elite:    { power: 0.85, obp: 1.25, contact: 1.15, speed: 1.05, label: 'Tougher Opponent' }
  };

  /* ------------------------------------------------------------------
     Normalize each player's attributes to 0-1 against the 10U benchmarks
     rather than against the roster, so the numbers mean something even
     on a team where everyone is hitting well (or nobody is).
     ------------------------------------------------------------------ */
  function scale(v, lo, hi) {
    if (!v && v !== 0) return 0;
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  }

  function attributes(p) {
    var b = p.bat || {};
    var bb = C.bench.batting;

    var obp = scale(b.obp, bb.obp.watch * .7, bb.obp.elite);
    var power = scale(b.slg, bb.slg.watch * .7, bb.slg.elite);
    // contact = inverse of strikeout rate, blended with average
    var kGood = b.kRate > 0 ? 1 - scale(b.kRate, bb.kRate.elite, bb.kRate.watch * 1.25) : .45;
    var avgGood = scale(b.avg, bb.avg.watch * .7, bb.avg.elite);
    var contact = (kGood * .6) + (avgGood * .4);

    // speed: coach tag first, steals as a proxy second
    var tag = (P10.Store.state.gameState.speeds || {})[p.name];
    var speed;
    if (tag === 'fast') speed = .95;
    else if (tag === 'slow') speed = .18;
    else if (tag === 'normal') speed = .55;
    else speed = b.sb >= 8 ? .9 : b.sb >= 4 ? .7 : b.sb >= 1 ? .5 : .42;

    // Sample-size confidence: a hot 4-PA line should not out-rank a solid 30-PA one
    var pa = b.pa || b.ab || 0;
    var conf = Math.max(.35, Math.min(1, pa / 20));

    return {
      obp: obp, power: power, contact: contact, speed: speed,
      conf: conf, pa: pa,
      hasData: !!(b.ops > 0)
    };
  }

  function fitScore(p, slot, scenario) {
    var a = attributes(p);
    if (!a.hasData) return 0;

    var w = SLOTS[slot];
    var s = SCENARIOS[scenario] || SCENARIOS.standard;

    var raw =
      a.obp     * w.obp     * s.obp +
      a.contact * w.contact * s.contact +
      a.power   * w.power   * s.power +
      a.speed   * w.speed   * s.speed;

    var maxW = (w.obp * s.obp) + (w.contact * s.contact) + (w.power * s.power) + (w.speed * s.speed);
    var norm = maxW ? raw / maxW : 0;

    // Pull low-sample players toward the middle rather than the extremes
    return (norm * a.conf) + (0.42 * (1 - a.conf));
  }

  /* Grade bands. Tuned so that on a normal 10U roster the right kid in the
     right spot reads A, the middle of the order reads B, and only a genuine
     mismatch reads D. Raising these makes the card look harsher than the
     team actually is, which is not useful to anybody. */
  function grade(score) {
    return score >= .70 ? 'A' : score >= .57 ? 'B' : score >= .44 ? 'C' : 'D';
  }

  /* ------------------------------------------------------------------
     Greedy assignment: fill the highest-leverage slots first (3,4,1,2,...)
     so the best bats land where they matter most.
     ------------------------------------------------------------------ */
  var FILL_ORDER = [3, 4, 1, 2, 5, 6, 9, 7, 8];

  function suggest(players, scenario) {
    var eligible = players.filter(function (p) { return p.bat && p.bat.ops > 0; });
    if (!eligible.length) return [];

    var size = Math.min(9, eligible.length);
    var taken = {}, card = {};

    FILL_ORDER.slice(0, size).forEach(function (slot) {
      var best = null, bestScore = -1;
      eligible.forEach(function (p) {
        if (taken[p.name]) return;
        var sc = fitScore(p, slot, scenario);
        if (sc > bestScore) { bestScore = sc; best = p; }
      });
      if (best) {
        taken[best.name] = true;
        card[slot] = { player: best, score: bestScore };
      }
    });

    var out = [];
    for (var i = 1; i <= size; i++) {
      if (card[i]) {
        out.push({
          slot: i,
          player: card[i].player,
          score: card[i].score,
          grade: grade(card[i].score),
          role: SLOTS[i].label,
          why: explain(card[i].player, i, scenario)
        });
      }
    }
    return out;
  }

  /* Apply any manual overrides the coach has set. */
  function resolve(players, scenario) {
    var manual = P10.Store.state.lineups[scenario];
    var auto = suggest(players, scenario);
    if (!manual || !manual.length) return auto;

    var byName = {};
    players.forEach(function (p) { byName[p.name] = p; });

    var out = [];
    for (var i = 0; i < manual.length && i < 9; i++) {
      var nm = manual[i];
      var p = nm ? byName[nm] : null;
      if (!p) {
        var fallback = auto[i];
        if (fallback) out.push(fallback);
        continue;
      }
      var slot = i + 1;
      var sc = fitScore(p, slot, scenario);
      out.push({
        slot: slot, player: p, score: sc, grade: grade(sc),
        role: SLOTS[slot].label, why: explain(p, slot, scenario), manual: true
      });
    }
    return out;
  }

  function bench(players, card) {
    var inCard = {};
    card.forEach(function (s) { if (s.player) inCard[s.player.name] = true; });
    return players.filter(function (p) { return !inCard[p.name]; });
  }

  /* Best slot for a given player, used in the drawer. */
  function bestSlot(p, scenario) {
    var best = 1, bestScore = -1;
    for (var i = 1; i <= 9; i++) {
      var sc = fitScore(p, i, scenario);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    return { slot: best, score: bestScore, grade: grade(bestScore), role: SLOTS[best].label };
  }

  /* ------------------------------------------------------------------
     Plain-English reasoning. This is what a coach reads on the card.
     ------------------------------------------------------------------ */
  function explain(p, slot, scenario) {
    var b = p.bat || {};
    var a = attributes(p);
    var bb = C.bench.batting;
    var bits = [];

    if (b.obp >= bb.obp.good) bits.push(S.rate(b.obp) + ' OBP');
    else if (b.obp > 0 && b.obp < bb.obp.avg) bits.push('OBP ' + S.rate(b.obp));

    if (b.slg >= bb.slg.good) bits.push(S.rate(b.slg) + ' SLG');
    if (b.kRate > 0 && b.kRate <= bb.kRate.good) bits.push('low K');
    else if (b.kRate >= bb.kRate.watch) bits.push(Math.round(b.kRate * 100) + '% K');
    if (a.speed >= .85) bits.push('speed');
    if (a.pa && a.pa < 10) bits.push('small sample');

    var lead = ({
      1: 'Sets the table',
      2: 'Handles the bat',
      3: 'Best all-around bat',
      4: 'Drives in runs',
      5: 'Backs up the four-hole',
      6: 'Keeps the line moving',
      7: 'Restarts the order',
      8: 'Developing at-bats',
      9: 'Turns it back over'
    })[slot];

    return lead + (bits.length ? ' - ' + bits.join(', ') : '');
  }

  /* ------------------------------------------------------------------
     PITCHER ROTATION
     Ranks available arms by a blend of strike-throwing and run prevention.
     Strike rate is weighted heaviest on purpose: at 10U the arm that
     throws strikes beats the arm with better stuff, every time.
     ------------------------------------------------------------------ */
  function pitcherRank(players) {
    var bp = C.bench.pitching;
    return players
      .filter(function (p) { return p.pitSeason && p.pitSeason.ip >= C.minSample.ip; })
      .map(function (p) {
        var pit = p.pitSeason;
        var strike = scale(pit.strike, bp.strike.watch * .8, bp.strike.elite);
        var era = 1 - scale(pit.era, bp.era.elite, bp.era.watch);
        var walks = 1 - scale(pit.bbip, bp.bbip.elite, bp.bbip.watch);
        var ks = scale(pit.kip, 0, bp.kip.elite);
        var conf = Math.max(.4, Math.min(1, pit.ip / 12));

        var score = ((strike * .40) + (walks * .28) + (era * .22) + (ks * .10)) * conf + (.4 * (1 - conf));

        return {
          player: p, score: score, grade: grade(score),
          ip: pit.ip, era: pit.era, strike: pit.strike, bbip: pit.bbip, kip: pit.kip
        };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  return {
    SLOTS: SLOTS,
    SCENARIOS: SCENARIOS,
    attributes: attributes,
    fitScore: fitScore,
    suggest: suggest,
    resolve: resolve,
    bench: bench,
    bestSlot: bestSlot,
    explain: explain,
    grade: grade,
    pitcherRank: pitcherRank
  };
})();
