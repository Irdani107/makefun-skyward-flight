// SKYWARD — the aeroplane and its arcade flight model.
// Low-poly single-prop plane built from three.js primitives.
// Conventions: forward is +Z in local space; yaw around Y, pitch is
// nose-up positive, roll is right-bank positive. Mesh rotation order YXZ.
window.SKY = window.SKY || {};

(function () {
  'use strict';

  var STALL_SPEED = 16;      // m/s
  var ROTATE_SPEED = 21;     // m/s needed to lift off
  var MAX_SPEED = 60;        // m/s at full throttle, level

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  function buildMesh() {
    var grp = new THREE.Group();
    var cream = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.55, metalness: 0.08 });
    var red = new THREE.MeshStandardMaterial({ color: 0xd8433a, roughness: 0.5, metalness: 0.08 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x22282e, roughness: 0.4, metalness: 0.3 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x1d2f42, roughness: 0.12, metalness: 0.55 });

    // Fuselage: tapered cylinder along Z + rounded nose.
    var fus = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.26, 4.4, 12), cream);
    fus.rotation.x = Math.PI / 2;
    grp.add(fus);
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), red);
    nose.position.set(0, 0, 2.2);
    nose.scale.set(1, 1, 0.9);
    grp.add(nose);
    var tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.1, 1.1, 10), cream);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.set(0, 0.08, -2.65);
    grp.add(tailCone);

    // Main wing (high wing) with red tips.
    var wing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.11, 1.35), cream);
    wing.position.set(0, 0.62, 0.35);
    grp.add(wing);
    var tipGeo = new THREE.BoxGeometry(0.9, 0.12, 1.35);
    var tipL = new THREE.Mesh(tipGeo, red); tipL.position.set(3.55, 0.62, 0.35); grp.add(tipL);
    var tipR = new THREE.Mesh(tipGeo, red); tipR.position.set(-3.55, 0.62, 0.35); grp.add(tipR);
    // Wing struts.
    var strutGeo = new THREE.BoxGeometry(0.07, 0.75, 0.07);
    var s1 = new THREE.Mesh(strutGeo, dark); s1.position.set(1.15, 0.28, 0.35); s1.rotation.z = 0.5; grp.add(s1);
    var s2 = new THREE.Mesh(strutGeo, dark); s2.position.set(-1.15, 0.28, 0.35); s2.rotation.z = -0.5; grp.add(s2);

    // Tailplane + fin.
    var tail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.09, 0.85), red);
    tail.position.set(0, 0.18, -3.05);
    grp.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.85), red);
    fin.position.set(0, 0.62, -3.05);
    grp.add(fin);

    // Canopy.
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), glass);
    canopy.position.set(0, 0.48, 0.95);
    canopy.scale.set(0.82, 0.62, 1.5);
    grp.add(canopy);

    // Propeller: spinner + two blade boxes + translucent blur disc.
    var prop = new THREE.Group();
    prop.position.set(0, 0, 2.72);
    var spinner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), red);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.18;
    prop.add(spinner);
    var bladeGeo = new THREE.BoxGeometry(0.16, 2.5, 0.05);
    var b1 = new THREE.Mesh(bladeGeo, dark); prop.add(b1);
    var b2 = new THREE.Mesh(bladeGeo, dark); b2.rotation.z = Math.PI / 2; prop.add(b2);
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.position.z = -0.03;
    prop.add(disc);
    grp.add(prop);

    // Navigation lights: port (+X) red, starboard (-X) green, tail white.
    var navGeo = new THREE.SphereGeometry(0.1, 8, 6);
    var navL = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
    navL.position.set(4.0, 0.62, 0.35); grp.add(navL);
    var navR = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
    navR.position.set(-4.0, 0.62, 0.35); grp.add(navR);
    var navT = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    navT.position.set(0, 0.2, -3.5); grp.add(navT);

    // Fixed landing gear: two main wheels + tail wheel.
    var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12);
    var w1 = new THREE.Mesh(wheelGeo, dark); w1.rotation.z = Math.PI / 2; w1.position.set(0.85, -0.78, 0.55); grp.add(w1);
    var w2 = new THREE.Mesh(wheelGeo, dark); w2.rotation.z = Math.PI / 2; w2.position.set(-0.85, -0.78, 0.55); grp.add(w2);
    var w3 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10), dark);
    w3.rotation.z = Math.PI / 2; w3.position.set(0, -0.42, -2.9); grp.add(w3);
    var legGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
    var l1 = new THREE.Mesh(legGeo, dark); l1.position.set(0.8, -0.45, 0.55); grp.add(l1);
    var l2 = new THREE.Mesh(legGeo, dark); l2.position.set(-0.8, -0.45, 0.55); grp.add(l2);

    grp.traverse(function (o) { o.frustumCulled = false; });
    return { group: grp, prop: prop };
  }
  // ------------------------------------------------------------------
  // The plane object: state + flight model + chase camera.
  // input = { pitch: -1..1, roll: -1..1, throttleDelta: -1..1 }
  // ------------------------------------------------------------------
  function createPlane(scene) {
    var built = buildMesh();
    var group = built.group;
    group.rotation.order = 'YXZ';
    scene.add(group);

    var plane = {
      group: group,
      prop: built.prop,
      yaw: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0,
      vy: 0,               // smoothed vertical speed, m/s
      grounded: true,
      stalled: false,
      contact: null,       // filled on ground contact while airborne
      propAngle: 0,

      reset: function (runway) {
        var backX = runway.cx - runway.dirX * (runway.length / 2 - 20);
        var backZ = runway.cz - runway.dirZ * (runway.length / 2 - 20);
        group.position.set(backX, runway.elev + 1.25, backZ);
        this.yaw = runway.heading;
        this.pitch = 0; this.roll = 0;
        this.speed = 0; this.throttle = 0;
        this.vy = 0; this.grounded = true; this.stalled = false;
        this.contact = null;
        this.syncMesh();
      },

      // Directly set state (used by the screenshot poses).
      pose: function (o) {
        group.position.set(o.x, o.y, o.z);
        this.yaw = o.yaw || 0;
        this.pitch = o.pitch || 0;
        this.roll = o.roll || 0;
        this.speed = o.speed || 0;
        this.throttle = o.throttle || 0;
        this.vy = o.vy || 0;
        this.grounded = false; this.stalled = false; this.contact = null;
        this.syncMesh();
      },

      forward: function () {
        var cp = Math.cos(this.pitch);
        return new THREE.Vector3(
          Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      },

      syncMesh: function () {
        group.rotation.set(-this.pitch, this.yaw, this.roll);
      },

      spinProp: function (dt) {
        this.propAngle += dt * (4 + this.throttle * 55 + this.speed * 0.35);
        this.prop.rotation.z = this.propAngle;
      },

      update: function (dt, input, world) {
        var pos = group.position;
        this.contact = null;

        // Throttle.
        this.throttle = clamp(this.throttle + (input.throttleDelta || 0) * dt * 0.55, 0, 1);

        // Control authority fades at low speed; stall behaviour below.
        var authority = clamp(this.speed / 22, 0.22, 1);
        this.stalled = !this.grounded && this.speed < STALL_SPEED;

        // Roll: ease toward the commanded bank.
        var targetRoll = (input.roll || 0) * 1.12;
        this.roll += (targetRoll - this.roll) * Math.min(1, dt * 5.2);

        // Pitch: commanded rate; in a stall the nose drops on its own.
        if (this.grounded) {
          // On the ground the nose only lifts past rotate speed.
          var want = (this.speed >= ROTATE_SPEED) ? (input.pitch || 0) * 0.5 : 0;
          this.pitch += (want - this.pitch) * Math.min(1, dt * 4);
          if (this.pitch < 0) this.pitch = 0;
        } else if (this.stalled) {
          this.pitch += (-0.38 - this.pitch) * Math.min(1, dt * 1.6);
        } else {
          this.pitch = clamp(this.pitch + (input.pitch || 0) * 1.05 * authority * dt, -0.85, 0.85);
        }

        // Banked turn: bank angle yaws the nose (weaker at low speed).
        var turnFactor = clamp(26 / Math.max(this.speed, 14), 0.5, 1.6);
        if (!this.grounded) {
          this.yaw -= Math.sin(this.roll) * 1.12 * turnFactor * dt;
        } else {
          // Gentle steering while rolling on the ground.
          this.yaw -= (input.roll || 0) * 0.45 * dt * clamp(this.speed / 18, 0, 1);
        }

        // Speed: engine thrust vs drag vs gravity along the flight path.
        var thrust = this.throttle * 23;
        var drag = 0.0062 * this.speed * this.speed + 1.1;
        var grav = 9.8 * Math.sin(this.pitch) * (this.grounded ? 0 : 1);
        this.speed = clamp(this.speed + (thrust - drag - grav) * dt, 0, MAX_SPEED + 14);
        if (this.grounded && this.throttle === 0) this.speed = Math.max(0, this.speed - 9 * dt);

        // Move along the flight path.
        var prevY = pos.y;
        var f = this.forward();
        pos.addScaledVector(f, this.speed * dt);
        if (this.stalled) pos.y -= (STALL_SPEED - this.speed) * 0.5 * dt;
        var rawVy = dt > 0 ? (pos.y - prevY) / dt : 0;
        this.vy += (rawVy - this.vy) * Math.min(1, dt * 7);

        // Ground / sea contact.
        var th = world.terrainHeight(pos.x, pos.z);
        var groundY = Math.max(th, 0) + 1.25;
        if (pos.y <= groundY) {
          pos.y = groundY;
          if (this.grounded) {
            // Still rolling: leave the ground only with pitch + speed.
            if (this.pitch > 0.1 && this.speed >= ROTATE_SPEED) {
              this.grounded = false;
            }
          } else {
            // Touchdown while airborne: describe it for the judge in main.
            var R = world.runway;
            var dx = pos.x - R.cx, dz = pos.z - R.cz;
            var u = dx * R.dirX + dz * R.dirZ;
            var v = -dx * R.dirZ + dz * R.dirX;
            this.contact = {
              onRunway: Math.abs(u) <= R.length / 2 && Math.abs(v) <= R.width / 2 + 5,
              overWater: th < 0.2,
              descent: -this.vy,
              speed: this.speed,
              roll: this.roll,
              gentle: -this.vy < 4.2 && Math.abs(this.roll) < 0.42 && this.speed < 40
            };
            this.grounded = true;
          }
        } else if (this.grounded && pos.y > groundY + 0.4) {
          this.grounded = false;
        }

        this.syncMesh();
        this.spinProp(dt);
      }
    };
    return plane;
  }

  // Smooth chase camera: behind and above, looking ahead of the nose.
  var _off = new THREE.Vector3();
  var _want = new THREE.Vector3();
  var _look = new THREE.Vector3();
  function updateChaseCamera(camera, plane, dt, snap) {
    _off.set(0, 4.4, -13.2).applyQuaternion(plane.group.quaternion);
    _want.copy(plane.group.position).add(_off);
    if (snap) camera.position.copy(_want);
    else {
      var k = 1 - Math.exp(-dt * 4.2);
      camera.position.lerp(_want, k);
    }
    _look.copy(plane.group.position)
      .addScaledVector(plane.forward(), 20)
      .add(_off.set(0, 1.6, 0));
    camera.lookAt(_look);
  }

  SKY.createPlane = createPlane;
  SKY.updateChaseCamera = updateChaseCamera;
  SKY.STALL_SPEED = STALL_SPEED;
})();
