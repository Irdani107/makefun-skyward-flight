// SKYWARD — Meridian Coast: boot, input, state machine, game loop.
// States: title (orbit backdrop) -> playing <-> paused -> crashed /
// landed overlays. URL hash options: demo=1 flies the course on
// autopilot; shot=1|2|3 opens a posed, frozen screenshot scene.
window.SKY = window.SKY || {};

(function () {
  'use strict';

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function el(id) { return document.getElementById(id); }

  var hash = {};
  (location.hash || '').slice(1).split('&').forEach(function (kv) {
    var p = kv.split('=');
    if (p.length === 2) hash[p[0]] = p[1];
  });
  var DEMO = hash.demo === '1';
  var SHOT = parseInt(hash.shot || '0', 10);

  // ---- Boot -------------------------------------------------------------
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  el('app').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 9000);

  var world = SKY.buildWorld(scene);
  var plane = SKY.createPlane(scene);
  var course = SKY.createCourse(scene, world);
  var hud = SKY.createHUD();
  plane.reset(world.runway);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- Input ------------------------------------------------------------
  var keys = {};
  var mouse = { x: 0, y: 0, on: true };
  window.addEventListener('keydown', function (e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    keys[e.code] = true;
    if (e.code === 'KeyM') mouse.on = !mouse.on;
    if (e.code === 'Enter' && state === 'title') startFlight();
    if (e.code === 'KeyP' && (state === 'playing' || state === 'paused')) {
      setState(state === 'playing' ? 'paused' : 'playing');
    }
    if (e.code === 'KeyR' && (state === 'crashed' || state === 'landed' || state === 'playing')) startFlight();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('mousemove', function (e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
  el('ov-title').addEventListener('click', function () { if (state === 'title') startFlight(); });

  function readInput() {
    var pitch = 0, roll = 0;
    if (keys.ArrowUp || keys.KeyW) pitch += 1;
    if (keys.ArrowDown || keys.KeyS) pitch -= 1;
    if (keys.ArrowRight || keys.KeyD) roll += 1;
    if (keys.ArrowLeft || keys.KeyA) roll -= 1;
    if (mouse.on && state === 'playing' && !DEMO) {
      if (Math.abs(mouse.y) > 0.05 && pitch === 0) pitch = clamp(-mouse.y * 1.7, -1, 1);
      if (Math.abs(mouse.x) > 0.05 && roll === 0) roll = clamp(mouse.x * 1.8, -1, 1);
    }
    var thr = 0;
    if (keys.ShiftLeft || keys.ShiftRight) thr += 1;
    if (keys.ControlLeft || keys.ControlRight) thr -= 1;
    return { pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1), throttleDelta: thr };
  }

  // ---- State machine ------------------------------------------------------
  var state = 'title';
  var elapsed = 0;
  var orbitAngle = 0;

  function showOverlay(id) {
    ['ov-title', 'ov-pause', 'ov-crash', 'ov-landed'].forEach(function (o) {
      el(o).classList.toggle('hidden', o !== id);
    });
  }
  function setState(s) {
    state = s;
    if (s === 'title') showOverlay('ov-title');
    else if (s === 'paused') showOverlay('ov-pause');
    else if (s === 'crashed') showOverlay('ov-crash');
    else if (s === 'landed') showOverlay('ov-landed');
    else showOverlay(null);
  }

  function startFlight() {
    plane.reset(world.runway);
    course.reset();
    elapsed = 0;
    setState('playing');
    SKY.updateChaseCamera(camera, plane, 0, true);
    hud.showMessage('Take off — fly the glowing rings', performance.now() / 1000);
  }

  function crash(reason) {
    el('crash-reason').textContent = reason;
    setState('crashed');
  }

  function land() {
    var grade = course.grade(elapsed);
    var score = course.finalScore(elapsed);
    el('land-stats').textContent =
      'Time ' + SKY.fmtTime(elapsed) + ' · Score ' + score + ' · Grade ' + grade;
    setState('landed');
  }

  // Judge a touchdown (contact made while airborne).
  function judgeContact(c) {
    if (!c.gentle) {
      if (c.overWater) crash('Ditched in the sea.');
      else if (c.descent >= 4.2) crash('Hard impact — the descent was too steep.');
      else if (Math.abs(c.roll) >= 0.42) crash('Touched down with the wings not level.');
      else crash('Came in too fast to land.');
      return;
    }
    if (!c.onRunway) {
      if (c.overWater) crash('Ditched in the sea.');
      else crash('Came down off the runway.');
      return;
    }
    if (course.finished) land();
    // Otherwise it is a gentle runway touch: the plane is rolling again
    // and may take off and continue the course.
  }
  // ---- Demo autopilot -----------------------------------------------------
  // Steers through the rings, then flies the final approach to the runway.
  var _tgt = new THREE.Vector3();
  function autopilotInput() {
    var pos = plane.group.position;
    var R = world.runway;
    var finalLeg = course.finished;
    if (!finalLeg) {
      _tgt.copy(course.rings[course.index].center);
    } else {
      // Approach fix behind the threshold, then the threshold itself.
      var fixX = R.cx - R.dirX * (R.length / 2 + 250);
      var fixZ = R.cz - R.dirZ * (R.length / 2 + 250);
      var dFix = Math.hypot(pos.x - fixX, pos.z - fixZ);
      if (dFix > 90) _tgt.set(fixX, R.elev + 42, fixZ);
      else _tgt.set(R.cx - R.dirX * (R.length / 2 - 30), R.elev + 2, R.cz - R.dirZ * (R.length / 2 - 30));
    }
    var dx = _tgt.x - pos.x, dy = _tgt.y - pos.y, dz = _tgt.z - pos.z;
    var distXZ = Math.hypot(dx, dz);
    var wantYaw = Math.atan2(dx, dz);
    var err = wantYaw - plane.yaw;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    var roll = clamp(-err * 1.5, -1, 1);
    var wantPitch = clamp(Math.atan2(dy, Math.max(distXZ, 20)), -0.42, 0.5);
    var pitch = clamp((wantPitch - plane.pitch) * 2.4, -1, 1);
    // Throttle: cruise fast, slow on final, spool up on the ground.
    // (Applied directly by applyAutoThrottle, so throttleDelta stays 0.)
    var wantSpeed = finalLeg ? 27 : 40;
    if (plane.grounded) wantSpeed = 34;
    if (plane.grounded && plane.speed < 23) { pitch = 0; if (plane.speed > 21) pitch = 0.7; }
    return { pitch: pitch, roll: roll, throttleDelta: 0, autoThrottle: wantSpeed };
  }

  // The autopilot sets throttle toward a target speed directly.
  function applyAutoThrottle(input) {
    if (input.autoThrottle !== undefined) {
      var want = clamp(input.autoThrottle / SKY_SPEED_REF, 0, 1);
      plane.throttle += clamp(want - plane.throttle, -0.02, 0.02);
    }
  }
  var SKY_SPEED_REF = 60;

  // ---- Screenshot poses -----------------------------------------------------
  var shotMsg = null;
  function poseShot(n) {
    var R = world.runway;
    if (n === 1) {
      // Mid-course: two rings flown, chasing ring 3 at the lighthouse point.
      course.poseIndex(2, 500);
      elapsed = 63;
      plane.pose({ x: 505, y: 76, z: -55, yaw: Math.atan2(440 - 505, -250 + 55), pitch: 0.03, roll: -0.2, speed: 41, throttle: 0.8 });
      shotMsg = 'Ring 3 — the lighthouse point';
    } else if (n === 2) {
      // Low pass over the lit town: start south-west of the town centre on
      // the same heading, so the buildings fill the lower frame ahead.
      course.poseIndex(2, 500);
      elapsed = 41;
      plane.pose({ x: 148, y: 30, z: 506, yaw: 2.6, pitch: -0.02, roll: 0.1, speed: 44, throttle: 0.85 });
      shotMsg = 'Low over the town — Meridian shore';
    } else {
      // Final approach: course complete, lined up with the runway.
      course.poseIndex(8, 2000);
      elapsed = 187;
      plane.pose({
        x: R.cx - R.dirX * (R.length / 2 + 210), y: R.elev + 22,
        z: R.cz - R.dirZ * (R.length / 2 + 210),
        yaw: R.heading, pitch: -0.06, roll: 0, speed: 29, throttle: 0.38
      });
      shotMsg = 'Final: land on the runway';
    }
    SKY.updateChaseCamera(camera, plane, 0, true);
    setState('shot');
    showOverlay(null);
  }

  // ---- HUD state ------------------------------------------------------------
  function hudState(now) {
    var pos = plane.group.position;
    return {
      altFt: pos.y * 3.281,
      speedKt: plane.speed * 1.944,
      headingDeg: plane.yaw * 180 / Math.PI,
      throttle: plane.throttle,
      ringIndex: course.index,
      ringTotal: course.total,
      elapsed: elapsed,
      score: course.finished ? course.finalScore(elapsed) : course.score,
      pitch: plane.pitch,
      roll: plane.roll,
      finished: course.finished,
      now: now
    };
  }

  // ---- Main loop --------------------------------------------------------------
  var last = performance.now();
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var now = nowMs / 1000;
    var dt = Math.min((nowMs - last) / 1000, 0.05);
    last = nowMs;
    var t = now;

    if (state === 'title') {
      // Slow orbit around the island behind the title overlay.
      orbitAngle += dt * 0.03;
      camera.position.set(Math.cos(orbitAngle) * 520, 130, Math.sin(orbitAngle) * 520);
      camera.lookAt(0, 25, 0);
      course.refresh(t);
    } else if (state === 'playing') {
      elapsed += dt;
      var input = DEMO ? autopilotInput() : readInput();
      if (DEMO) applyAutoThrottle(input);
      plane.update(dt, input, world);
      if (plane.contact) judgeContact(plane.contact);
      if (state === 'playing') {
        course.update(dt, plane.group.position, t);
        if (course.event) hud.showMessage(course.event, now);
        SKY.updateChaseCamera(camera, plane, dt, false);
      }
      hud.update(hudState(now));
    } else if (state === 'shot') {
      // Frozen scene: only the propeller and the ring pulse stay alive.
      plane.spinProp(dt);
      course.refresh(t);
      if (shotMsg) hud.showMessage(shotMsg, now);
      hud.update(hudState(now));
    } else {
      // paused / crashed / landed: hold the last frame's world still.
      course.refresh(t);
      hud.update(hudState(now));
    }
    renderer.render(scene, camera);
  }

  if (SHOT >= 1 && SHOT <= 3) poseShot(SHOT);
  else if (DEMO) startFlight();
  else setState('title');
  requestAnimationFrame(frame);
})();
