/* ==========================================================================
   PROSPECTS 10U — CSV PARSER
   Handles GameChanger exports, including the two-row header format where
   row 1 is a section band (Batting / Pitching / Fielding / Catching) and
   row 2 holds the actual column names.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.CSV = (function () {
  'use strict';

  /* ----------------------------------------------------------------
     RFC-4180-ish tokenizer. Handles quoted fields, escaped quotes,
     embedded commas and newlines, and both CRLF and LF line endings.
     ---------------------------------------------------------------- */
  function parseText(text) {
    var rows = [], row = [], field = '', inQuotes = false, i = 0;
    // strip BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    while (i < text.length) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }

      if (c === '"') { inQuotes = true; i++; continue; }

      if (c === ',') { row.push(field); field = ''; i++; continue; }

      if (c === '\r') { i++; continue; }

      if (c === '\n') {
        row.push(field); rows.push(row);
        row = []; field = ''; i++; continue;
      }

      field += c; i++;
    }

    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }

  /* ----------------------------------------------------------------
     Section band detection.
     GameChanger writes a row like:  ,,,Batting,,,,,,Pitching,,,,,Fielding
     Mostly blanks with a few category words spread across.
     ---------------------------------------------------------------- */
  var SECTION_WORDS = ['batting', 'pitching', 'fielding', 'catching', 'baserunning', 'general'];

  function isSectionRow(row) {
    var filled = row.filter(function (v) { return String(v).trim() !== ''; });
    if (!filled.length || filled.length > row.length * 0.55) return false;
    var hits = filled.filter(function (v) {
      return SECTION_WORDS.indexOf(String(v).trim().toLowerCase()) >= 0;
    });
    return hits.length >= 1 && hits.length >= filled.length * 0.5;
  }

  /* Forward-fill the section band so every column index knows its section. */
  function buildSectionMap(sectionRow, width) {
    var map = [], current = '';
    for (var i = 0; i < width; i++) {
      var v = String(sectionRow[i] || '').trim().toLowerCase();
      if (SECTION_WORDS.indexOf(v) >= 0) current = v;
      map[i] = current;
    }
    return map;
  }

  /* ----------------------------------------------------------------
     Convert raw text into { headers, data, sections }
     headers are namespaced as "batting.OBP" when a section band exists.
     ---------------------------------------------------------------- */
  function toObjects(text) {
    var rows = parseText(text);
    if (rows.length < 2) return null;

    var headerIdx = 0, sectionMap = null;
    var width = Math.max.apply(null, rows.slice(0, 4).map(function (r) { return r.length; }));

    if (isSectionRow(rows[0]) && rows.length >= 3) {
      sectionMap = buildSectionMap(rows[0], width);
      headerIdx = 1;
    }

    var rawHeaders = rows[headerIdx].map(function (h) { return String(h || '').trim(); });

    var headers = rawHeaders.map(function (h, i) {
      if (!h) return '_col' + i;
      var sec = sectionMap ? sectionMap[i] : '';
      return sec ? sec + '.' + h : h;
    });

    // de-duplicate identical header names
    var seen = {};
    headers = headers.map(function (h) {
      if (seen[h] === undefined) { seen[h] = 0; return h; }
      seen[h]++;
      return h + '_' + seen[h];
    });

    var data = [];
    for (var r = headerIdx + 1; r < rows.length; r++) {
      var obj = {}, any = false;
      for (var c = 0; c < headers.length; c++) {
        var val = rows[r][c] !== undefined ? String(rows[r][c]).trim() : '';
        obj[headers[c]] = val;
        if (val) any = true;
      }
      if (any) data.push(obj);
    }

    return { headers: headers, data: data, hasSections: !!sectionMap };
  }

  /* ----------------------------------------------------------------
     COLUMN PATTERNS
     Every alias GameChanger (and common exports) use for each stat.
     ---------------------------------------------------------------- */
  var PATTERNS = {
    player:  ['player', 'name', 'full name', 'player name', 'players'],
    first:   ['first', 'first name', 'firstname'],
    last:    ['last', 'last name', 'lastname'],
    number:  ['#', 'number', 'jersey', 'jersey #', 'uniform'],

    // batting
    avg:  ['avg', 'ba', 'batting average', 'bat avg'],
    obp:  ['obp', 'on base', 'on-base', 'on base %', 'on-base %', 'obp%'],
    slg:  ['slg', 'slugging', 'slg%', 'slugging %'],
    ops:  ['ops'],
    pa:   ['pa', 'plate appearances', 'plate app'],
    ab:   ['ab', 'at bats', 'at-bats'],
    hits: ['h', 'hits'],
    doubles: ['2b', 'doubles'],
    triples: ['3b', 'triples'],
    hr:   ['hr', 'home runs', 'homeruns'],
    rbi:  ['rbi', 'rbis', 'runs batted in'],
    runs: ['r', 'runs', 'runs scored'],
    k:    ['k', 'so', 'strikeouts', 'k%', 'so%'],
    bb:   ['bb', 'walks', 'base on balls'],
    hbp:  ['hbp', 'hit by pitch'],
    sb:   ['sb', 'stolen bases', 'steals'],
    qab:  ['qab', 'qab%', 'quality at bats', 'quality ab'],
    hardHit: ['hard hit', 'hard hit %', 'hh%', 'hhb'],

    // pitching
    ip:   ['ip', 'innings pitched', 'innings'],
    era:  ['era', 'earned run avg'],
    whip: ['whip'],
    bf:   ['bf', 'batters faced', 'tbf'],
    pitches: ['#p', 'p', 'pitches', 'pitch count', 'total pitches'],
    strikes: ['s', 'strikes'],
    strike: ['strike%', 'strike pct', 'strikes %', 'strike percentage', 's%', 'fps%'],
    bbip: ['bb/ip', 'bb/inn', 'walks per inning', 'bb_per_ip', 'bb per ip'],
    kip:  ['k/ip', 'k/inn', 'k per inning', 'k_per_ip'],
    er:   ['er', 'earned runs'],
    wp:   ['wp', 'wild pitches'],

    // fielding
    errors:  ['e', 'errors'],
    fpct:    ['fpct', 'fielding %', 'fld %', 'fielding percentage', 'fp'],
    chances: ['tc', 'total chances', 'chances'],
    assists: ['a', 'assists'],
    putouts: ['po', 'putouts'],
    dp:      ['dp', 'double plays'],
    position:['pos', 'position', 'primary position', 'positions'],

    // catching
    pb:  ['pb', 'passed balls'],
    cs:  ['cs', 'caught stealing', 'cs against'],
    sba: ['sb', 'sba', 'stolen bases allowed', 'sb against'],
    csPct: ['cs%', 'caught stealing %']
  };

  /* ----------------------------------------------------------------
     Section-aware column lookup.
     Order: exact section match → exact plain → fuzzy section → fuzzy plain.
     A header carrying a DIFFERENT section prefix is never returned when a
     section was requested (stops pitching BB masquerading as batting BB).
     ---------------------------------------------------------------- */
  var SECTIONS = ['batting', 'pitching', 'fielding', 'catching'];

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9%/.]/g, ''); }

  function findCol(headers, key, section) {
    var cands = PATTERNS[key] || [];
    var lc = headers.map(function (h) { return String(h || '').toLowerCase().trim(); });

    function wrongSection(idx) {
      if (!section) return false;
      var h = headers[idx];
      if (h.indexOf('.') < 0) return false;
      var pre = h.split('.')[0].toLowerCase();
      return SECTIONS.indexOf(pre) >= 0 && pre !== section;
    }

    var i, j, idx;

    // 1. exact, section-qualified
    if (section) {
      for (i = 0; i < cands.length; i++) {
        idx = lc.indexOf(section + '.' + cands[i]);
        if (idx >= 0) return headers[idx];
      }
    }
    // 2. exact, unqualified
    for (i = 0; i < cands.length; i++) {
      idx = lc.indexOf(cands[i]);
      if (idx >= 0 && !wrongSection(idx)) return headers[idx];
    }
    // 3. fuzzy, section-qualified
    if (section) {
      for (i = 0; i < cands.length; i++) {
        var target = norm(section + '.' + cands[i]);
        for (j = 0; j < lc.length; j++) {
          if (norm(lc[j]) === target) return headers[j];
        }
      }
    }
    // 4. fuzzy, unqualified (strip any section prefix before comparing)
    for (i = 0; i < cands.length; i++) {
      var t = norm(cands[i]);
      for (j = 0; j < lc.length; j++) {
        var stripped = lc[j].indexOf('.') >= 0 ? lc[j].split('.').slice(1).join('.') : lc[j];
        if (norm(stripped) === t && !wrongSection(j)) return headers[j];
      }
    }
    return null;
  }

  /* Numeric coercion that survives %, commas, dashes and blanks. */
  function num(v) {
    if (v === undefined || v === null || v === '') return null;
    var s = String(v).replace(/[%,$]/g, '').trim();
    if (!s || s === '-' || s === '--' || s === '—' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return null;
    // leading-dot averages like .375
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  /* Percent fields arrive as either 0.62 or 62. Normalize to 0-1. */
  function pct(v) {
    var n = num(v);
    if (n === null) return null;
    return n > 1.5 ? n / 100 : n;
  }

  /* Innings pitched in baseball notation: 5.2 means 5 and 2/3 innings. */
  function innings(v) {
    var n = num(v);
    if (n === null) return null;
    var whole = Math.floor(n);
    var frac = Math.round((n - whole) * 10);
    if (frac === 1) return whole + 1 / 3;
    if (frac === 2) return whole + 2 / 3;
    return n;
  }

  /* ----------------------------------------------------------------
     File name → { category, window }
     ---------------------------------------------------------------- */
  function categorize(filename) {
    var l = String(filename).toLowerCase();

    var category = 'auto';
    if (/\bpitch/.test(l)) category = 'pitching';
    else if (/\bcatch/.test(l)) category = 'catching';
    else if (/\bfield|defen/.test(l)) category = 'fielding';
    else if (/\bbat|hitt/.test(l)) category = 'batting';

    var win;
    if (/\b(season|total|all.?year|full)\b/.test(l)) win = 'season';
    else if (/last\s*game(?!s)|recent.?game/.test(l)) win = 'last_game';
    else if (/last.?13|\b13.?games?\b/.test(l)) win = 'last_13';
    else if (/last.?10|\b10.?games?\b/.test(l)) win = 'last_10';
    else if (/last.?8|\b8.?games?\b/.test(l)) win = 'last_8';
    else if (/last.?5|\b5.?games?\b/.test(l)) win = 'last_5';
    else if (/last.?4|\b4.?games?\b/.test(l)) win = 'last_4';
    else if (/last.?3|\b3.?games?\b/.test(l)) win = 'last_3';
    else if (/last.?2|\b2.?games?\b/.test(l)) win = 'last_2';
    else win = 'season';

    return { category: category, window: win };
  }

  /* Which stat families actually appear in a header set. */
  function detectCategories(headers) {
    var found = {};
    if (findCol(headers, 'ops', 'batting') || findCol(headers, 'avg', 'batting') ||
        findCol(headers, 'obp', 'batting') || findCol(headers, 'ab', 'batting')) found.batting = true;
    if (findCol(headers, 'ip', 'pitching') || findCol(headers, 'era', 'pitching') ||
        findCol(headers, 'whip', 'pitching')) found.pitching = true;
    if (findCol(headers, 'fpct', 'fielding') || findCol(headers, 'chances', 'fielding') ||
        findCol(headers, 'putouts', 'fielding')) found.fielding = true;
    if (findCol(headers, 'pb', 'catching') || findCol(headers, 'csPct', 'catching')) found.catching = true;
    return Object.keys(found);
  }

  /* ----------------------------------------------------------------
     Player name resolution + roster matching
     ---------------------------------------------------------------- */
  function rawName(row, headers) {
    var pc = findCol(headers, 'player');
    if (pc && row[pc]) return String(row[pc]).trim();

    var fc = findCol(headers, 'first'), lc2 = findCol(headers, 'last');
    if (fc && lc2 && (row[fc] || row[lc2])) {
      return (String(row[fc] || '').trim() + ' ' + String(row[lc2] || '').trim()).trim();
    }
    if (lc2 && row[lc2]) return String(row[lc2]).trim();
    return '';
  }

  /* Normalize for comparison: strip suffixes, punctuation, case, and
     handle "Last, First" ordering. */
  function nameKey(n) {
    var s = String(n).trim();
    if (s.indexOf(',') >= 0) {
      var parts = s.split(',');
      s = (parts[1] || '').trim() + ' ' + (parts[0] || '').trim();
    }
    return s.toLowerCase()
      .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Match a CSV name against the configured roster. Falls back to the
     raw name so unknown players still show up rather than vanishing. */
  function resolveName(raw) {
    if (!raw) return null;
    var key = nameKey(raw);
    if (!key) return null;

    var roster = P10.CONFIG.roster;
    var i, rk;

    // exact normalized match
    for (i = 0; i < roster.length; i++) {
      if (nameKey(roster[i].name) === key) return roster[i].name;
    }
    // last name + first initial
    var parts = key.split(' ');
    if (parts.length >= 2) {
      var fi = parts[0][0], last = parts[parts.length - 1];
      for (i = 0; i < roster.length; i++) {
        rk = nameKey(roster[i].name).split(' ');
        if (rk.length >= 2 && rk[rk.length - 1] === last && rk[0][0] === fi) return roster[i].name;
      }
    }
    // unique last-name match
    if (parts.length) {
      var lastOnly = parts[parts.length - 1];
      var hits = roster.filter(function (p) {
        var k = nameKey(p.name).split(' ');
        return k[k.length - 1] === lastOnly;
      });
      if (hits.length === 1) return hits[0].name;
    }

    // Not on the roster - keep the original spelling, title-cased
    return String(raw).trim();
  }

  function getPlayerName(row, headers) {
    return resolveName(rawName(row, headers));
  }

  return {
    parseText: parseText,
    toObjects: toObjects,
    findCol: findCol,
    num: num,
    pct: pct,
    innings: innings,
    categorize: categorize,
    detectCategories: detectCategories,
    getPlayerName: getPlayerName,
    resolveName: resolveName,
    nameKey: nameKey,
    PATTERNS: PATTERNS
  };
})();
