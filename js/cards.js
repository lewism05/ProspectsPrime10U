/* ==========================================================================
   PROSPECTS 10U — BASEBALL CARD
   Front is the portrait, back is the full stat line. One spin on reveal,
   then flip to read the back, the way a real card works.

   Photos are stored per browser in localStorage as compressed JPEG data
   URLs. That means a photo a parent uploads lives on THAT device only -
   it does not sync to other families and Claude never sees it. Anything
   that syncs would need a server, which this app deliberately does not have.
   ========================================================================== */
window.P10 = window.P10 || {};

P10.Cards = (function () {
  'use strict';

  var S = P10.Stats;
  var C = P10.CONFIG;
  var I = P10.Insights;

  var PHOTO_PREFIX = C.ns + '_photo_';
  var MAX_EDGE = 620;        // longest side after downscale
  var JPEG_Q = 0.82;

  function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function esc(s) { return P10.Views.esc(s); }

  /* ================= photo storage ================= */
  function getPhoto(name) {
    try { return localStorage.getItem(PHOTO_PREFIX + slug(name)); } catch (e) { return null; }
  }
  function setPhoto(name, dataUrl) {
    try { localStorage.setItem(PHOTO_PREFIX + slug(name), dataUrl); return true; }
    catch (e) { return false; }
  }
  function clearPhoto(name) {
    try { localStorage.removeItem(PHOTO_PREFIX + slug(name)); } catch (e) {}
  }
  function photoCount() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if ((localStorage.key(i) || '').indexOf(PHOTO_PREFIX) === 0) n++;
      }
    } catch (e) {}
    return n;
  }

  /* Downscale and compress before storing. A 4MB phone photo becomes
     roughly 60-90KB, which keeps nine of them well inside the quota. */
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        return reject(new Error('That file is not an image.'));
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That image could not be opened.')); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return reject(new Error('That image looks empty.'));
          var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);

          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#0D1219';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);

          try { resolve(cv.toDataURL('image/jpeg', JPEG_Q)); }
          catch (e) { reject(new Error('That image could not be processed.')); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ================= card content ================= */

  function frontStats(p) {
    var b = p.bat || {};
    if (b.ops > 0 || b.pa > 0) {
      return [
        [S.rate(b.avg), 'AVG'],
        [S.rate(b.obp), 'OBP'],
        [S.rate(b.ops), 'OPS'],
        [b.qab != null && b.qab > 0 ? Math.round(b.qab * 100) + '%' : '—', 'QAB']
      ];
    }
    if (p.pit && p.pit.ip > 0) {
      return [
        [S.ipText(p.pit.ip), 'IP'],
        [S.fixed(p.pit.era, 2), 'ERA'],
        [p.pit.strike ? Math.round(p.pit.strike * 100) + '%' : '—', 'STR'],
        [String(p.pit.k), 'K']
      ];
    }
    return [['—', 'AVG'], ['—', 'OBP'], ['—', 'OPS'], ['—', 'QAB']];
  }

  function renderFront(p) {
    var photo = getPhoto(p.name);
    var num = (p.num !== null && p.num !== undefined) ? p.num : '–';
    var stats = frontStats(p);
    var tierCls = p.hasData && p.bat && p.bat.ops > 0 ? 'tier-' + p.tier : '';

    return '' +
      '<div class="bbface bbfront">' +
        '<img class="bbfront-mark" src="assets/mark.png" alt="">' +
        '<div class="bbfoil"></div>' +
        '<div class="bbf-top">' +
          '<span class="bbf-team">Prospects ' + esc(C.team.ageGroup) + '</span>' +
          '<span class="bbf-year">' + esc(C.team.season) + '</span>' +
        '</div>' +
        '<div class="bbf-photo" id="bbPhotoBox">' +
          (photo
            ? '<img src="' + photo + '" alt="' + esc(p.name) + '">'
            : '<div class="bbf-empty" id="bbEmpty">' +
                '<div class="bbf-empty-num">' + esc(num) + '</div>' +
                '<div class="bbf-empty-cta">＋ Add a photo</div>' +
              '</div>') +
        '</div>' +
        '<div class="bbf-plate">' +
          '<span class="bbf-num">' + esc(num) + '</span>' +
          '<span class="bbf-id">' +
            '<div class="bbf-name">' + esc(p.name) + '</div>' +
            '<div class="bbf-pos">' + esc(p.role || 'Roster') + '</div>' +
          '</span>' +
          (tierCls ? '<span class="bbf-tier tier-badge ' + tierCls + '">' + esc(S.tierName(p.tier)) + '</span>' : '') +
        '</div>' +
        '<div class="bbf-line">' +
          stats.map(function (s) {
            return '<div><div class="v">' + esc(s[0]) + '</div><div class="l">' + esc(s[1]) + '</div></div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function row(label, val) {
    return '<tr><td>' + esc(label) + '</td><td>' + esc(val) + '</td></tr>';
  }

  function renderBack(p, all) {
    var num = (p.num !== null && p.num !== undefined) ? p.num : '–';
    var b = p.bat, pit = p.pit, f = p.fld, c = p.cat;
    var html = '';

    if (b && (b.ops > 0 || b.pa > 0)) {
      html += '<div class="bbb-sec">Batting</div>' +
        '<table class="bbb-tbl"><thead><tr>' +
          '<th>Stat</th><th>PA</th><th>AB</th><th>H</th><th>BB</th><th>K</th><th>SB</th>' +
        '</tr></thead><tbody><tr>' +
          '<td>Totals</td>' +
          '<td>' + (b.pa || b.ab || 0) + '</td><td>' + b.ab + '</td><td>' + b.h + '</td>' +
          '<td>' + b.bb + '</td><td>' + b.k + '</td><td>' + b.sb + '</td>' +
        '</tr></tbody></table>' +
        '<table class="bbb-tbl" style="margin-top:5px"><thead><tr>' +
          '<th>Rate</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>QAB</th>' +
        '</tr></thead><tbody><tr>' +
          '<td>Season</td>' +
          '<td>' + S.rate(b.avg) + '</td><td>' + S.rate(b.obp) + '</td>' +
          '<td>' + S.rate(b.slg) + '</td><td>' + S.rate(b.ops) + '</td>' +
          '<td>' + (b.qab ? Math.round(b.qab * 100) + '%' : '—') + '</td>' +
        '</tr></tbody></table>';
    }

    if (pit && pit.ip > 0) {
      html += '<div class="bbb-sec">Pitching</div>' +
        '<table class="bbb-tbl"><thead><tr>' +
          '<th>Stat</th><th>IP</th><th>ERA</th><th>WHIP</th><th>STR%</th><th>BB</th><th>K</th>' +
        '</tr></thead><tbody><tr>' +
          '<td>Totals</td>' +
          '<td>' + S.ipText(pit.ip) + '</td><td>' + S.fixed(pit.era, 2) + '</td>' +
          '<td>' + (pit.whip ? S.fixed(pit.whip, 2) : '—') + '</td>' +
          '<td>' + (pit.strike ? Math.round(pit.strike * 100) + '%' : '—') + '</td>' +
          '<td>' + pit.bb + '</td><td>' + pit.k + '</td>' +
        '</tr></tbody></table>';
    }

    if (f && (f.tc > 0 || (f.positions && f.positions.length))) {
      html += '<div class="bbb-sec">Fielding</div>' +
        '<table class="bbb-tbl"><thead><tr>' +
          '<th>Stat</th><th>TC</th><th>PO</th><th>A</th><th>E</th><th>FPCT</th>' +
        '</tr></thead><tbody><tr>' +
          '<td>Totals</td>' +
          '<td>' + f.tc + '</td><td>' + f.po + '</td><td>' + f.a + '</td>' +
          '<td>' + f.e + '</td><td>' + (f.fpct ? S.rate(f.fpct) : '—') + '</td>' +
        '</tr></tbody></table>';

      if (f.positions && f.positions.length) {
        html += '<div class="bbb-sec">Innings By Position</div>' +
          '<table class="bbb-tbl"><tbody>' +
          f.positions.slice(0, 5).map(function (q) {
            return row(q.pos, S.ipText(q.innings));
          }).join('') +
          '</tbody></table>';
      }
    }

    if (c && (c.pb > 0 || c.attempts > 0)) {
      html += '<div class="bbb-sec">Behind The Plate</div>' +
        '<table class="bbb-tbl"><thead><tr>' +
          '<th>Stat</th><th>PB</th><th>CS</th><th>ATT</th><th>CS%</th>' +
        '</tr></thead><tbody><tr>' +
          '<td>Totals</td>' +
          '<td>' + c.pb + '</td><td>' + c.cs + '</td>' +
          '<td>' + (c.attempts || (c.cs + c.sba)) + '</td>' +
          '<td>' + (c.csPct ? Math.round(c.csPct * 100) + '%' : '—') + '</td>' +
        '</tr></tbody></table>';
    }

    if (!html) {
      html = '<div class="bbb-note">No stats loaded yet. This card fills in ' +
             'automatically once the season numbers are uploaded.</div>';
    }

    // A short scouting line, written from what the numbers actually say.
    var strengths = p.hasData ? I.playerStrengths(p) : [];
    if (strengths.length) {
      html += '<div class="bbb-note"><strong>Scouting:</strong> ' +
        esc(strengths.slice(0, 3).join('. ')) + '.</div>';
    }

    var ach = p.hasData ? I.achievements(p, all || []) : [];
    if (ach.length) {
      html += '<div class="bbb-badges">' +
        ach.slice(0, 5).map(function (a) {
          return '<span class="bbb-badge">' + a.em + ' ' + esc(a.label) + '</span>';
        }).join('') + '</div>';
    }

    return '' +
      '<div class="bbface bbback">' +
        '<div class="bbb-head">' +
          '<span class="bbb-num">#' + esc(num) + '</span>' +
          '<span class="bbb-name">' + esc(p.name) + '</span>' +
          '<span class="bbb-pos">' + esc(p.position || '') + '</span>' +
        '</div>' +
        '<div class="bbb-scroll">' + html + '</div>' +
        '<div class="bbb-foot">' +
          '<span>Prospects ' + esc(C.team.ageGroup) + '</span>' +
          '<span>' + esc(C.team.season) + ' Season</span>' +
        '</div>' +
      '</div>';
  }

  /* ================= mount ================= */

  /* Renders the card into `host` and wires the flip and photo controls.
     Pass spin:false to skip the reveal animation (e.g. re-render after
     a photo change, where a second spin would just be noise). */
  function mount(host, p, all, opts) {
    opts = opts || {};
    var spin = opts.spin !== false;

    host.innerHTML =
      '<div class="card-stage">' +
        '<div class="bbcard-spin' + (spin ? ' revealing' : '') + '" id="bbSpin">' +
          '<div class="bbcard" id="bbCard">' +
            renderFront(p) +
            renderBack(p, all) +
          '</div>' +
        '</div>' +
        '<input type="file" id="bbPhotoInput" accept="image/*" hidden>' +
        '<div class="card-tools">' +
          '<button class="btn btn-ghost" id="bbFlip">Flip Card</button>' +
          '<button class="btn btn-ghost" id="bbUpload">' +
            (getPhoto(p.name) ? 'Change Photo' : 'Add Photo') + '</button>' +
          (getPhoto(p.name) ? '<button class="btn btn-ghost" id="bbRemove">Remove</button>' : '') +
        '</div>' +
        '<div class="card-err hidden" id="bbErr"></div>' +
        '<div class="card-hint">Photos are saved on this device only. Other families will not see ' +
          'one you add here, and adding one never uploads it anywhere.</div>' +
      '</div>';

    var spinEl = host.querySelector('#bbSpin');
    var cardEl = host.querySelector('#bbCard');
    var input = host.querySelector('#bbPhotoInput');
    var errEl = host.querySelector('#bbErr');

    if (spin) {
      spinEl.addEventListener('animationend', function () {
        spinEl.classList.remove('revealing');
      }, { once: true });
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }
    function clearErr() { errEl.classList.add('hidden'); errEl.textContent = ''; }

    host.querySelector('#bbFlip').addEventListener('click', function () {
      cardEl.classList.toggle('flipped');
      this.textContent = cardEl.classList.contains('flipped') ? 'Show Front' : 'Flip Card';
    });

    function pick() { clearErr(); input.click(); }
    host.querySelector('#bbUpload').addEventListener('click', pick);
    var empty = host.querySelector('#bbEmpty');
    if (empty) empty.addEventListener('click', pick);

    var removeBtn = host.querySelector('#bbRemove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        clearPhoto(p.name);
        mount(host, p, all, { spin: false });
      });
    }

    input.addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      clearErr();

      processImage(file).then(function (dataUrl) {
        if (!setPhoto(p.name, dataUrl)) {
          showErr('Not enough space to save that photo. Remove another player\'s photo and try again.');
          return;
        }
        mount(host, p, all, { spin: false });
      }).catch(function (e) {
        showErr(e.message || 'That photo could not be added.');
      });
    });
  }

  return {
    mount: mount,
    getPhoto: getPhoto,
    setPhoto: setPhoto,
    clearPhoto: clearPhoto,
    photoCount: photoCount,
    slug: slug,
    renderFront: renderFront,
    renderBack: renderBack
  };
})();
