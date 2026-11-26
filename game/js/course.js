// SKYWARD — the ring course and the landing check.
// Eight glowing rings on a route around the island. Only the next ring
// is bright and pulsing; passed rings dim. After ring 8 the finish is
// armed and the flight ends by landing on the runway.
window.SKY = window.SKY || {};

(function () {
  'use strict';

  var RING_RADIUS = 16;
  var POINTS_PER_RING = 250;

  // Route: [x, altitude, z] — lifted at build time to clear the terrain.
  var ROUTE = [
    [300, 68, 430],     // 1: over the inlet mouth, south-east
    [540, 72, 120],     // 2: east coast
    [440, 84, -250],    // 3: the lighthouse point, north-east
    [90, 120, -480],    // 4: high over the north shore
    [-320, 98, -390],   // 5: north-west
    [-540, 64, -30],    // 6: low on the west coast
    [-380, 54, 290],    // 7: south-west beach
    [-190, 78, -470]    // 8: north — sets up the final approach
  ];

  var MAT_NEXT = new THREE.MeshBasicMaterial({ color: 0xffb52e });
  var MAT_AHEAD = new THREE.MeshBasicMaterial({ color: 0x2e8fa8, transparent: true, opacity: 0.75 });
  var MAT_DONE = new THREE.MeshBasicMaterial({ color: 0x5a6a72, transparent: true, opacity: 0.3 });

  function createCourse(scene, world) {
    var rings = [];
    var group = new THREE.Group();
    scene.add(group);

    // The approach direction of each ring comes from the previous point
    // (the runway threshold for ring 1).
    var R = world.runway;
    var prev = new THREE.Vector3(
      R.cx - R.dirX * (R.length / 2), R.elev + 12, R.cz - R.dirZ * (R.length / 2));

    for (var i = 0; i < ROUTE.length; i++) {
      var x = ROUTE[i][0], z = ROUTE[i][2];
      var y = Math.max(ROUTE[i][1], world.terrainHeight(x, z) + 26);
      var center = new THREE.Vector3(x, y, z);
      var mesh = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.15, 10, 36), MAT_AHEAD);
      mesh.position.copy(center);
      var dir = center.clone().sub(prev).normalize();
      mesh.lookAt(center.clone().add(dir));
      group.add(mesh);
      rings.push({
        mesh: mesh, center: center,
        normal: dir, prevAxial: null
      });
      prev = center;
    }

    // A soft light pillar marks the next ring from far away.
    var pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 340, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffb52e, transparent: true, opacity: 0.1,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    scene.add(pillar);

    var course = {
      rings: rings,
      total: rings.length,
      index: 0,          // next ring to fly through (0-based)
      score: 0,
      finished: false,
      event: null,       // last event message for the HUD
      pulse: 0,

      reset: function () {
        this.index = 0;
        this.score = 0;
        this.finished = false;
        this.event = null;
        for (var i = 0; i < rings.length; i++) {
          rings[i].prevAxial = null;
          rings[i].mesh.material = MAT_AHEAD;
        }
        this.refresh(0);
      },

      // Set materials/pillar for the current state (also used by poses).
      refresh: function (t) {
        for (var i = 0; i < rings.length; i++) {
          if (i < this.index) rings[i].mesh.material = MAT_DONE;
          else if (i === this.index && !this.finished) rings[i].mesh.material = MAT_NEXT;
          else rings[i].mesh.material = MAT_AHEAD;
        }
        if (this.finished) {
          for (var j = 0; j < rings.length; j++) rings[j].mesh.material = MAT_DONE;
          pillar.visible = false;
        } else {
          pillar.visible = true;
          var c = rings[this.index].center;
          pillar.position.set(c.x, c.y, c.z);
          var s = 1 + Math.sin(t * 3.2) * 0.05;
          rings[this.index].mesh.scale.set(s, s, s);
        }
      },

      // Pose helper for screenshots: pretend n rings are already flown.
      poseIndex: function (n, elapsedScore) {
        this.index = n;
        this.score = elapsedScore || n * POINTS_PER_RING;
        this.finished = n >= rings.length;
        this.refresh(0);
      },

      update: function (dt, planePos, t) {
        this.event = null;
        if (this.finished) { this.refresh(t); return; }
        this.pulse = t;
        var ring = rings[this.index];
        var rel = planePos.clone().sub(ring.center);
        var axial = rel.dot(ring.normal);
        if (ring.prevAxial !== null && ring.prevAxial !== 0 && axial !== 0 &&
            Math.sign(axial) !== Math.sign(ring.prevAxial)) {
          // Crossed the ring plane this frame: inside the hoop?
          var radial = rel.clone().addScaledVector(ring.normal, -axial).length();
          if (radial < RING_RADIUS - 1) {
            this.index++;
            this.score += POINTS_PER_RING;
            ring.prevAxial = null;
            if (this.index >= rings.length) {
              this.finished = true;
              this.event = 'Course complete — final: land on the runway';
            } else {
              this.event = 'Ring ' + this.index + ' — +' + POINTS_PER_RING;
            }
            this.refresh(t);
            return;
          }
        }
        ring.prevAxial = axial;
        this.refresh(t);
      },

      // Grade a finished flight by total time (all rings collected).
      grade: function (elapsed) {
        if (elapsed <= 170) return 'S';
        if (elapsed <= 240) return 'A';
        if (elapsed <= 330) return 'B';
        return 'C';
      },
      finalScore: function (elapsed) {
        return this.score + Math.max(0, Math.round((420 - elapsed)) * 2);
      }
    };
    course.reset();
    return course;
  }

  SKY.createCourse = createCourse;
  SKY.RING_POINTS = POINTS_PER_RING;
})();
