/* ==========================================================================
   PROSPECTS PRIME 10U — MY PLAYER

   A parent opens this app to find out how their own kid is doing. Until now
   that meant hunting through a roster grid every single visit. This is their
   home screen: pick once, remembered after that.

   What shows here follows the rule set for the whole app - stats and
   progress are open to everyone, coaching critique is not. A parent sees
   the numbers, the trajectory and what is going well. The "work on this"
   section and its drills appear only in coach mode, because a weakness
   read cold off a screen lands very differently than the same sentence
   from a coach at practice.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.MyPlayer = (function () {
  'use strict';

  var C = P10.CONFIG;
  var S = P10.Stats;
  var I = P10.Insights;
  var Pr = P10.Progress;

  var KEY = C.ns + '_myplayer';

  function get() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function set(name) {
    try { name ? localStorage.setItem(KEY, name) : localStorage.removeItem(KEY); } catch (e) {}
  }
  function esc(s) { return P10.Views.esc(s); }

  /* ==================================================================
     PLAIN ENGLISH
     Every number a parent sees gets one sentence saying what it is and
     what normal looks like. A stat nobody can interpret is decoration.
     ================================================================== */
  var MEANING = {
    qab: ['Quality At-Bats', 'How often he does something useful at the plate - a hard-hit ball even ' +
          'for an out, a walk, a long at-bat, moving a runner over. It rewards the process rather than ' +
          'whether the ball found a glove.', 'batting', 'qab'],
    obp: ['On-Base', 'How often he reaches base any way at all. At this age it matters more than ' +
          'batting average, because runs come from traffic.', 'batting', 'obp'],
    avg: ['Batting Average', 'Hits divided by at-bats. Familiar, but it ignores walks and punishes ' +
          'a line drive hit right at somebody.', 'batting', 'avg'],
    ops: ['OPS', 'On-base plus slugging in one number - reaching base and hitting for extra bases ' +
          'combined.', 'batting', 'ops'],
    kRate: ['Strikeout Rate', 'How often an at-bat ends in a strikeout. Lower is better, and this ' +
            'is usually the fastest thing to improve at ten.', 'batting', 'kRate'],
    strike: ['Strike Rate', 'The share of his pitches that are strikes. At this age this predicts ' +
             'success better than velocity or strikeouts.', 'pitching', 'strike'],
    era: ['ERA', 'Runs allowed per game on the mound. Read it gently at 10U - a pitcher does not ' +
          'control his defense.', 'pitching', 'era'],
    fpct: ['Fielding', 'The share of chances handled cleanly.', 'fielding', 'fpct']
  };

  function statBlock(label, value, meaning, grade) {
    var cls = grade ? ' text-' + S.gradeClass(grade) : '';
    return '<div class="mp-stat">' +
      '<div class="mp-stat-head">' +
        '<span class="mp-stat-val' + cls + '">' + esc(value) + '</span>' +
        '<span class="mp-stat-lab">' + esc(label) + '</span>' +
        (grade ? '<span class="badge badge-' + S.gradeClass(grade) + '">' +
                 esc(S.gradeLabel(grade)) + '</span>' : '') +
      '</div>' +
      '<div class="mp-stat-mean">' + esc(meaning) + '</div>' +
      '</div>';
  }

  /* ==================================================================
     RENDER
     ================================================================== */
  function render(st) {
    var name = get();
    var players = st.players;

    if (!name || !players.some(function (p) { return p.name === name; })) {
      return picker(players, name);
    }

    var p = players.filter(function (x) { return x.name === name; })[0];
    var prog = P10.Progress.compute(players, st);
    var dev = prog.devBy[p.name];
    var awards = Object.keys(prog.awards)
      .filter(function (k) { return prog.awards[k].player.name === p.name; })
      .map(function (k) {
        var cat = Pr.CATEGORIES.filter(function (c) { return c.key === k; })[0];
        return { name: cat ? cat.name : k, value: prog.awards[k].value };
      });

    var html = '';

    /* ---- header ---- */
    html += '<div class="mp-head">' +
      '<div class="mp-id">' +
        '<span class="mp-num">' + (p.num !== null && p.num !== undefined ? p.num : '–') + '</span>' +
        '<span>' +
          '<h2 class="mp-name">' + esc(p.name) + '</h2>' +
          '<div class="mp-role">' + esc(p.role) + '</div>' +
        '</span>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" id="changePlayer">Not your player?</button>' +
      '</div>';

    /* ---- the card ---- */
    html += '<div class="grid g-main mb-16">';
    html += '<div class="card"><div class="card-body"><div id="mpCard"></div></div></div>';

    /* ---- progress ---- */
    html += '<div class="stack gap-16">';

    if (dev && dev.score !== null) {
      var band = Pr.band(dev.score);
      var reasons = Pr.explain(dev);
      html += '<div class="card card-accent">' +
        '<div class="card-head"><div class="card-title">Progress</div>' +
        '<div class="card-note">Against his own earlier numbers</div></div>' +
        '<div class="card-body">' +
        '<div class="mp-dev">' +
          '<div class="mp-dev-score ' + band.cls + '">' + dev.score + '</div>' +
          '<div>' +
            '<div class="mp-dev-band ' + band.cls + '">' + esc(band.label) + '</div>' +
            '<div class="mp-dev-scale">50 means holding steady</div>' +
          '</div>' +
        '</div>' +
        '<div class="dev-bar mt-16"><span class="dev-fill ' + band.cls + '" style="width:' +
          Math.max(2, Math.min(100, dev.score)) + '%"></span><span class="dev-mid"></span></div>' +
        (reasons.length
          ? '<ul class="mp-reasons">' + reasons.map(function (r) {
              return '<li>' + esc(r) + '</li>';
            }).join('') + '</ul>'
          : '<div class="hint mt-8">Nothing has moved much either way in the last stretch.</div>') +
        '<div class="hint mt-8">This compares his recent games against his own season, not against ' +
        'his teammates. Improving is the thing being measured.</div>' +
        '</div></div>';
    } else if (dev) {
      html += '<div class="card"><div class="card-head"><div class="card-title">Progress</div></div>' +
        '<div class="card-body"><div class="hint">' + esc(dev.reason || 'Not enough data yet') +
        '. Progress needs a recent stat window alongside the season totals.</div></div></div>';
    }

    if (awards.length) {
      html += '<div class="card">' +
        '<div class="card-head"><div class="card-title">Team Awards</div></div>' +
        '<div class="card-body"><div class="row gap-8" style="flex-wrap:wrap">' +
        awards.map(function (a) {
          return '<span class="ach">' + esc(a.name) + ' &middot; ' + esc(a.value) + '</span>';
        }).join('') + '</div></div></div>';
    }

    html += '</div></div>';

    /* ---- what is going well ---- */
    var strengths = I.playerStrengths(p);
    if (strengths.length) {
      html += '<div class="card mb-16">' +
        '<div class="card-head"><div class="card-title">What He Does Well</div></div>' +
        '<div class="card-body"><div class="mp-strengths">' +
        strengths.map(function (x) {
          return '<div class="mp-strength">' + esc(x) + '</div>';
        }).join('') + '</div></div></div>';
    }

    /* ---- the numbers, explained ---- */
    var b = p.bat || {};
    var blocks = [];
    if (b.ops > 0 || b.pa > 0) {
      if (b.qab) blocks.push(statBlock(MEANING.qab[0], Math.round(b.qab * 100) + '%',
        MEANING.qab[1], S.grade('batting', 'qab', b.qab)));
      blocks.push(statBlock(MEANING.obp[0], S.rate(b.obp), MEANING.obp[1],
        S.grade('batting', 'obp', b.obp)));
      blocks.push(statBlock(MEANING.avg[0], S.rate(b.avg), MEANING.avg[1],
        S.grade('batting', 'avg', b.avg)));
      if (b.kRate) blocks.push(statBlock(MEANING.kRate[0], Math.round(b.kRate * 100) + '%',
        MEANING.kRate[1], S.grade('batting', 'kRate', b.kRate)));
    }
    if (p.pit && p.pit.ip > 0) {
      if (p.pit.strike) blocks.push(statBlock(MEANING.strike[0],
        Math.round(p.pit.strike * 100) + '%', MEANING.strike[1],
        S.grade('pitching', 'strike', p.pit.strike)));
      blocks.push(statBlock(MEANING.era[0], S.fixed(p.pit.era, 2), MEANING.era[1],
        S.grade('pitching', 'era', p.pit.era)));
    }
    if (p.fld && p.fld.tc > 0 && p.fld.fpct) {
      blocks.push(statBlock(MEANING.fpct[0], S.rate(p.fld.fpct), MEANING.fpct[1],
        S.grade('fielding', 'fpct', p.fld.fpct)));
    }

    if (blocks.length) {
      html += '<div class="card mb-16">' +
        '<div class="card-head"><div class="card-title">His Numbers</div>' +
        '<div class="card-note">' + esc(S.WINDOW_LABELS[st.viewWindow]) + '</div></div>' +
        '<div class="card-body"><div class="mp-stats">' + blocks.join('') + '</div>' +
        '<div class="hint mt-16">Grades compare him to competitive 10U travel ball, not to his ' +
        'teammates.</div>' +
        '</div></div>';
    }

    /* ---- coach-only: what to work on ---- */
    if (st.coach) {
      var issues = I.playerIssues(p);
      if (issues.length) {
        html += '<div class="card mb-16">' +
          '<div class="card-head"><div class="card-title">Work On This</div>' +
          '<div class="card-note">Coach view</div></div>' +
          '<div class="card-body">' +
          issues.slice(0, 3).map(function (is) {
            return '<div class="issue sev-' + (is.severity >= 3 ? 'high' : is.severity === 2 ? 'med' : 'low') + '">' +
              '<div class="issue-tag">' + esc((is.area || '').slice(0, 3)) + '</div>' +
              '<div class="grow"><div class="issue-t">' + esc(is.title) + '</div>' +
              '<div class="issue-d">' + esc(is.detail) + '</div></div></div>';
          }).join('') +
          '</div></div>';

        var drills = P10.drillsFor(issues.map(function (x) { return x.key; }), 2);
        if (drills.length) {
          html += '<div class="card mb-16">' +
            '<div class="card-head"><div class="card-title">Drills That Fix It</div>' +
            '<div class="card-note">Coach view</div></div>' +
            '<div class="card-body">' + drills.map(P10.Views.drillCard).join('') + '</div></div>';
        }
      }
    } else {
      html += '<div class="mp-coachnote">Your coach can see development notes and drills for ' +
        esc(p.short || p.name) + ' here. Ask him what to work on between games - that conversation ' +
        'goes better in person than on a screen.</div>';
    }

    return html;
  }

  /* ==================================================================
     PICKER
     ================================================================== */
  function picker(players, current) {
    return '<div class="mp-picker">' +
      '<div class="mp-picker-head">' +
        '<h2>Who are you here for?</h2>' +
        '<p>Pick your player and this becomes their page. It is remembered on this ' +
        'device, so you land here next time.</p>' +
      '</div>' +
      '<div class="grid g-cards">' +
      players.map(function (p) {
        return '<button class="pickcard' + (p.name === current ? ' on' : '') +
          '" data-pick-mine="' + esc(p.name) + '">' +
          '<span class="pickcard-num">' + (p.num !== null && p.num !== undefined ? p.num : '–') + '</span>' +
          '<span class="pickcard-name">' + esc(p.name) + '</span>' +
          (p.position ? '<span class="pickcard-pos">' + esc(p.position) + '</span>' : '') +
          '</button>';
      }).join('') +
      '</div></div>';
  }

  return {
    get: get,
    set: set,
    render: render,
    picker: picker
  };
})();
