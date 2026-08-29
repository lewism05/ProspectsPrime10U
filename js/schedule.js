/* ==========================================================================
   PROSPECTS PRIME 10U — SCHEDULE + WEATHER
   Game list handling, next-game logic, and Open-Meteo forecasts.
   Open-Meteo is free and needs no API key.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Schedule = (function () {
  'use strict';

  var C = P10.CONFIG;
  var CACHE_KEY = C.ns + '_weather';
  var TTL = 1000 * 60 * 60 * 3;   // 3 hours

  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  /* Parse a YYYY-MM-DD as a LOCAL date, not UTC (avoids off-by-one days). */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function games() {
    return (C.schedule || []).map(function (g, i) {
      var d = parseDate(g.date);
      return Object.assign({}, g, {
        idx: i,
        _date: d,
        mon: d ? MONTHS[d.getMonth()] : '',
        dayNum: d ? d.getDate() : '',
        dow: d ? DOW[d.getDay()] : (g.day || '')
      });
    }).sort(function (a, b) {
      if (!a._date || !b._date) return 0;
      return a._date - b._date;
    });
  }

  function todayMidnight() {
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  function upcoming() {
    var t = todayMidnight();
    return games().filter(function (g) { return g._date && g._date >= t; });
  }

  function past() {
    var t = todayMidnight();
    return games().filter(function (g) { return g._date && g._date < t; }).reverse();
  }

  function next() {
    var u = upcoming();
    return u.length ? u[0] : null;
  }

  function daysUntil(g) {
    if (!g || !g._date) return null;
    return Math.round((g._date - todayMidnight()) / 86400000);
  }

  function countdownText(g) {
    var d = daysUntil(g);
    if (d === null) return '';
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d < 7) return 'In ' + d + ' days';
    if (d < 14) return 'Next week';
    return 'In ' + Math.round(d / 7) + ' weeks';
  }

  /* ==================================================================
     WEATHER — Open-Meteo daily forecast, cached for 3 hours.
     The API only forecasts ~16 days out, so anything further shows blank.
     ================================================================== */
  var wxCache = null;

  function readCache() {
    if (wxCache) return wxCache;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > TTL) return null;
      wxCache = obj.data;
      return wxCache;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    wxCache = data;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
  }

  function fetchWeather() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);

    var loc = C.team.location;
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + loc.lat + '&longitude=' + loc.lng +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=16';

    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.daily || !j.daily.time) return null;
        var out = {};
        j.daily.time.forEach(function (date, i) {
          out[date] = {
            code: j.daily.weather_code[i],
            hi: Math.round(j.daily.temperature_2m_max[i]),
            lo: Math.round(j.daily.temperature_2m_min[i]),
            pop: j.daily.precipitation_probability_max[i],
            wind: Math.round(j.daily.wind_speed_10m_max[i])
          };
        });
        writeCache(out);
        return out;
      })
      .catch(function () { return null; });
  }

  function forecastFor(dateStr, wx) {
    if (!wx || !dateStr) return null;
    return wx[dateStr] || null;
  }

  /* WMO weather codes → emoji + label */
  var WX = {
    0: ['☀️', 'Clear'],
    1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'],
    51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌦️', 'Heavy drizzle'],
    61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
    71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['🌨️', 'Heavy snow'],
    77: ['🌨️', 'Snow grains'],
    80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Heavy showers'],
    85: ['🌨️', 'Snow showers'], 86: ['🌨️', 'Snow showers'],
    95: ['⛈️', 'Thunderstorms'], 96: ['⛈️', 'Storms with hail'], 99: ['⛈️', 'Severe storms']
  };

  function wxIcon(code) { return (WX[code] || ['🌡️'])[0]; }
  function wxLabel(code) { return (WX[code] || ['—'])[1]; }

  /* Plain-language play conditions for a parent glancing at the card. */
  function playability(f) {
    if (!f) return null;
    if (f.pop >= 70) return { cls: 'bad', text: 'Rain likely - watch for a cancellation' };
    if (f.pop >= 40) return { cls: 'warn', text: 'Rain possible - check before you drive' };
    if (f.hi >= 95) return { cls: 'warn', text: 'Hot - extra water and shade' };
    if (f.lo <= 40) return { cls: 'warn', text: 'Cold - jackets and hand warmers' };
    if (f.wind >= 20) return { cls: 'warn', text: 'Windy - fly balls will move' };
    return { cls: 'good', text: 'Good conditions for baseball' };
  }

  /* ==================================================================
     OPPONENT STRENGTH (coach-set, drives the lineup scenario)
     ================================================================== */
  function strengthOf(gameId) {
    var s = P10.Store.state.gameState.strengths || {};
    return s[gameId] || 'standard';
  }

  function setStrength(gameId, val) {
    if (!P10.Store.state.gameState.strengths) P10.Store.state.gameState.strengths = {};
    P10.Store.state.gameState.strengths[gameId] = val;
    P10.Store.saveGameState();
  }

  return {
    games: games,
    upcoming: upcoming,
    past: past,
    next: next,
    daysUntil: daysUntil,
    countdownText: countdownText,
    parseDate: parseDate,
    fetchWeather: fetchWeather,
    forecastFor: forecastFor,
    wxIcon: wxIcon,
    wxLabel: wxLabel,
    playability: playability,
    strengthOf: strengthOf,
    setStrength: setStrength,
    MONTHS: MONTHS,
    DOW: DOW
  };
})();
