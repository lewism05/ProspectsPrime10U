/* ==========================================================================
   PROSPECTS PRIME 10U — MATCHUP REPORT + GAME LOG UI
   The coach-facing scouting view for a rematch, and the form that feeds it.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Matchup = (function () {
  'use strict';

  var S = P10.Stats;
  var G = P10.GameLog;
  var L = P10.Lineup;
  var C = P10.CONFIG;
  function esc(s) { return P10.Views.esc(s); }

  function fmtDate(d) {
    var dt = P10.Schedule.parseDate(d);
    if (!dt) return esc(d || '');
    return P10.Schedule.MONTHS[dt.getMonth()] + ' ' + dt.getDate();
  }

  function resultChip(g) {
    if (g.us === null || g.them === null) return '<span class="rslt tie">Not scored</span>';
    var cls = g.us > g.them ? 'win' : g.us < g.them ? 'loss' : 'tie';
    var tag = g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T';
    return '<span class="rslt ' + cls + '">' + tag + ' ' + g.us + '&ndash;' + g.them + '</span>';
  }

  /* ==================================================================
     THE REPORT
     ================================================================== */
  function render(game, st, scenario) {
    var rep = G.matchupReport(game, st.players, scenario);

    if (!rep) {
      return '<div class="mu-none">' +
        '<strong>First time against ' + esc(game.opponent || 'this opponent') + '.</strong> ' +
        'No history logged yet, so there is nothing to scout. Log this one afterwards and ' +
        'the next meeting opens with the full picture.' +
        '</div>';
    }

    var h = rep.h2h;
    var html = '<div class="mu">';

    /* ---- header: the record ---- */
    html += '<div class="mu-head">' +
      '<div class="mu-rec">' +
        '<div class="mu-rec-v">' + h.w + '&ndash;' + h.l + (h.t ? '&ndash;' + h.t : '') + '</div>' +
        '<div class="mu-rec-l">All-Time</div>' +
      '</div>' +
      (h.scoredGames ? '<div class="mu-rec">' +
        '<div class="mu-rec-v ' + (h.diff > 0 ? 'good' : h.diff < 0 ? 'bad' : '') + '">' +
          (h.diff > 0 ? '+' : '') + h.diff + '</div>' +
        '<div class="mu-rec-l">Run Diff</div>' +
      '</div>' : '') +
      (h.avgFor !== null ? '<div class="mu-rec">' +
        '<div class="mu-rec-v">' + S.fixed(h.avgFor, 1) + '</div>' +
        '<div class="mu-rec-l">Runs / G</div>' +
      '</div>' : '') +
      (h.avgAgainst !== null ? '<div class="mu-rec">' +
        '<div class="mu-rec-v">' + S.fixed(h.avgAgainst, 1) + '</div>' +
        '<div class="mu-rec-l">Allowed / G</div>' +
      '</div>' : '') +
      '<div class="mu-hist">' +
        h.games.slice(0, 6).map(function (g) {
          return '<span class="mu-hist-g" title="' + esc(g.date) + '">' +
            '<span class="d">' + fmtDate(g.date) + '</span>' + resultChip(g) + '</span>';
        }).join('') +
      '</div>' +
    '</div>';

    /* ---- last meeting ---- */
    if (rep.last) {
      var lg = rep.last;
      html += '<div class="mu-sec"><div class="mu-sec-h">Last Meeting &middot; ' + fmtDate(lg.date) +
        ' &middot; ' + (lg.away ? 'Away' : 'Home') + '</div>';

      html += '<div class="mu-grid">';

      /* lineup we ran */
      html += '<div class="mu-block"><div class="mu-block-h">Order We Ran</div>';
      if (lg.lineup && lg.lineup.length) {
        html += '<ol class="mu-order">' + lg.lineup.map(function (nm) {
          return '<li>' + esc(nm) + '</li>';
        }).join('') + '</ol>';
      } else {
        html += '<div class="mu-empty">No lineup recorded for that game.</div>';
      }
      html += '</div>';

      /* arms we used */
      html += '<div class="mu-block"><div class="mu-block-h">Arms We Used</div>';
      if (rep.arms.length) {
        html += '<table class="mu-tbl"><thead><tr>' +
          '<th>Pitcher</th><th>App</th><th>IP</th><th>R</th><th>BB</th><th>K</th><th>#P</th>' +
          '</tr></thead><tbody>' +
          rep.arms.map(function (a) {
            return '<tr><td>' + esc(a.name) + '</td>' +
              '<td>' + a.outings + '</td>' +
              '<td>' + S.ipText(a.ip) + '</td>' +
              '<td>' + a.r + '</td><td>' + a.bb + '</td><td>' + a.k + '</td>' +
              '<td>' + (a.pitches || '&mdash;') + '</td></tr>';
          }).join('') +
          '</tbody></table>';
      } else {
        html += '<div class="mu-empty">No pitchers recorded against them.</div>';
      }
      html += '</div>';

      html += '</div>';

      if (lg.notes) {
        html += '<div class="mu-notes"><b>Note from that game</b>' + esc(lg.notes) + '</div>';
      }
      html += '</div>';
    }

    /* ---- what changed since ---- */
    if (rep.form.length) {
      html += '<div class="mu-sec"><div class="mu-sec-h">Who Has Moved Since</div>' +
        '<div class="mu-form">' +
        rep.form.slice(0, 6).map(function (f) {
          var up = f.delta > 0;
          return '<div class="mu-form-row">' +
            '<span class="n">' + esc(f.player.name) + '</span>' +
            '<span class="m ' + (up ? 'good' : 'bad') + '">' + (up ? '&#9650;' : '&#9660;') + ' ' +
              S.rate(Math.abs(f.delta)) + ' OPS</span>' +
            '<span class="s">' + S.rate(f.player.batSeason.ops) + ' &rarr; ' +
              S.rate(f.player.batL4.ops) + '</span>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<div class="mu-fine">Season baseline against the last four games. Anyone who has ' +
        'moved less than 80 points of OPS is left out.</div>' +
        '</div>';
    }

    /* ---- suggested changes ---- */
    var d = rep.diff;
    if (d.rows.length) {
      var moved = d.rows.filter(function (r) { return r.move !== null && r.move !== 0; });
      var added = d.rows.filter(function (r) { return r.isNew; });

      html += '<div class="mu-sec"><div class="mu-sec-h">Suggested Order &middot; Changes From Last Time</div>';
      html += '<div class="mu-lineup">' +
        d.rows.map(function (r) {
          var badge = '';
          if (r.isNew && d.hadLineup) badge = '<span class="mv new">New</span>';
          else if (r.move > 0) badge = '<span class="mv up">&#9650; ' + r.move + '</span>';
          else if (r.move < 0) badge = '<span class="mv dn">&#9660; ' + Math.abs(r.move) + '</span>';
          else if (r.was) badge = '<span class="mv same">&ndash;</span>';

          return '<div class="mu-slot">' +
            '<span class="sn">' + r.slot + '</span>' +
            '<span class="sm"><span class="nm">' + esc(r.player.name) + '</span>' +
              '<span class="wy">' + esc(r.why) + '</span></span>' +
            badge +
            '<span class="slot-grade grade-' + r.grade + '">' + r.grade + '</span>' +
            '</div>';
        }).join('') +
        '</div>';

      if (d.hadLineup) {
        var bits = [];
        if (moved.length) bits.push(moved.length + ' player' + (moved.length > 1 ? 's move' : ' moves'));
        if (added.length) bits.push(added.length + ' new to the order');
        if (d.dropped.length) bits.push(d.dropped.length + ' dropped out');
        html += '<div class="mu-fine">' + (bits.length ? bits.join(', ') + ' versus the order you ran last time.'
          : 'Same order the engine would have run last time.') +
          (d.dropped.length ? ' Out: ' + d.dropped.map(function (p) { return esc(p.name); }).join(', ') + '.' : '') +
          '</div>';
      }
      html += '</div>';
    }

    /* ---- arm availability ---- */
    if (rep.rested.length) {
      html += '<div class="mu-sec"><div class="mu-sec-h">Arm Availability</div>' +
        '<div class="mu-arms">' +
        rep.rested.map(function (r) {
          var label = r.status === 'unknown' ? 'No outing logged'
            : r.available ? (r.daysRest + ' days rest')
            : ('Needs ' + r.required + ', has ' + r.daysRest);
          return '<div class="mu-arm ' + (r.available ? 'ok' : 'no') + '">' +
            '<span class="an">' + esc(r.player.name) + '</span>' +
            '<span class="al">' + esc(label) +
              (r.lastPitches ? ' &middot; ' + r.lastPitches + 'P ' + fmtDate(r.lastDate) : '') +
            '</span>' +
            '<span class="ab">' + (r.available ? 'Available' : 'Resting') + '</span>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<div class="mu-fine">Rest is computed from logged pitch counts against USA Baseball\'s ' +
        '9&ndash;10 table. A pitcher with no logged outing shows as available because we have no ' +
        'record, not because we know he is fresh.</div>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ==================================================================
     GAME LOG EDITOR (Manage tab)
     ================================================================== */
  function renderLog(st) {
    var games = G.all();

    var html = '<div class="card mb-16">' +
      '<div class="card-head"><div class="card-title">Game Log</div>' +
      '<button class="btn btn-sm btn-primary" id="addGame">Log A Game</button></div>' +
      '<div class="card-body">' +
      '<div class="hint mb-16">This is the only thing the app cannot get from a GameChanger export. ' +
      'Exports have no per-opponent splits, so logging each game once is what makes head-to-head ' +
      'history, arm usage against a club, and rematch planning possible. Takes about a minute.</div>';

    if (!games.length) {
      html += '<div class="msg msg-info">No games logged yet. The Matchup report on the Schedule tab ' +
        'turns on as soon as you have played an opponent once.</div>';
    } else {
      html += '<div class="table-scroll"><table class="stat" style="min-width:560px">' +
        '<thead><tr><th class="stick">Date</th><th style="text-align:left">Opponent</th>' +
        '<th>Result</th><th>Order</th><th>Arms</th><th></th></tr></thead><tbody>' +
        games.map(function (g) {
          return '<tr><td class="stick">' + fmtDate(g.date) + '</td>' +
            '<td style="text-align:left">' + (g.away ? '@ ' : 'vs ') + esc(g.opponent || '—') + '</td>' +
            '<td>' + resultChip(g) + '</td>' +
            '<td>' + ((g.lineup || []).length || '—') + '</td>' +
            '<td>' + ((g.pitchers || []).length || '—') + '</td>' +
            '<td style="text-align:right"><button class="btn btn-sm btn-ghost" data-edit-game="' +
              esc(g.id) + '">Edit</button></td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    html += '</div></div>';
    return html;
  }

  /* The add/edit form, rendered into the modal. */
  function editorHtml(game, st) {
    var players = st.players;
    var known = G.opponents();

    return '<div class="field"><label>Date</label>' +
      '<input class="input" type="date" id="gDate" value="' + esc(game.date) + '"></div>' +

      '<div class="field"><label>Opponent</label>' +
      '<input class="input" id="gOpp" list="gOppList" placeholder="Team name" value="' + esc(game.opponent) + '">' +
      '<datalist id="gOppList">' + known.map(function (o) {
        return '<option value="' + esc(o) + '">';
      }).join('') + '</datalist>' +
      '<div class="hint">Spelling does not have to match exactly. "AR Bombers 10U" and "Bombers" ' +
      'are treated as the same club.</div></div>' +

      '<div class="row gap-12" style="align-items:flex-end">' +
        '<div class="field grow" style="margin:0"><label>Home / Away</label>' +
          '<div class="seg" id="gSide">' +
            '<button class="seg-btn' + (!game.away ? ' active' : '') + '" data-side="home">Home</button>' +
            '<button class="seg-btn' + (game.away ? ' active' : '') + '" data-side="away">Away</button>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin:0;width:88px"><label>Us</label>' +
          '<input class="input" type="number" min="0" id="gUs" value="' + (game.us === null ? '' : game.us) + '"></div>' +
        '<div class="field" style="margin:0;width:88px"><label>Them</label>' +
          '<input class="input" type="number" min="0" id="gThem" value="' + (game.them === null ? '' : game.them) + '"></div>' +
      '</div>' +

      '<div class="field mt-16"><label>Batting Order</label>' +
      '<div class="hint mb-8">Tap in order. Tap again to remove.</div>' +
      '<div class="pickgrid" id="gLineup">' +
        players.map(function (p) {
          var idx = (game.lineup || []).indexOf(p.name);
          return '<button class="pick' + (idx >= 0 ? ' on' : '') + '" data-pick-name="' + esc(p.name) + '">' +
            (idx >= 0 ? '<span class="pk-n">' + (idx + 1) + '</span>' : '') +
            esc(p.short || p.name) + '</button>';
        }).join('') +
      '</div></div>' +

      '<div class="field mt-16"><label>Pitchers Used</label>' +
      '<div class="hint mb-8">Pitch count is what drives the rest calculator, so it is worth filling in.</div>' +
      '<div id="gPitchers">' + pitcherRows(game, players) + '</div>' +
      '<button class="btn btn-sm btn-ghost mt-8" id="gAddPitcher">Add Pitcher</button></div>' +

      '<div class="field mt-16"><label>Notes</label>' +
      '<textarea class="input" id="gNotes" placeholder="What you want to remember next time you see them">' +
      esc(game.notes || '') + '</textarea></div>';
  }

  function pitcherRows(game, players) {
    var rows = (game.pitchers && game.pitchers.length) ? game.pitchers : [];
    if (!rows.length) rows = [{ name: '', ip: '', r: '', bb: '', k: '', pitches: '' }];
    return rows.map(function (pt, i) { return pitcherRow(pt, i, players); }).join('');
  }

  function pitcherRow(pt, i, players) {
    return '<div class="prow" data-prow="' + i + '">' +
      '<select class="input pname">' +
        '<option value="">Pitcher…</option>' +
        players.map(function (p) {
          return '<option value="' + esc(p.name) + '"' + (pt.name === p.name ? ' selected' : '') + '>' +
            esc(p.name) + '</option>';
        }).join('') +
      '</select>' +
      '<input class="input pip"  type="number" step="0.1" min="0" placeholder="IP"  value="' + esc(pt.ip || '') + '">' +
      '<input class="input pr"   type="number" min="0" placeholder="R"  value="' + esc(pt.r || '') + '">' +
      '<input class="input pbb"  type="number" min="0" placeholder="BB" value="' + esc(pt.bb || '') + '">' +
      '<input class="input pk"   type="number" min="0" placeholder="K"  value="' + esc(pt.k || '') + '">' +
      '<input class="input ppit" type="number" min="0" placeholder="#P" value="' + esc(pt.pitches || '') + '">' +
      '<button class="icon-btn" data-drop-pitcher="' + i + '" title="Remove">&times;</button>' +
      '</div>';
  }

  return {
    render: render,
    renderLog: renderLog,
    editorHtml: editorHtml,
    pitcherRow: pitcherRow,
    pitcherRows: pitcherRows,
    fmtDate: fmtDate,
    resultChip: resultChip
  };
})();
