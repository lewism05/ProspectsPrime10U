/* ==========================================================================
   PROSPECTS PRIME 10U — APP
   Boot, routing, event delegation. Everything the user touches lands here.
   ========================================================================== */
(function () {
  'use strict';

  var C = P10.CONFIG;
  var Store = P10.Store;
  var V = P10.Views;
  var S = P10.Stats;
  var Sch = P10.Schedule;

  function $(id) { return document.getElementById(id); }

  var currentTab = 'dashboard';
  var pendingFiles = [];

  /* ==================================================================
     ROUTING
     ================================================================== */
  var TABS = ['dashboard', 'roster', 'batting', 'pitching', 'defense', 'schedule', 'development', 'lineup', 'manage'];

  function goTab(tab, opts) {
    if (TABS.indexOf(tab) < 0) tab = 'dashboard';
    currentTab = tab;

    document.querySelectorAll('.navtab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + tab);
    });

    // The stat-window toggle only makes sense on stat pages
    var showWindow = ['dashboard', 'roster', 'batting', 'pitching', 'development'].indexOf(tab) >= 0;
    $('windowBar').classList.toggle('hidden', !showWindow);

    closeNav();
    renderTab(tab);

    if (!opts || !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!opts || !opts.noHash) {
      try { history.replaceState(null, '', '#' + tab); } catch (e) {}
    }
  }

  function renderTab(tab) {
    var st = Store.state;
    P10.Charts.destroyAll();

    switch (tab) {
      case 'dashboard':   V.renderDashboard(st); break;
      case 'roster':      V.renderRoster(st); break;
      case 'batting':     V.renderBatting(st); break;
      case 'pitching':    V.renderPitching(st); break;
      case 'defense':     V.renderDefense(st); break;
      case 'schedule':    V.renderSchedule(st); break;
      case 'development': V.renderDevelopment(st); break;
      case 'lineup':      V.renderLineup(st); break;
      case 'manage':      V.renderManage(st); wireUpload(); break;
    }
  }

  function renderAll() {
    var st = Store.state;
    var bh = $('sampleHost');
    if (bh) bh.innerHTML = V.sampleBanner(st);
    V.renderHero(st);
    V.renderStatbar(st);
    renderTab(currentTab);
    updateStatusPill();
    updateCoachUi();
    updateWindowAvailability();
  }

  /* ==================================================================
     STATUS PILL
     ================================================================== */
  function updateStatusPill() {
    var st = Store.state;
    var dot = $('liveDot'), lab = $('liveLabel');
    if (!st.meta.updatedAt) {
      dot.className = 'live-dot off';
      lab.textContent = 'No data';
      $('footMeta').textContent = 'Awaiting first stat upload';
      return;
    }
    if (Store.isSample()) {
      dot.className = 'live-dot stale';
      lab.textContent = 'Sample data';
      $('livePill').title = 'These are test numbers, not real stats. Clear them from Manage.';
      $('footMeta').textContent = 'Showing sample data — not real stats';
      return;
    }
    var age = Date.now() - new Date(st.meta.updatedAt).getTime();
    var days = age / 86400000;
    dot.className = 'live-dot' + (days > 10 ? ' stale' : '');
    lab.textContent = V.timeAgo(st.meta.updatedAt);
    $('livePill').title = 'Data status - click to refresh';
    $('footMeta').textContent = 'Stats updated ' + V.timeAgo(st.meta.updatedAt);
  }

  /* Coach-only tabs stay visible for everyone and show a padlock. Hiding them
     outright makes parents think the app is broken when a coach mentions a
     feature they cannot see. */
  function updateCoachUi() {
    var on = Store.state.coach;
    $('coachChip').classList.toggle('hidden', !on);
    document.querySelectorAll('.coach-only .lock').forEach(function (el) {
      el.classList.toggle('hidden', on);
    });
  }

  /* Grey out stat windows that have no data behind them */
  function updateWindowAvailability() {
    var avail = Store.state.available || [];
    document.querySelectorAll('#windowSeg .seg-btn').forEach(function (b) {
      var w = b.dataset.window;
      var has = w === 'season' || avail.indexOf(w) >= 0;
      b.disabled = !has;
      b.title = has ? '' : 'No data loaded for this window';
    });
    var note = $('windowNote');
    var missing = ['last_8', 'last_4'].filter(function (w) { return avail.indexOf(w) < 0; });
    note.innerHTML = missing.length && Store.state.meta.updatedAt
      ? '<span class="hint">Upload "last 8" / "last 4" exports to enable the other windows</span>'
      : '';
  }

  /* ==================================================================
     NAV
     ================================================================== */
  function closeNav() {
    $('subnav').classList.remove('open');
    $('navToggle').classList.remove('open');
    $('navToggle').setAttribute('aria-expanded', 'false');
  }

  $('navToggle').addEventListener('click', function () {
    var open = $('subnav').classList.toggle('open');
    this.classList.toggle('open', open);
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  $('brandHome').addEventListener('click', function (e) { e.preventDefault(); goTab('dashboard'); });

  /* ==================================================================
     GLOBAL EVENT DELEGATION
     ================================================================== */
  document.addEventListener('click', function (e) {
    var t = e.target;

    /* --- nav tabs --- */
    var tab = t.closest('.navtab');
    if (tab) { goTab(tab.dataset.tab); return; }

    /* --- goto buttons --- */
    var goto = t.closest('[data-goto]');
    if (goto) { goTab(goto.dataset.goto); return; }

    /* --- stat window --- */
    var win = t.closest('#windowSeg .seg-btn');
    if (win && !win.disabled) {
      document.querySelectorAll('#windowSeg .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      win.classList.add('active');
      Store.setWindow(win.dataset.window);
      return;
    }

    /* --- leaderboard metric --- */
    var lm = t.closest('#leaderSeg .seg-btn');
    if (lm) {
      V.setLeaderMetric(lm.dataset.leader);
      V.renderDashboard(Store.state);
      return;
    }

    /* --- roster sort --- */
    var rs = t.closest('#rosterSort .seg-btn');
    if (rs) {
      document.querySelectorAll('#rosterSort .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      rs.classList.add('active');
      V.setRosterSort(rs.dataset.sort);
      V.renderRoster(Store.state);
      return;
    }

    /* --- lineup scenario --- */
    var sc = t.closest('#scenarioSeg .seg-btn');
    if (sc) { V.setLineupScenario(sc.dataset.scenario); V.renderLineup(Store.state); return; }

    /* --- opponent strength (schedule) --- */
    var strBtn = t.closest('[data-strength]');
    if (strBtn) {
      var wrap = strBtn.closest('[data-strength-game]');
      if (wrap) {
        Sch.setStrength(wrap.dataset.strengthGame, strBtn.dataset.strength);
        V.renderSchedule(Store.state);
        // keep the game expanded
        var card = document.querySelector('[data-game="' + wrap.dataset.strengthGame + '"]');
        if (card) card.classList.add('open');
        return;
      }
    }

    /* --- speed tags --- */
    var spdBtn = t.closest('[data-speed]');
    if (spdBtn) {
      var sWrap = spdBtn.closest('[data-speed-player]');
      if (sWrap) {
        if (!Store.state.gameState.speeds) Store.state.gameState.speeds = {};
        Store.state.gameState.speeds[sWrap.dataset.speedPlayer] = spdBtn.dataset.speed;
        Store.saveGameState();
        V.renderLineup(Store.state);
        return;
      }
    }

    /* --- table sort --- */
    var th = t.closest('th.sortable');
    if (th && th.dataset.table) {
      V.sortTable(th.dataset.table, th.dataset.key);
      renderTab(currentTab);
      return;
    }

    /* --- game card expand --- */
    var gh = t.closest('.game-head');
    if (gh) { gh.closest('.game').classList.toggle('open'); return; }

    /* --- lineup slot swap --- */
    var swap = t.closest('[data-swap-slot]');
    if (swap) { openSwapModal(parseInt(swap.dataset.swapSlot, 10)); return; }

    /* --- reset lineup --- */
    if (t.closest('#resetLineup')) {
      Store.state.lineups[V.getLineupScenario()] = null;
      Store.saveLineups();
      V.renderLineup(Store.state);
      return;
    }

    /* --- print lineup --- */
    if (t.closest('#printLineup')) { window.print(); return; }

    /* --- player open (last, so buttons above win) --- */
    var pl = t.closest('[data-player]');
    if (pl) { openDrawer(pl.dataset.player); return; }
  });

  /* ==================================================================
     PLAYER DRAWER
     ================================================================== */
  function openDrawer(name) {
    V.renderDrawer(name, Store.state);
    $('drawer').classList.add('open');
    $('drawerScrim').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    $('drawer').classList.remove('open');
    $('drawerScrim').classList.remove('open');
    document.body.style.overflow = '';
    P10.Charts.destroy('chartDrawerSpark');
  }
  $('drawerClose').addEventListener('click', closeDrawer);
  $('drawerScrim').addEventListener('click', closeDrawer);

  /* ==================================================================
     MODAL
     ================================================================== */
  function openModal(title, bodyHtml, footHtml) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalFoot').innerHTML = footHtml || '<button class="btn btn-ghost" data-close-modal>Close</button>';
    $('modalScrim').classList.add('open');
  }
  function closeModal() { $('modalScrim').classList.remove('open'); }

  $('modalClose').addEventListener('click', closeModal);
  $('modalScrim').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-modal]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); closeNav(); }

    /* Tiles are divs with role=button, so they need this to be operable
       from a keyboard the way a real button already would be. */
    if (e.key === 'Enter' || e.key === ' ') {
      var t = e.target.closest && e.target.closest('.tile-link');
      if (t) { e.preventDefault(); t.click(); }
    }
  });

  /* ==================================================================
     SETTINGS / COACH UNLOCK
     ================================================================== */
  function openSettings() {
    var st = Store.state;
    var body =
      '<div class="field">' +
        '<label>Access</label>' +
        (st.coach
          ? '<div class="msg msg-good">Coach mode is on. Lineup Builder and Manage are unlocked on this device.</div>' +
            '<button class="btn btn-ghost btn-block mt-8" id="lockCoach">Turn Coach Mode Off</button>'
          : '<input class="input" type="password" id="coachInput" placeholder="Coach passcode" autocomplete="off">' +
            '<div class="hint">Unlocks the lineup builder, matchup planning, playing-time analysis and stat uploads. ' +
            'Saved on this device only.</div>' +
            '<div id="coachMsg"></div>' +
            '<button class="btn btn-primary btn-block mt-8" id="unlockCoach">Unlock Coach Mode</button>') +
      '</div>' +
      '<div class="field mt-16">' +
        '<label>Data</label>' +
        '<div class="hint">' +
          'Stats last updated: <strong>' + (st.meta.updatedAt ? V.timeAgo(st.meta.updatedAt) : 'never') + '</strong><br>' +
          'Players with stats: <strong>' + (st.team ? st.team.withData : 0) + ' of ' + st.players.length + '</strong>' +
        '</div>' +
        '<button class="btn btn-ghost btn-block mt-8" id="refreshData">Check For New Stats</button>' +
      '</div>' +
      '<div class="field mt-16">' +
        '<label>About</label>' +
        '<div class="hint">' +
          esc(C.team.fullName) + ' · ' + esc(C.team.season) + ' season.<br>' +
          'Benchmarks are calibrated for competitive 10U travel ball. This page is informational - ' +
          'it is not a substitute for what a coach sees at the field.' +
        '</div>' +
      '</div>';

    openModal('Settings', body);
  }

  function esc(s) { return V.esc(s); }

  $('settingsBtn').addEventListener('click', openSettings);
  $('livePill').addEventListener('click', function () {
    var lab = $('liveLabel');
    lab.textContent = 'Checking…';
    Store.loadPublished().then(function (updated) {
      if (updated) { Store.recompute(); renderAll(); toast('New stats loaded', 'good'); }
      else { updateStatusPill(); toast('Already up to date', 'info'); }
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#unlockCoach')) {
      var val = ($('coachInput') || {}).value || '';
      if (val === C.coachCode) {
        Store.setCoach(true);
        closeModal();
        renderAll();
        toast('Coach mode unlocked', 'good');
      } else {
        var m = $('coachMsg');
        if (m) m.innerHTML = '<div class="msg msg-bad">That passcode did not match.</div>';
      }
      return;
    }
    if (e.target.closest('#lockCoach')) {
      Store.setCoach(false);
      closeModal();
      if (currentTab === 'lineup' || currentTab === 'manage') goTab('dashboard');
      else renderAll();
      return;
    }
    if (e.target.closest('#unlockFromLock')) { openSettings(); return; }
    if (e.target.closest('#refreshData')) {
      Store.loadPublished().then(function (u) {
        if (u) { Store.recompute(); renderAll(); }
        closeModal();
        toast(u ? 'New stats loaded' : 'Already up to date', u ? 'good' : 'info');
      });
      return;
    }
  });

  // Enter key in the coach field
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'coachInput') {
      var btn = $('unlockCoach');
      if (btn) btn.click();
    }
  });

  /* ==================================================================
     LINEUP SLOT SWAP
     ================================================================== */
  function openSwapModal(slotIdx) {
    var st = Store.state;
    var scenario = V.getLineupScenario();
    var card = P10.Lineup.resolve(st.players, scenario);
    var eligible = st.players.filter(function (p) { return p.bat && p.bat.ops > 0; });

    var body = '<div class="hint mb-16">Pick who bats in spot ' + (slotIdx + 1) + '. ' +
      'The letter grade is that player\'s fit for this specific spot.</div>' +
      '<div class="lead-list">' +
      eligible.map(function (p) {
        var sc = P10.Lineup.fitScore(p, slotIdx + 1, scenario);
        var g = P10.Lineup.grade(sc);
        var inCard = card.filter(function (s) { return s.player.name === p.name; })[0];
        return '<div class="lead-row" data-pick-player="' + esc(p.name) + '">' +
          '<span class="lead-rank">' + (p.num !== null ? p.num : '–') + '</span>' +
          '<span class="lead-name">' + esc(p.name) +
          (inCard ? ' <span class="text-dimmer">(now batting ' + inCard.slot + ')</span>' : '') + '</span>' +
          '<span class="slot-grade grade-' + g + '">' + g + '</span>' +
          '</div>';
      }).join('') + '</div>';

    openModal('Batting Spot ' + (slotIdx + 1), body,
      '<button class="btn btn-ghost" data-close-modal>Cancel</button>');

    $('modalBody').dataset.swapSlot = slotIdx;
  }

  document.addEventListener('click', function (e) {
    var pick = e.target.closest('[data-pick-player]');
    if (!pick) return;
    var slotIdx = parseInt($('modalBody').dataset.swapSlot, 10);
    if (isNaN(slotIdx)) return;

    var st = Store.state;
    var scenario = V.getLineupScenario();
    var card = P10.Lineup.resolve(st.players, scenario);

    // Materialize the current card into a name array, then swap
    var names = [];
    for (var i = 0; i < 9; i++) names[i] = card[i] ? card[i].player.name : null;

    var picked = pick.dataset.pickPlayer;
    var existing = names.indexOf(picked);
    if (existing >= 0) names[existing] = names[slotIdx];   // swap the two
    names[slotIdx] = picked;

    st.lineups[scenario] = names;
    Store.saveLineups();
    closeModal();
    V.renderLineup(st);
  });

  /* ==================================================================
     UPLOAD (coach / Manage tab)
     ================================================================== */
  function wireUpload() {
    var dz = $('dropzone'), input = $('fileInput');
    if (!dz || !input) return;

    pendingFiles = [];
    renderFileList();

    dz.addEventListener('click', function () { input.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('drag');
      addFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', function () { addFiles(this.files); this.value = ''; });

    var clear = $('clearFiles');
    if (clear) clear.addEventListener('click', function () { pendingFiles = []; renderFileList(); });

    var proc = $('processFiles');
    if (proc) proc.addEventListener('click', processPending);

    var exp = $('exportData');
    if (exp) exp.addEventListener('click', function () { Store.download(); toast('Backup downloaded', 'good'); });

    var imp = $('importData');
    if (imp) imp.addEventListener('click', importBackup);

    var pub = $('publishData');
    if (pub) pub.addEventListener('click', publish);

    var smp = $('loadSample');
    if (smp) smp.addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Loading…';
      Store.loadSample().then(function (n) {
        renderAll();
        toast('Sample data loaded (' + n + ' stat sets)', 'good');
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = 'Load Sample Data';
        toast(e.message || 'Sample data could not load', 'bad');
      });
    });

    var clr = $('clearData');
    if (clr) clr.addEventListener('click', function () {
      openModal('Clear all data?',
        '<div class="msg msg-bad">This wipes every stat loaded on this device. ' +
        'The published file on the site is not affected - a refresh will pull it back.</div>',
        '<button class="btn btn-ghost" data-close-modal>Cancel</button>' +
        '<button class="btn btn-danger" id="confirmClear">Clear Everything</button>');
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#clearSample')) {
      Store.clearData();
      renderAll();
      toast('Sample data cleared', 'info');
      return;
    }
    if (e.target.closest('#confirmClear')) {
      Store.clearData();
      closeModal();
      renderAll();
      toast('Data cleared', 'info');
    }
  });

  function addFiles(fileList) {
    Array.prototype.forEach.call(fileList, function (f) {
      if (!/\.csv$/i.test(f.name)) return;
      if (pendingFiles.some(function (p) { return p.file.name === f.name && p.file.size === f.size; })) return;
      var guess = P10.CSV.categorize(f.name);
      pendingFiles.push({ file: f, category: guess.category, window: guess.window });
    });
    renderFileList();
  }

  function renderFileList() {
    var el = $('fileList');
    if (!el) return;

    if (!pendingFiles.length) {
      el.innerHTML = '';
      var b = $('processFiles');
      if (b) b.disabled = true;
      return;
    }

    var CATS = ['auto', 'batting', 'pitching', 'fielding', 'catching'];
    var WINS = ['season', 'last_13', 'last_10', 'last_8', 'last_5', 'last_4', 'last_3', 'last_2', 'last_game'];

    el.innerHTML = pendingFiles.map(function (p, i) {
      return '<div class="file-row">' +
        '<span class="fname">' + esc(p.file.name) + '</span>' +
        '<select class="input" data-file-cat="' + i + '">' +
          CATS.map(function (c) {
            return '<option value="' + c + '"' + (p.category === c ? ' selected' : '') + '>' +
              (c === 'auto' ? 'Auto-detect' : c.charAt(0).toUpperCase() + c.slice(1)) + '</option>';
          }).join('') +
        '</select>' +
        '<select class="input" data-file-win="' + i + '">' +
          WINS.map(function (w) {
            return '<option value="' + w + '"' + (p.window === w ? ' selected' : '') + '>' +
              esc(S.WINDOW_LABELS[w] || w) + '</option>';
          }).join('') +
        '</select>' +
        '<button class="icon-btn" data-file-remove="' + i + '" title="Remove">×</button>' +
        '</div>';
    }).join('');

    var btn = $('processFiles');
    if (btn) btn.disabled = false;
  }

  document.addEventListener('change', function (e) {
    var c = e.target.dataset.fileCat, w = e.target.dataset.fileWin;
    if (c !== undefined) pendingFiles[+c].category = e.target.value;
    if (w !== undefined) pendingFiles[+w].window = e.target.value;
  });
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-file-remove]');
    if (rm) { pendingFiles.splice(+rm.dataset.fileRemove, 1); renderFileList(); }
  });

  function processPending() {
    if (!pendingFiles.length) return;
    var msg = $('uploadMsg');
    msg.innerHTML = '<div class="msg msg-info">Reading ' + pendingFiles.length + ' file' + (pendingFiles.length > 1 ? 's' : '') + '…</div>';

    Promise.all(pendingFiles.map(function (p) {
      return new Promise(function (resolve) {
        var r = new FileReader();
        r.onload = function () { resolve({ name: p.file.name, text: r.result, category: p.category, window: p.window }); };
        r.onerror = function () { resolve(null); };
        r.readAsText(p.file);
      });
    })).then(function (results) {
      var good = results.filter(Boolean);
      var added = Store.ingest(good);
      if (added) {
        pendingFiles = [];
        renderAll();
        toast('Dashboard updated from ' + good.length + ' file' + (good.length > 1 ? 's' : ''), 'good');

        /* An upload that only changed this browser is the bug, not the
           feature. Push it out so every device has it. */
        /* renderAll() rebuilds the Manage tab, so the element captured
           before it is detached and writing to it does nothing. Look the
           status box up fresh every time. */
        function status(html) {
          var el = $('publishState') || $('uploadMsg');
          if (el) el.innerHTML = html;
        }

        Store.probePublish().then(function (st) {
          if (!st.configured) {
            status('<div class="msg msg-warn"><strong>Saved on this device only.</strong> ' +
              'Publishing is not set up, so nobody else will see these' +
              (st.missing && st.missing.length ? ' - set ' + esc(st.missing.join(', ')) + ' in Netlify' : '') +
              '.</div>');
            return;
          }
          status('<div class="msg msg-info">Publishing to every device…</div>');
          Store.publish({ note: good.length + ' file(s)' }).then(function (res) {
            renderAll();
            status('<div class="msg msg-good"><strong>Published.</strong> ' + esc(res.message) + '</div>');
            toast('Published to every device', 'good');
          }).catch(function (err) {
            status('<div class="msg msg-bad">Stats are updated here, but publishing failed: ' +
              esc(err.message) + ' Use Publish For Everyone to try again.</div>');
          });
        });
      } else {
        msg.innerHTML = '<div class="msg msg-bad">Could not read any player rows. ' +
          'Make sure these are CSV exports with a player name column.</div>';
      }
    });
  }

  function importBackup() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          Store.importBundle(JSON.parse(r.result));
          renderAll();
          toast('Backup imported', 'good');
        } catch (err) {
          toast('That file could not be read', 'bad');
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  function publish() {
    var btn = $('publishData');
    Store.probePublish().then(function (st) {
      if (!st.configured) {
        openModal('Publishing is not set up',
          '<div class="msg msg-warn">This site cannot publish yet' +
          (st.missing && st.missing.length
            ? ', because ' + esc(st.missing.join(' and ')) + ' ' +
              (st.missing.length > 1 ? 'are' : 'is') + ' not set in Netlify.'
            : '.') + '</div>' +
          '<div class="hint mt-16">Until then, stats only exist on the device that uploaded them. ' +
          'Set those variables in Netlify, redeploy, and this button pushes to everyone.</div>');
        return;
      }

      if (Store.isSample()) {
        openModal('Publish sample data?',
          '<div class="msg msg-bad"><strong>These are made-up numbers.</strong> ' +
          'Publishing puts them on every family\'s phone as if they were real.</div>' +
          '<div class="hint mt-16">Fine for testing that the pipeline works. Not fine to leave up. ' +
          'Upload real stats afterwards and publish again to replace them.</div>',
          '<button class="btn btn-ghost" data-close-modal>Cancel</button>' +
          '<button class="btn btn-danger" id="confirmPublishSample">Publish Anyway</button>');
        return;
      }

      doPublish(btn);
    });
  }

  function doPublish(btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    Store.publish({ note: 'manual' }).then(function (res) {
      closeModal();
      openModal('Published',
        '<div class="msg msg-good"><strong>' + esc(res.message) + '</strong></div>' +
        '<div class="hint mt-16">Netlify rebuilds on the commit. Anyone with the site open ' +
        'picks it up next time they load it or switch back to the tab.</div>');
      renderAll();
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish For Everyone'; }
      closeModal();
      openModal('Could not publish', '<div class="msg msg-bad">' + esc(err.message) + '</div>');
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#confirmPublishSample')) { doPublish($('publishData')); }
  });

  /* ==================================================================
     TOAST
     ================================================================== */
  var toastTimer = null;
  function toast(text, kind) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);' +
        'z-index:200;padding:11px 18px;border-radius:999px;font-size:13px;font-weight:600;' +
        'border:1px solid var(--line-strong);background:var(--surface-3);color:var(--text);' +
        'box-shadow:var(--sh-3);opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;max-width:90vw;text-align:center';
      document.body.appendChild(el);
    }
    var colors = {
      good: ['rgba(61,220,145,.4)', 'var(--good)'],
      bad: ['rgba(255,107,107,.4)', 'var(--bad)'],
      info: ['var(--line-strong)', 'var(--text)']
    };
    var c = colors[kind] || colors.info;
    el.style.borderColor = c[0];
    el.style.color = c[1];
    el.textContent = text;
    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2600);
  }

  /* ==================================================================
     BOOT
     ================================================================== */
  Store.subscribe(function (st, reason) {
    if (reason === 'window' || reason === 'ingest' || reason === 'import' ||
        reason === 'clear' || reason === 'published' || reason === 'sample' ||
        reason === 'games') {
      renderAll();
    }
  });

  // Team photo manifest first, so cards paint with the right image on the
  // very first render rather than popping in a beat later.
  P10.Cards.loadManifest().then(function () { renderAll(); });

  Store.init();

  // Restore the tab from the URL hash
  var hash = (location.hash || '').replace('#', '');
  if (TABS.indexOf(hash) >= 0) currentTab = hash;

  // Sync the window toggle to the saved preference
  document.querySelectorAll('#windowSeg .seg-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.window === Store.state.viewWindow);
  });

  renderAll();
  goTab(currentTab, { noScroll: true });

  // Weather in the background - the schedule and dashboard re-render when it lands
  Sch.fetchWeather().then(function (wx) {
    if (!wx) return;
    P10.Views._weather = wx;
    if (currentTab === 'schedule' || currentTab === 'dashboard') renderTab(currentTab);
  });

  // Re-check for published stats when the tab regains focus
  var lastCheck = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    Store.loadPublished().then(function (u) {
      if (u) { Store.recompute(); renderAll(); toast('New stats loaded', 'good'); }
    });
  });

  // Expose a couple of helpers for console debugging
  window.P10.app = { goTab: goTab, renderAll: renderAll, toast: toast, openDrawer: openDrawer };
})();
