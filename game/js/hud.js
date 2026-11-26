// SKYWARD — the HUD: DOM top bar, two round canvas gauges, an
// artificial-horizon strip, a throttle bar and a centre message line.
// Instruments are drawn bright on dark faces so they read as lit.
window.SKY = window.SKY || {};

(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function pad3(n) {
    n = Math.round(n) % 360;
    if (n < 0) n += 360;
    return ('00' + n).slice(-3);
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  // One round gauge: dark face, lit ticks/numerals, amber needle.
  function drawGauge(ctx, size, value, max, label, majorEvery, dangerFrom) {
    var cx = size / 2, cy = size / 2, R = size / 2 - 6;
    ctx.clearRect(0, 0, size, size);
    // Face.
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0f14'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2b3d4d'; ctx.stroke();
    // Sweep from 135deg to 405deg (270 degrees of travel).
    function ang(v) { return (135 + 270 * (v / max)) * Math.PI / 180; }
    // Danger arc.
    if (dangerFrom !== null && dangerFrom !== undefined) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - 5, ang(dangerFrom), ang(max));
      ctx.lineWidth = 4; ctx.strokeStyle = '#d8433a'; ctx.stroke();
    }
    // Ticks + numerals.
    ctx.fillStyle = '#cfe8ff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var v = 0; v <= max; v += majorEvery) {
      var a = ang(v);
      var x1 = cx + Math.cos(a) * (R - 10), y1 = cy + Math.sin(a) * (R - 10);
      var x2 = cx + Math.cos(a) * (R - 3), y2 = cy + Math.sin(a) * (R - 3);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = 2; ctx.strokeStyle = '#9fd8ff'; ctx.stroke();
      var tx = cx + Math.cos(a) * (R - 22), ty = cy + Math.sin(a) * (R - 22);
      ctx.fillText(String(v), tx, ty);
    }
    // Needle.
    var na = ang(Math.max(0, Math.min(value, max)));
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(na) * 8, cy - Math.sin(na) * 8);
    ctx.lineTo(cx + Math.cos(na) * (R - 14), cy + Math.sin(na) * (R - 14));
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffb52e'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb52e'; ctx.fill();
    // Label + digital value.
    ctx.fillStyle = '#7fa8c4';
    ctx.font = '10px monospace';
    ctx.fillText(label, cx, cy + R - 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(String(Math.round(value)), cx, cy + 20);
  }

  // Artificial horizon strip: sky/ground split that rolls and pitches.
  function drawHorizon(ctx, w, h, pitch, roll) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-roll);
    var off = pitch * 110;
    ctx.fillStyle = '#2e7fb8';
    ctx.fillRect(-w, -h * 2 + off, w * 2, h * 2);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(-w, off, w * 2, h * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w, off - 1, w * 2, 2);
    // Pitch ladder lines.
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (var i = -2; i <= 2; i++) {
      if (i === 0) continue;
      var y = off - i * 18;
      ctx.fillRect(-16, y, 32, 1.5);
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffb52e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 34, h / 2); ctx.lineTo(w / 2 - 10, h / 2); ctx.lineTo(w / 2, h / 2 + 6);
    ctx.lineTo(w / 2 + 10, h / 2); ctx.lineTo(w / 2 + 34, h / 2);
    ctx.stroke();
    ctx.strokeStyle = '#2b3d4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  function createHUD() {
    var spd = el('gauge-speed').getContext('2d');
    var alt = el('gauge-alt').getContext('2d');
    var hor = el('horizon').getContext('2d');
    var msgEl = el('msg');
    var msgText = '', msgUntil = 0;

    var hud = {
      showMessage: function (text, now) {
        msgText = text;
        msgUntil = now + 2.8;
        msgEl.textContent = text;
        msgEl.style.opacity = '1';
      },
      // s: { altFt, speedKt, headingDeg, throttle, ringIndex, ringTotal,
      //      elapsed, score, pitch, roll, finished, now }
      update: function (s) {
        el('ro-alt').textContent = Math.round(s.altFt) + ' FT';
        el('ro-spd').textContent = Math.round(s.speedKt) + ' KT';
        el('ro-hdg').textContent = pad3(s.headingDeg);
        el('ro-ring').textContent = s.finished ? 'FINAL' : ('RING ' + s.ringIndex + '/' + s.ringTotal);
        el('ro-time').textContent = fmtTime(s.elapsed);
        el('ro-score').textContent = s.score;
        el('thr-fill').style.width = Math.round(s.throttle * 100) + '%';
        el('thr-val').textContent = Math.round(s.throttle * 100) + '%';
        drawGauge(spd, 150, s.speedKt, 140, 'AIRSPEED KT', 20, 118);
        drawGauge(alt, 150, s.altFt % 1000, 1000, 'ALTIMETER FT', 100, null);
        drawHorizon(hor, 230, 70, s.pitch, s.roll);
        if (msgText && s.now > msgUntil) {
          msgEl.style.opacity = '0';
          msgText = '';
        }
      }
    };
    return hud;
  }

  SKY.createHUD = createHUD;
  SKY.fmtTime = fmtTime;
})();
