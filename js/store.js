/* ==========================================================================
   PROSPECTS 10U — STORE
   Single source of truth for app state. Handles localStorage persistence,
   loading the published data/team.json, and export/import.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Store = (function () {
  'use strict';

  var NS = P10.CONFIG.ns;
  var KEY = NS + '_data';
  var KEY_PREFS = NS + '_prefs';
  var KEY_COACH = NS + '_coach';
  var KEY_LINEUP = NS + '_lineups';
  var KEY_GAMESTATE = NS + '_gamestate';

  /* ---------------- State ---------------- */
  var state = {
    data: { batting: {}, pitching: {}, fielding: {}, catching: {} },
    meta: { updatedAt: null, source: null, gamesPlayed: null, record: null },
    players: [],
    team: null,
    viewWindow: 'season',
    coach: false,
    lineups: { standard: null, weak: null, elite: null },
    gameState: { strengths: {}, speeds: {} },
    ready: false
  };

  var listeners = [];
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  function emit(reason) { listeners.forEach(function (fn) { try { fn(state, reason); } catch (e) { console.error(e); } }); }

  /* ---------------- Safe storage ---------------- */
  function ls(key, val) {
    try {
      if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
      if (val === null) { localStorage.removeItem(key); return null; }
      localStorage.setItem(key, JSON.stringify(val));
      return val;
    } catch (e) { return null; }
  }

  /* ---------------- Rebuild derived state ---------------- */
  function recompute() {
    state.players = P10.Stats.buildPlayers(state.data, state.viewWindow);
    state.team = P10.Stats.teamStats(state.players);
    state.trend = P10.Stats.teamTrend(state.players);
    state.available = P10.Stats.availableWindows(state.data);
  }

  /* ---------------- Persistence ---------------- */
  function persist() {
    ls(KEY, { data: state.data, meta: state.meta });
  }

  function loadLocal() {
    var saved = ls(KEY);
    if (saved && saved.data) {
      state.data = saved.data;
      state.meta = saved.meta || state.meta;
      return true;
    }
    return false;
  }

  function loadPrefs() {
    var p = ls(KEY_PREFS) || {};
    if (p.viewWindow) state.viewWindow = p.viewWindow;
    state.coach = ls(KEY_COACH) === true;
    state.lineups = ls(KEY_LINEUP) || state.lineups;
    state.gameState = ls(KEY_GAMESTATE) || state.gameState;
  }

  function savePrefs() { ls(KEY_PREFS, { viewWindow: state.viewWindow }); }

  /* ---------------- Published data (data/team.json) ----------------
     This is the file the daily sync writes. If it is newer than what
     is in localStorage, it wins - so parents always see fresh numbers
     without touching anything.
     ---------------------------------------------------------------- */
  function loadPublished() {
    return fetch(P10.CONFIG.dataUrl + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json || !json.data) return false;

        var incoming = json.meta && json.meta.updatedAt ? new Date(json.meta.updatedAt).getTime() : 0;
        var localTs = state.meta && state.meta.updatedAt ? new Date(state.meta.updatedAt).getTime() : 0;

        var hasLocal = Object.keys(state.data.batting || {}).length ||
                       Object.keys(state.data.pitching || {}).length;

        if (!hasLocal || incoming > localTs) {
          state.data = json.data;
          state.meta = json.meta || { updatedAt: new Date().toISOString(), source: 'published' };
          persist();
          return true;
        }
        return false;
      })
      .catch(function () { return false; });
  }

  /* ---------------- Ingest parsed CSV files ---------------- */
  function ingest(files) {
    // files: [{ name, text, category, window }]
    var added = 0;
    files.forEach(function (f) {
      var parsed = P10.CSV.toObjects(f.text);
      if (!parsed || !parsed.data.length) return;

      var cats = f.category && f.category !== 'auto'
        ? [f.category]
        : P10.CSV.detectCategories(parsed.headers);

      if (!cats.length) cats = ['batting'];

      cats.forEach(function (cat) {
        if (!state.data[cat]) state.data[cat] = {};
        state.data[cat][f.window] = { headers: parsed.headers, data: parsed.data, file: f.name };
        added++;
      });
    });

    if (added) {
      state.meta.updatedAt = new Date().toISOString();
      state.meta.source = 'upload';
      delete state.meta.sample;
      persist();
      recompute();
      emit('ingest');
    }
    return added;
  }

  /* Sample data is flagged in meta so the app can shout about it. It clears
     with the same Clear Data button as anything else. */
  function isSample() { return !!(state.meta && state.meta.sample); }

  function loadSample() {
    var files = [
      'SAMPLE_Prospects10U_Season.csv',
      'SAMPLE_Prospects10U_Last8.csv',
      'SAMPLE_Prospects10U_Last4.csv'
    ];
    return Promise.all(files.map(function (name) {
      return fetch('sample/' + name + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (text) {
          if (!text) return null;
          var g = P10.CSV.categorize(name);
          return { name: name, text: text, category: g.category, window: g.window };
        })
        .catch(function () { return null; });
    })).then(function (results) {
      var good = results.filter(Boolean);
      if (!good.length) throw new Error('Sample files could not be loaded.');
      var added = ingest(good);
      state.meta.sample = true;
      state.meta.source = 'sample';
      persist();
      emit('sample');
      return added;
    });
  }

  function clearData() {
    state.data = { batting: {}, pitching: {}, fielding: {}, catching: {} };
    state.meta = { updatedAt: null, source: null, gamesPlayed: null, record: null };
    ls(KEY, null);
    recompute();
    emit('clear');
  }

  /* ---------------- Setters ---------------- */
  function setWindow(w) {
    if (state.viewWindow === w) return;
    state.viewWindow = w;
    savePrefs();
    recompute();
    emit('window');
  }

  function setCoach(on) {
    state.coach = !!on;
    ls(KEY_COACH, state.coach);
    emit('coach');
  }

  function saveLineups() { ls(KEY_LINEUP, state.lineups); }
  function saveGameState() { ls(KEY_GAMESTATE, state.gameState); }

  function setMeta(patch) {
    Object.assign(state.meta, patch);
    persist();
    emit('meta');
  }

  /* ---------------- Export / Import ---------------- */
  function exportBundle() {
    return {
      app: 'prospects-10u',
      version: 1,
      exportedAt: new Date().toISOString(),
      meta: state.meta,
      data: state.data,
      lineups: state.lineups,
      gameState: state.gameState
    };
  }

  function download() {
    var blob = new Blob([JSON.stringify(exportBundle(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'prospects10u-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importBundle(json) {
    if (!json || !json.data) throw new Error('Not a valid Prospects 10U export file.');
    state.data = json.data;
    state.meta = json.meta || { updatedAt: new Date().toISOString(), source: 'import' };
    if (json.lineups) { state.lineups = json.lineups; saveLineups(); }
    if (json.gameState) { state.gameState = json.gameState; saveGameState(); }
    persist();
    recompute();
    emit('import');
  }

  /* ---------------- Boot ---------------- */
  function init() {
    loadPrefs();
    loadLocal();
    recompute();
    state.ready = true;
    emit('init');

    // Then check for newer published data in the background
    loadPublished().then(function (updated) {
      if (updated) { recompute(); emit('published'); }
    });
  }

  return {
    state: state,
    subscribe: subscribe,
    emit: emit,
    init: init,
    ingest: ingest,
    clearData: clearData,
    setWindow: setWindow,
    setCoach: setCoach,
    setMeta: setMeta,
    saveLineups: saveLineups,
    saveGameState: saveGameState,
    recompute: recompute,
    isSample: isSample,
    loadSample: loadSample,
    exportBundle: exportBundle,
    download: download,
    importBundle: importBundle,
    loadPublished: loadPublished
  };
})();
