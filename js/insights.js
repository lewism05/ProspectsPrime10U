/* ==========================================================================
   PROSPECTS PRIME 10U — INSIGHTS
   Weakness detection, achievement badges, team practice focus.
   Every threshold traces back to CONFIG.bench so it stays 10U-calibrated.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Insights = (function () {
  'use strict';

  var C = P10.CONFIG;
  var S = P10.Stats;

  /* ==================================================================
     PLAYER ISSUES
     Returns [{ key, title, detail, severity, area }] worst-first.
     key maps into P10.DRILLS.
     ================================================================== */
  function playerIssues(p) {
    var out = [];
    var b = p.bat, pit = p.pit, f = p.fld, c = p.cat;
    var min = C.minSample;

    /* ---- Batting ---- */
    if (b && (b.pa >= min.pa || b.ab >= min.pa)) {

      if (b.kRate >= C.bench.batting.kRate.watch) {
        out.push({
          key: 'high_k_rate', area: 'Batting', severity: b.kRate >= .45 ? 3 : 2,
          title: 'Strikeout rate is high',
          detail: 'Striking out in ' + Math.round(b.kRate * 100) + '% of trips. At 10U anything over ' +
                  Math.round(C.bench.batting.kRate.avg * 100) + '% costs real at-bats. Contact and tracking come first.'
        });
      } else if (b.kRate >= C.bench.batting.kRate.avg) {
        out.push({
          key: 'high_k_rate', area: 'Batting', severity: 1,
          title: 'Strikeouts creeping up',
          detail: Math.round(b.kRate * 100) + '% strikeout rate. Not a crisis, but two-strike work would help.'
        });
      }

      if (b.obp > 0 && b.obp < C.bench.batting.obp.watch) {
        out.push({
          key: 'low_obp', area: 'Batting', severity: 3,
          title: 'Not reaching base',
          detail: S.rate(b.obp) + ' on-base. Getting on base is the whole job at this age - runs come from traffic, not from power.'
        });
      } else if (b.obp > 0 && b.obp < C.bench.batting.obp.avg) {
        out.push({
          key: 'low_obp', area: 'Batting', severity: 2,
          title: 'On-base needs work',
          detail: S.rate(b.obp) + ' on-base vs a ' + S.rate(C.bench.batting.obp.avg) + ' age-group average. Plate discipline is the fastest gain.'
        });
      }

      if (b.slg > 0 && b.slg < C.bench.batting.slg.watch && b.avg >= C.bench.batting.avg.avg) {
        out.push({
          key: 'low_slg', area: 'Batting', severity: 1,
          title: 'Contact without impact',
          detail: 'Hitting ' + S.rate(b.avg) + ' but slugging only ' + S.rate(b.slg) +
                  '. Making contact but not driving it. Work the hand path and the lower half.'
        });
      }

      if (b.avg > 0 && b.avg < C.bench.batting.avg.watch) {
        out.push({
          key: 'low_contact', area: 'Batting', severity: 2,
          title: 'Contact quality is down',
          detail: S.rate(b.avg) + ' average. Get back to tracking and a short path before touching anything else.'
        });
      }

      // Slump detector: recent 4 well below season
      if (p.batSeason && p.batL4 && p.batSeason.ops > 0 && p.batL4.ops > 0) {
        var drop = p.batSeason.ops - p.batL4.ops;
        if (drop >= .200) {
          out.push({
            key: 'cold_streak', area: 'Batting', severity: 2,
            title: 'Cold stretch',
            detail: 'OPS is ' + S.rate(drop) + ' below the season number over the last four. Reset the swing, do not rebuild it.'
          });
        }
      }
    }

    /* ---- Pitching ---- */
    if (pit && pit.ip >= min.ip) {

      if (pit.strike > 0 && pit.strike < C.bench.pitching.strike.watch) {
        out.push({
          key: 'low_strike', area: 'Pitching', severity: 3,
          title: 'Strike rate is low',
          detail: Math.round(pit.strike * 100) + '% strikes. Under ' + Math.round(C.bench.pitching.strike.avg * 100) +
                  '% means walks decide the inning. Command work before anything else.'
        });
      }

      if (pit.bbip >= C.bench.pitching.bbip.watch) {
        out.push({
          key: 'high_walks', area: 'Pitching', severity: 3,
          title: 'Walking too many',
          detail: S.fixed(pit.bbip, 2) + ' walks per inning. Free bases are the number one run source at 10U.'
        });
      } else if (pit.bbip >= C.bench.pitching.bbip.avg) {
        out.push({
          key: 'high_walks', area: 'Pitching', severity: 2,
          title: 'Walk rate elevated',
          detail: S.fixed(pit.bbip, 2) + ' walks per inning. Target work will bring this down quickly.'
        });
      }

      if (pit.era > 0 && pit.era >= C.bench.pitching.era.watch) {
        out.push({
          key: 'high_era', area: 'Pitching', severity: 2,
          title: 'Runs are scoring',
          detail: S.fixed(pit.era, 2) + ' ERA over ' + S.ipText(pit.ip) + ' innings. Check the release point and pitch plane.'
        });
      }

      if (pit.whip > 0 && pit.whip >= C.bench.pitching.whip.watch) {
        out.push({
          key: 'high_whip', area: 'Pitching', severity: 2,
          title: 'Traffic on the bases',
          detail: S.fixed(pit.whip, 2) + ' WHIP. Too many baserunners per inning - work the bottom of the zone.'
        });
      }
    }

    /* ---- Fielding ---- */
    if (f && f.tc >= min.tc) {
      if (f.errRate >= C.bench.fielding.errRate.watch) {
        out.push({
          key: 'high_errors', area: 'Defense', severity: 2,
          title: 'Error rate is high',
          detail: f.e + ' errors on ' + f.tc + ' chances (' + Math.round(f.errRate * 100) + '%). Footwork and short hops.'
        });
      } else if (f.fpct > 0 && f.fpct < C.bench.fielding.fpct.watch) {
        out.push({
          key: 'low_fpct', area: 'Defense', severity: 1,
          title: 'Fielding percentage low',
          detail: S.rate(f.fpct) + ' fielding. Mostly a clean-transfer and throw-accuracy issue at this age.'
        });
      }
    }

    /* ---- Catching ---- */
    if (c && (c.pb > 0 || c.sba > 0)) {
      if (c.pb >= 6) {
        out.push({
          key: 'high_pb', area: 'Catching', severity: 2,
          title: 'Passed balls adding up',
          detail: c.pb + ' passed balls. Blocking is a body skill, not a glove skill - build it with reps.'
        });
      }
      if (c.sba >= 6 && c.csPct < C.bench.catching.csPct.watch) {
        out.push({
          key: 'low_cs', area: 'Catching', severity: 1,
          title: 'Running game is open',
          detail: c.cs + ' caught of ' + (c.cs + c.sba) + ' attempts. Work the transfer before the arm strength.'
        });
      }
    }

    out.sort(function (a, b2) { return b2.severity - a.severity; });
    return out;
  }

  /* ==================================================================
     STRENGTHS — the positive counterpart, for the player card
     ================================================================== */
  function playerStrengths(p) {
    var out = [];
    var b = p.bat, pit = p.pit, f = p.fld;
    var min = C.minSample;

    if (b && (b.pa >= min.pa || b.ab >= min.pa)) {
      if (S.grade('batting', 'obp', b.obp) === 'elite') out.push('Elite on-base skills');
      else if (S.grade('batting', 'obp', b.obp) === 'good') out.push('Gets on base');
      if (S.grade('batting', 'slg', b.slg) === 'elite') out.push('Real extra-base pop');
      if (b.kRate > 0 && b.kRate <= C.bench.batting.kRate.good) out.push('Tough to strike out');
      if (b.bbRate >= C.bench.batting.bbRate.good) out.push('Disciplined at the plate');
      if (b.sb >= 6) out.push('Threat on the bases');
    }
    if (pit && pit.ip >= min.ip) {
      if (pit.strike >= C.bench.pitching.strike.good) out.push('Throws strikes');
      if (pit.era > 0 && pit.era <= C.bench.pitching.era.good) out.push('Keeps runs off the board');
      if (pit.kip >= C.bench.pitching.kip.good) out.push('Misses bats');
    }
    if (f && f.tc >= min.tc && f.fpct >= C.bench.fielding.fpct.good) out.push('Reliable glove');

    return out;
  }

  /* ==================================================================
     ACHIEVEMENTS — badges for the roster grid and player drawer
     ================================================================== */
  function achievements(p, all) {
    var out = [];
    var b = p.bat, pit = p.pit, f = p.fld;
    if (!p.hasData) return out;

    function topOf(getter, minVal) {
      var pool = all.filter(function (x) { var v = getter(x); return v && v > (minVal || 0); });
      if (pool.length < 3) return null;
      pool.sort(function (a, c) { return getter(c) - getter(a); });
      return pool[0];
    }
    function bottomOf(getter, minVal) {
      var pool = all.filter(function (x) { var v = getter(x); return v && v > (minVal || 0); });
      if (pool.length < 3) return null;
      pool.sort(function (a, c) { return getter(a) - getter(c); });
      return pool[0];
    }

    var opsLeader = topOf(function (x) { return x.bat && x.bat.ops; });
    if (opsLeader === p) out.push({ em: '👑', label: 'Team OPS Leader' });

    var obpLeader = topOf(function (x) { return x.bat && x.bat.obp; });
    if (obpLeader === p && obpLeader !== opsLeader) out.push({ em: '🧲', label: 'On-Base Leader' });

    var eraLeader = bottomOf(function (x) { return x.pit && x.pit.ip >= C.minSample.ip ? x.pit.era : 0; });
    if (eraLeader === p) out.push({ em: '🛡️', label: 'Lowest ERA' });

    var strikeLeader = topOf(function (x) { return x.pit && x.pit.ip >= C.minSample.ip ? x.pit.strike : 0; });
    if (strikeLeader === p) out.push({ em: '🎯', label: 'Best Strike %' });

    if (b) {
      if (b.ops >= C.bench.batting.ops.elite) out.push({ em: '🔥', label: '1.200+ OPS' });
      if (b.obp >= C.bench.batting.obp.elite) out.push({ em: '💎', label: '.600 OBP' });
      if (b.hr >= 1) out.push({ em: '💣', label: b.hr + ' Home Run' + (b.hr > 1 ? 's' : '') });
      if (b.sb >= 10) out.push({ em: '⚡', label: b.sb + ' Steals' });
      if (b.kRate > 0 && b.kRate <= C.bench.batting.kRate.elite && b.pa >= C.minSample.pa) {
        out.push({ em: '🪶', label: 'Rarely Strikes Out' });
      }
      if (b.d2 + b.d3 >= 5) out.push({ em: '↔️', label: 'Gap Power' });
    }
    if (pit && pit.ip >= C.minSample.ip) {
      if (pit.strike >= C.bench.pitching.strike.elite) out.push({ em: '🧊', label: 'Strike Machine' });
      if (pit.era > 0 && pit.era <= C.bench.pitching.era.elite) out.push({ em: '🔒', label: 'Sub-2.00 ERA' });
      if (pit.kip >= C.bench.pitching.kip.elite) out.push({ em: '🌪️', label: 'Swing & Miss Stuff' });
      if (pit.ip >= 15) out.push({ em: '🐴', label: 'Innings Eater' });
    }
    if (f && f.tc >= 12 && f.e === 0) out.push({ em: '🧤', label: 'Error-Free' });
    if (f && f.tc >= C.minSample.tc && f.fpct >= C.bench.fielding.fpct.elite) out.push({ em: '✨', label: 'Gold Glove Pace' });

    // Hot streak
    if (p.batL4 && p.batSeason && p.batL4.ops - p.batSeason.ops >= .200) {
      out.push({ em: '📈', label: 'Heating Up' });
    }

    return out;
  }

  /* ==================================================================
     TEAM FOCUS — what the whole team should work on next practice
     ================================================================== */
  function teamFocus(players, team) {
    var focus = [];
    if (!team || !team.withData) return focus;

    var b = C.bench;

    if (team.kRate >= b.batting.kRate.avg) {
      focus.push({
        key: 'high_k_rate', area: 'Batting', priority: team.kRate >= b.batting.kRate.watch ? 3 : 2,
        title: 'Team strikeout rate',
        detail: 'The team is striking out in ' + Math.round(team.kRate * 100) +
                '% of plate appearances. Tracking and two-strike approach for everyone.',
        stat: Math.round(team.kRate * 100) + '%'
      });
    }

    if (team.obp > 0 && team.obp < b.batting.obp.avg) {
      focus.push({
        key: 'low_obp', area: 'Batting', priority: 3,
        title: 'Team on-base',
        detail: 'Team OBP of ' + S.rate(team.obp) + ' against a ' + S.rate(b.batting.obp.avg) +
                ' age-group average. More traffic means more runs without changing a single swing.',
        stat: S.rate(team.obp)
      });
    }

    if (team.bbPerIp >= b.pitching.bbip.avg) {
      focus.push({
        key: 'high_walks', area: 'Pitching', priority: team.bbPerIp >= b.pitching.bbip.watch ? 3 : 2,
        title: 'Walks from the mound',
        detail: 'Staff is issuing ' + S.fixed(team.bbPerIp, 2) + ' walks per inning. ' +
                'This is the number one thing separating good 10U teams from average ones.',
        stat: S.fixed(team.bbPerIp, 2) + ' BB/IP'
      });
    }

    if (team.strikePct > 0 && team.strikePct < b.pitching.strike.avg) {
      focus.push({
        key: 'low_strike', area: 'Pitching', priority: 3,
        title: 'Staff strike percentage',
        detail: 'Only ' + Math.round(team.strikePct * 100) + '% of pitches are strikes. ' +
                'Bullpen command work should be a standing item every practice.',
        stat: Math.round(team.strikePct * 100) + '%'
      });
    }

    if (team.fpct > 0 && team.fpct < b.fielding.fpct.avg && team.chances >= 30) {
      focus.push({
        key: 'high_errors', area: 'Defense', priority: 2,
        title: 'Defensive cleanliness',
        detail: team.errors + ' errors on ' + team.chances + ' chances (' + S.rate(team.fpct) +
                ' fielding). Short hops and clean transfers.',
        stat: S.rate(team.fpct)
      });
    }

    if (team.slg > 0 && team.slg < b.batting.slg.watch) {
      focus.push({
        key: 'low_slg', area: 'Batting', priority: 1,
        title: 'Driving the ball',
        detail: 'Team slugging is ' + S.rate(team.slg) + '. Contact is happening but it is not doing damage.',
        stat: S.rate(team.slg)
      });
    }

    focus.sort(function (a, c) { return c.priority - a.priority; });

    // Always give the coach something to run
    if (!focus.length) {
      focus.push({
        key: 'team_focus_general', area: 'Team', priority: 1,
        title: 'The team is in good shape',
        detail: 'No stat is flagging below the 10U benchmarks right now. Spend the time on situational baseball - ' +
                'knowing where the ball goes before it is hit is what separates teams at this age.',
        stat: 'On track'
      });
    }

    return focus;
  }

  /* ==================================================================
     PLAYING TIME / OPPORTUNITY
     Flags kids who are getting materially fewer reps than the group.
     ================================================================== */
  function opportunityGaps(players) {
    var withPa = players.filter(function (p) { return p.bat && p.bat.pa > 0; });
    if (withPa.length < 4) return [];

    var pas = withPa.map(function (p) { return p.bat.pa; }).sort(function (a, b) { return a - b; });
    var median = pas[Math.floor(pas.length / 2)];

    return withPa
      .filter(function (p) { return p.bat.pa < median * 0.7; })
      .map(function (p) {
        return {
          player: p,
          pa: p.bat.pa,
          median: median,
          gap: Math.round((1 - p.bat.pa / median) * 100)
        };
      })
      .sort(function (a, b) { return a.pa - b.pa; });
  }

  return {
    playerIssues: playerIssues,
    playerStrengths: playerStrengths,
    achievements: achievements,
    teamFocus: teamFocus,
    opportunityGaps: opportunityGaps
  };
})();
