/* ==========================================================================
   PROSPECTS PRIME 10U — CHARTS
   Thin Chart.js wrappers with a shared dark theme. All charts destroy and
   rebuild on re-render so the stat-window toggle stays in sync.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Charts = (function () {
  'use strict';

  var S = P10.Stats;
  var instances = {};

  /* Chart colours live in JS, so they cannot inherit the theme from CSS.
     They are read out of the custom properties instead and refreshed
     whenever the theme changes. */
  var COLOR = {
    chrome:  '#C9CFD6',
    chromeD: '#8B95A2',
    good:    '#3DDC91',
    warn:    '#FFC24B',
    bad:     '#FF6B6B',
    info:    '#57B6FF',
    grid:    'rgba(255,255,255,.055)',
    barA:    'rgba(87,182,255,.72)',
    barB:    'rgba(201,207,214,.72)',
    fillSoft:'rgba(201,207,214,.10)',
    fillUp:  'rgba(61,220,145,.12)',
    fillDown:'rgba(255,107,107,.12)',
    text:    '#A9B4C2',
    textDim: '#6B7686'
  };

  function readVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function refreshTheme() {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    COLOR.chrome  = readVar('--chrome', COLOR.chrome);
    COLOR.chromeD = readVar('--chrome-dim', COLOR.chromeD);
    COLOR.good    = readVar('--good', COLOR.good);
    COLOR.warn    = readVar('--warn', COLOR.warn);
    COLOR.bad     = readVar('--bad', COLOR.bad);
    COLOR.info    = readVar('--info', COLOR.info);
    COLOR.text    = readVar('--text-2', COLOR.text);
    COLOR.textDim = readVar('--text-3', COLOR.textDim);
    COLOR.grid    = light ? 'rgba(16,22,32,.08)' : 'rgba(255,255,255,.055)';
    COLOR.tipBg   = light ? 'rgba(255,255,255,.98)' : 'rgba(10,13,18,.96)';
    COLOR.tipLine = light ? 'rgba(16,22,32,.12)' : 'rgba(255,255,255,.12)';
    COLOR.tipText = readVar('--text', light ? '#101620' : '#F4F7FA');
    COLOR.point   = readVar('--surface', light ? '#FFFFFF' : '#0E1218');
    // Series fills were mixed for a black ground; on paper a pale bar is no bar.
    COLOR.barA     = light ? 'rgba(22,103,168,.78)'  : 'rgba(87,182,255,.72)';
    COLOR.barB     = light ? 'rgba(100,112,127,.55)' : 'rgba(201,207,214,.72)';
    COLOR.fillSoft = light ? 'rgba(16,22,32,.06)'    : 'rgba(201,207,214,.10)';
    COLOR.fillUp   = light ? 'rgba(27,122,71,.12)'   : 'rgba(61,220,145,.12)';
    COLOR.fillDown = light ? 'rgba(176,37,37,.10)'   : 'rgba(255,107,107,.12)';
  }

  function ready() { return typeof Chart !== 'undefined'; }

  function baseOptions(extra) {
    var o = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: false,
          labels: { color: COLOR.text, font: { family: 'Inter', size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: COLOR.tipBg || 'rgba(10,13,18,.96)',
          borderColor: COLOR.tipLine || 'rgba(255,255,255,.12)',
          borderWidth: 1,
          titleColor: COLOR.tipText || '#F4F7FA',
          bodyColor: COLOR.text,
          titleFont: { family: 'Inter', size: 12, weight: '600' },
          bodyFont: { family: 'Roboto Mono', size: 11 },
          padding: 10,
          cornerRadius: 6,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: COLOR.textDim, font: { family: 'Inter', size: 10 }, maxRotation: 40, minRotation: 0 }
        },
        y: {
          grid: { color: COLOR.grid, drawBorder: false },
          border: { display: false },
          ticks: { color: COLOR.textDim, font: { family: 'Roboto Mono', size: 10 }, padding: 6 }
        }
      }
    };
    return deepMerge(o, extra || {});
  }

  function deepMerge(a, b) {
    var out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object') {
        out[k] = deepMerge(a[k], b[k]);
      } else out[k] = b[k];
    });
    return out;
  }

  function destroy(id) {
    if (instances[id]) { try { instances[id].destroy(); } catch (e) {} delete instances[id]; }
  }

  function destroyAll() { Object.keys(instances).forEach(destroy); }

  /* Replace a chart slot with a readable message when it cannot draw. */
  function fallback(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    var box = el.closest('.chart-box') || el.parentNode;
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
      'color:var(--text-3);font-size:12.5px;text-align:center;padding:16px">' + msg + '</div>';
    box.style.height = 'auto';
    box.style.minHeight = '90px';
  }

  function make(id, cfg) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (!ready()) { fallback(id, 'Charts unavailable - the chart library did not load.'); return null; }
    destroy(id);
    try {
      instances[id] = new Chart(el.getContext('2d'), cfg);
      return instances[id];
    } catch (e) {
      console.error('chart ' + id, e);
      fallback(id, 'This chart could not be drawn.');
      return null;
    }
  }

  /* Vertical gradient for bar fills */
  function grad(ctx, area, top, bottom) {
    if (!area) return top;
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  }

  /* ==================================================================
     TEAM TREND — season vs last 8 vs last 4
     ================================================================== */
  function teamTrend(id, trend) {
    return make(id, {
      type: 'line',
      data: {
        labels: ['Full Season', 'Last 8', 'Last 4'],
        datasets: [{
          label: 'Team OPS',
          data: [trend.season, trend.l8, trend.l4],
          borderColor: COLOR.chrome,
          backgroundColor: COLOR.fillSoft,
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: COLOR.point || '#0E1218',
          pointBorderColor: COLOR.chrome,
          pointBorderWidth: 2.5,
          pointHoverRadius: 7,
          fill: true,
          tension: .32
        }]
      },
      options: baseOptions({
        plugins: {
          tooltip: { callbacks: { label: function (c) { return 'OPS ' + S.rate(c.parsed.y); } } }
        },
        scales: { y: { ticks: { callback: function (v) { return S.rate(v); } } } }
      })
    });
  }

  /* ==================================================================
     OPS BY PLAYER — horizontal ranked bars
     ================================================================== */
  function opsBar(id, players) {
    var rows = players
      .filter(function (p) { return p.bat && p.bat.ops > 0; })
      .sort(function (a, b) { return b.bat.ops - a.bat.ops; })
      .slice(0, 12);
    if (!rows.length) { fallback(id, 'No batting data in this window.'); return null; }

    var bench = P10.CONFIG.bench.batting.ops;

    return make(id, {
      type: 'bar',
      data: {
        labels: rows.map(function (p) { return p.short; }),
        datasets: [{
          data: rows.map(function (p) { return p.bat.ops; }),
          backgroundColor: function (ctx) {
            var v = rows[ctx.dataIndex].bat.ops;
            var c = v >= bench.elite ? COLOR.good
                  : v >= bench.good ? COLOR.chrome
                  : v >= bench.avg ? COLOR.chromeD
                  : COLOR.warn;
            return grad(ctx.chart.ctx, ctx.chart.chartArea, c, c + '55');
          },
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: .74,
          categoryPercentage: .82
        }]
      },
      options: baseOptions({
        indexAxis: 'y',
        plugins: {
          tooltip: { callbacks: { label: function (c) { return 'OPS ' + S.rate(c.parsed.x); } } }
        },
        scales: {
          x: {
            grid: { color: COLOR.grid, drawBorder: false },
            ticks: { color: COLOR.textDim, font: { family: 'Roboto Mono', size: 10 }, callback: function (v) { return S.rate(v); } }
          },
          y: { grid: { display: false }, ticks: { color: COLOR.text, font: { family: 'Inter', size: 11 } } }
        }
      })
    });
  }

  /* ==================================================================
     OBP vs SLG — stacked contribution to OPS
     ================================================================== */
  function obpSlg(id, players) {
    var rows = players
      .filter(function (p) { return p.bat && p.bat.ops > 0; })
      .sort(function (a, b) { return b.bat.ops - a.bat.ops; })
      .slice(0, 12);
    if (!rows.length) { fallback(id, 'No batting data in this window.'); return null; }

    return make(id, {
      type: 'bar',
      data: {
        labels: rows.map(function (p) { return p.short; }),
        datasets: [
          {
            label: 'OBP',
            data: rows.map(function (p) { return p.bat.obp; }),
            backgroundColor: COLOR.barA,
            borderRadius: 3, borderSkipped: false
          },
          {
            label: 'SLG',
            data: rows.map(function (p) { return p.bat.slg; }),
            backgroundColor: COLOR.barB,
            borderRadius: 3, borderSkipped: false
          }
        ]
      },
      options: baseOptions({
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' ' + S.rate(c.parsed.y); } } }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, ticks: { callback: function (v) { return S.rate(v); } } }
        }
      })
    });
  }

  /* ==================================================================
     PITCHING — strike % vs walks per inning
     ================================================================== */
  function pitchingChart(id, players) {
    var rows = players
      .filter(function (p) { return p.pit && p.pit.ip >= P10.CONFIG.minSample.ip; })
      .sort(function (a, b) { return b.pit.ip - a.pit.ip; });
    if (!rows.length) { fallback(id, 'No pitching data in this window.'); return null; }

    var bp = P10.CONFIG.bench.pitching;

    return make(id, {
      type: 'bar',
      data: {
        labels: rows.map(function (p) { return p.short; }),
        datasets: [
          {
            label: 'Strike %',
            data: rows.map(function (p) { return p.pit.strike * 100; }),
            backgroundColor: function (ctx) {
              var v = rows[ctx.dataIndex].pit.strike;
              return v >= bp.strike.good ? COLOR.good : v >= bp.strike.avg ? COLOR.chrome : COLOR.bad;
            },
            borderRadius: 4, borderSkipped: false, yAxisID: 'y', order: 2
          },
          {
            label: 'BB / IP',
            data: rows.map(function (p) { return p.pit.bbip; }),
            type: 'line',
            borderColor: COLOR.warn,
            backgroundColor: COLOR.warn,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: COLOR.point || '#0E1218',
            pointBorderWidth: 2,
            tension: .3,
            yAxisID: 'y1', order: 1
          }
        ]
      },
      options: baseOptions({
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (c) {
                return c.dataset.label === 'Strike %'
                  ? 'Strike ' + Math.round(c.parsed.y) + '%'
                  : S.fixed(c.parsed.y, 2) + ' BB/IP';
              }
            }
          }
        },
        scales: {
          y: {
            position: 'left', min: 0, max: 100,
            ticks: { callback: function (v) { return v + '%'; } }
          },
          y1: {
            position: 'right', min: 0,
            grid: { display: false },
            ticks: { color: COLOR.warn, font: { family: 'Roboto Mono', size: 10 } }
          }
        }
      })
    });
  }

  /* ==================================================================
     STRIKEOUT vs WALK RATE — plate discipline scatter
     ================================================================== */
  function disciplineChart(id, players) {
    var rows = players.filter(function (p) {
      return p.bat && (p.bat.pa >= P10.CONFIG.minSample.pa) && (p.bat.kRate > 0 || p.bat.bbRate > 0);
    });
    if (rows.length < 2) { fallback(id, 'Needs at least two hitters with enough plate appearances.'); return null; }

    return make(id, {
      type: 'scatter',
      data: {
        datasets: [{
          data: rows.map(function (p) {
            return { x: p.bat.kRate * 100, y: p.bat.bbRate * 100, label: p.short, ops: p.bat.ops };
          }),
          backgroundColor: function (ctx) {
            var d = ctx.raw;
            if (!d) return COLOR.chrome;
            return d.y >= d.x ? COLOR.good : d.x > d.y * 2.4 ? COLOR.bad : COLOR.chrome;
          },
          pointRadius: 7,
          pointHoverRadius: 10,
          borderColor: COLOR.point || '#0E1218',
          borderWidth: 1.5
        }]
      },
      options: baseOptions({
        plugins: {
          tooltip: {
            callbacks: {
              label: function (c) {
                var d = c.raw;
                return [d.label, 'K ' + Math.round(d.x) + '%  ·  BB ' + Math.round(d.y) + '%', 'OPS ' + S.rate(d.ops)];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'STRIKEOUT %', color: COLOR.textDim, font: { family: 'Barlow Condensed', size: 11, weight: '600' } },
            grid: { color: COLOR.grid },
            ticks: { callback: function (v) { return v + '%'; } }
          },
          y: {
            title: { display: true, text: 'WALK %', color: COLOR.textDim, font: { family: 'Barlow Condensed', size: 11, weight: '600' } },
            ticks: { callback: function (v) { return v + '%'; } }
          }
        }
      })
    });
  }

  /* ==================================================================
     PLAYER SPARK — season / L8 / L4 OPS for the drawer
     ================================================================== */
  function playerSpark(id, p) {
    var s = p.batSeason && p.batSeason.ops || 0;
    var l8 = p.batL8 && p.batL8.ops || s;
    var l4 = p.batL4 && p.batL4.ops || l8;
    if (!s && !l8 && !l4) { fallback(id, 'No batting trend yet.'); return null; }

    var rising = l4 >= s;

    return make(id, {
      type: 'line',
      data: {
        labels: ['Season', 'Last 8', 'Last 4'],
        datasets: [{
          data: [s, l8, l4],
          borderColor: rising ? COLOR.good : COLOR.bad,
          backgroundColor: rising ? COLOR.fillUp : COLOR.fillDown,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: COLOR.point || '#0E1218',
          pointBorderColor: rising ? COLOR.good : COLOR.bad,
          pointBorderWidth: 2,
          fill: true,
          tension: .3
        }]
      },
      options: baseOptions({
        plugins: { tooltip: { callbacks: { label: function (c) { return 'OPS ' + S.rate(c.parsed.y); } } } },
        scales: { y: { ticks: { callback: function (v) { return S.rate(v); } } } }
      })
    });
  }

  /* ==================================================================
     PLAYING TIME — plate appearances per player
     ================================================================== */
  function playingTime(id, players) {
    var rows = players
      .filter(function (p) { return p.bat && p.bat.pa > 0; })
      .sort(function (a, b) { return b.bat.pa - a.bat.pa; });
    if (!rows.length) { fallback(id, 'No plate appearance data loaded.'); return null; }

    var pas = rows.map(function (p) { return p.bat.pa; });
    var median = pas.slice().sort(function (a, b) { return a - b; })[Math.floor(pas.length / 2)];

    return make(id, {
      type: 'bar',
      data: {
        labels: rows.map(function (p) { return p.short; }),
        datasets: [{
          data: pas,
          backgroundColor: function (ctx) {
            var v = pas[ctx.dataIndex];
            return v < median * .7 ? COLOR.warn : COLOR.chromeD;
          },
          borderRadius: 4, borderSkipped: false
        }]
      },
      options: baseOptions({
        plugins: {
          tooltip: { callbacks: { label: function (c) { return c.parsed.y + ' plate appearances'; } } }
        },
        scales: { y: { ticks: { precision: 0 } } }
      })
    });
  }

  return {
    COLOR: COLOR,
    ready: ready,
    refreshTheme: refreshTheme,
    destroy: destroy,
    destroyAll: destroyAll,
    teamTrend: teamTrend,
    opsBar: opsBar,
    obpSlg: obpSlg,
    pitchingChart: pitchingChart,
    disciplineChart: disciplineChart,
    playerSpark: playerSpark,
    playingTime: playingTime
  };
})();
