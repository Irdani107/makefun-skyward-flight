// SKYWARD — Meridian Coast: world building.
// Procedural island coastline: heightfield terrain with a dome, a carved
// river inlet, a flattened runway strip, a shore town, a lighthouse,
// distant mountains, sea, sun and clouds. Everything is generated from
// code — no external assets.
window.SKY = window.SKY || {};

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Runway definition (also used to flatten the terrain).
  // Heading is in radians; the runway direction is (sin h, cos h) in xz.
  // ------------------------------------------------------------------
  var RUNWAY = {
    cx: -150, cz: 20,
    heading: 0.5,
    length: 280,
    width: 30
  };
  RUNWAY.dirX = Math.sin(RUNWAY.heading);
  RUNWAY.dirZ = Math.cos(RUNWAY.heading);

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  // Deterministic hash noise for colour jitter.
  function hash2(x, z) {
    var s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function distToSegment(px, pz, ax, az, bx, bz) {
    var abx = bx - ax, abz = bz - az;
    var t = ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz);
    t = clamp(t, 0, 1);
    var qx = ax + abx * t, qz = az + abz * t;
    return Math.hypot(px - qx, pz - qz);
  }

  // Raw island height before the runway flattening.
  function rawHeight(x, z) {
    var d = Math.hypot(x, z);
    // Main smooth dome, reaching sea level at d = 620.
    var domeT = clamp(1 - (d / 620) * (d / 620), 0, 1);
    var h = 52 * Math.pow(domeT, 1.6);
    // A secondary hill to the north-west for a broken silhouette.
    var hx = x + 230, hz = z + 190;
    h += 17 * Math.exp(-(hx * hx + hz * hz) / (2 * 135 * 135));
    // Gentle undulation, masked so the beaches stay smooth.
    var mask = clamp(h / 30, 0, 1);
    h += mask * 5.5 * Math.sin(x * 0.013 + 1.7) * Math.cos(z * 0.017 - 0.6);
    // River inlet carved into the south-east shore: a channel running
    // from the island's waist out to the sea.
    var inlet = distToSegment(x, z, 140, 210, 430, 470);
    h -= 21 * Math.exp(-(inlet * inlet) / (48 * 48));
    // Seabed falloff outside the island.
    if (h <= 0) h = Math.max(h - (d - 620) * 0.012, -13);
    return h;
  }

  var runwayElev = rawHeight(RUNWAY.cx, RUNWAY.cz);
  RUNWAY.elev = runwayElev;

  // Public terrain height: raw height blended flat inside the runway pad.
  function terrainHeight(x, z) {
    var h = rawHeight(x, z);
    var dx = x - RUNWAY.cx, dz = z - RUNWAY.cz;
    var u = dx * RUNWAY.dirX + dz * RUNWAY.dirZ;   // along runway
    var v = -dx * RUNWAY.dirZ + dz * RUNWAY.dirX;  // across runway
    var fu = 1 - smoothstep(RUNWAY.length / 2 + 20, RUNWAY.length / 2 + 120, Math.abs(u));
    var fv = 1 - smoothstep(RUNWAY.width / 2 + 16, RUNWAY.width / 2 + 90, Math.abs(v));
    var w = fu * fv;
    return h * (1 - w) + runwayElev * w;
  }

  // ------------------------------------------------------------------
  // Canvas texture for the town facades: dark walls, lit windows.
  // ------------------------------------------------------------------
  function makeFacadeTexture() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#2b333f';
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#232a34';
    g.fillRect(0, 0, 128, 18);
    var cols = 6, rows = 12, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var x = 10 + col * 19, y = 28 + r * 18;
        var lit = rnd();
        if (lit < 0.42) g.fillStyle = '#ffc46b';       // warm lit window
        else if (lit < 0.55) g.fillStyle = '#bfe3ff';  // cool lit window
        else g.fillStyle = '#171d24';                  // dark window
        g.fillRect(x, y, 11, 12);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Radial-gradient sprite texture for the lighthouse glow.
  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,214,140,0.95)');
    grad.addColorStop(0.35, 'rgba(255,190,100,0.35)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  // ------------------------------------------------------------------
  // Build everything into the scene.
  // Returns { terrainHeight, runway, townPos, lighthousePos }.
  // ------------------------------------------------------------------
  function buildWorld(scene) {
    scene.background = new THREE.Color(0x8fc3e8);
    scene.fog = new THREE.Fog(0xcfe0ea, 700, 5200);

    // Light: warm sun + sky hemisphere.
    var sun = new THREE.DirectionalLight(0xffe3b3, 2.6);
    sun.position.set(900, 1150, 520);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x51683f, 0.95));

    // Visible sun disc.
    var sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(95, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false })
    );
    sunDisc.position.set(2500, 3200, 1450);
    sunDisc.lookAt(0, 0, 0);
    scene.add(sunDisc);

    // Sea.
    var sea = new THREE.Mesh(
      new THREE.CircleGeometry(3800, 48),
      new THREE.MeshStandardMaterial({ color: 0x1b6d8f, roughness: 0.3, metalness: 0.05 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    scene.add(sea);

    // Island terrain: displaced plane with vertex colours.
    var SIZE = 1700, SEG = 150;
    var geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var i, x, z;
    for (i = 0; i < pos.count; i++) {
      x = pos.getX(i); z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    var nrm = geo.attributes.normal;
    var colors = new Float32Array(pos.count * 3);
    var cSand = new THREE.Color(0xd9c28f), cWet = new THREE.Color(0x8a7a58);
    var cGrass = new THREE.Color(0x5d8f4e), cGrass2 = new THREE.Color(0x77a24f);
    var cRock = new THREE.Color(0x8a8578), cHigh = new THREE.Color(0xa9a294);
    var tmp = new THREE.Color();
    for (i = 0; i < pos.count; i++) {
      var h = pos.getY(i), ny = nrm.getY(i);
      var j = hash2(pos.getX(i), pos.getZ(i));
      if (h < 0.4) tmp.copy(cWet);
      else if (h < 2.6) tmp.copy(cSand);
      else if (ny < 0.74 || h > 36) tmp.copy(cRock);
      else if (h > 54) tmp.copy(cHigh);
      else tmp.copy(cGrass).lerp(cGrass2, j);
      if (ny < 0.86 && h >= 2.6 && h <= 36) tmp.lerp(cRock, 0.45);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0
    }));
    scene.add(terrain);

    buildRunway(scene);
    var townPos = buildTown(scene);
    var lighthousePos = buildLighthouse(scene);
    buildMountains(scene);
    buildClouds(scene);

    return {
      terrainHeight: terrainHeight,
      runway: RUNWAY,
      townPos: townPos,
      lighthousePos: lighthousePos
    };
  }

  // ------------------------------------------------------------------
  // Runway: asphalt strip, centreline dashes, threshold bars, lights.
  // ------------------------------------------------------------------
  function buildRunway(scene) {
    var R = RUNWAY;
    var grp = new THREE.Group();
    grp.position.set(R.cx, R.elev + 0.12, R.cz);
    grp.rotation.y = R.heading;
    var L = R.length, W = R.width;

    var strip = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.24, L),
      new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.95 })
    );
    grp.add(strip);

    var white = new THREE.MeshBasicMaterial({ color: 0xf4f6f2 });
    var dashGeo = new THREE.BoxGeometry(0.7, 0.26, 9);
    for (var d = -L / 2 + 26; d < L / 2 - 20; d += 24) {
      var dash = new THREE.Mesh(dashGeo, white);
      dash.position.set(0, 0.02, d);
      grp.add(dash);
    }
    // Threshold bars at both ends.
    var barGeo = new THREE.BoxGeometry(1.1, 0.26, 7);
    for (var e = -1; e <= 1; e += 2) {
      for (var b = -3; b <= 3; b++) {
        if (b === 0) continue;
        var bar = new THREE.Mesh(barGeo, white);
        bar.position.set(b * 3.4, 0.02, e * (L / 2 - 9));
        grp.add(bar);
      }
    }
    // Edge lights (amber) and green threshold lights.
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    var thrMat = new THREE.MeshBasicMaterial({ color: 0x51ff7a });
    var lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
    for (var s = -L / 2 + 8; s <= L / 2 - 8; s += 22) {
      for (var side = -1; side <= 1; side += 2) {
        var li = new THREE.Mesh(lightGeo, edgeMat);
        li.position.set(side * (W / 2 + 1.6), 0.55, s);
        grp.add(li);
      }
    }
    for (var t = -3; t <= 3; t++) {
      var tg = new THREE.Mesh(lightGeo, thrMat);
      tg.position.set(t * 3.4, 0.55, -L / 2 - 1.5);
      grp.add(tg);
    }
    scene.add(grp);
  }

  // ------------------------------------------------------------------
  // Town: box buildings with lit windows clustered on the south shore.
  // ------------------------------------------------------------------
  function buildTown(scene) {
    var cx = 215, cz = 395;
    var tex = makeFacadeTexture();
    var mat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5,
      color: 0xbfc8d2, roughness: 0.9
    });
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 1 });
    var seed = 31;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 42; i++) {
      var a = rnd() * Math.PI * 2;
      var rad = 12 + rnd() * 78;
      var bx = cx + Math.cos(a) * rad * 1.25;
      var bz = cz + Math.sin(a) * rad * 0.8;
      var by = terrainHeight(bx, bz);
      if (by < 1.2) continue; // not in the water
      var w = 9 + rnd() * 9, dpt = 9 + rnd() * 9, hgt = 11 + rnd() * rnd() * 26;
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dpt), mat);
      b.position.set(bx, by + hgt / 2 - 0.4, bz);
      b.rotation.y = rnd() * Math.PI;
      scene.add(b);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.7, dpt + 0.8), roofMat);
      roof.position.set(bx, by + hgt - 0.05, bz);
      roof.rotation.y = b.rotation.y;
      scene.add(roof);
    }
    return new THREE.Vector3(cx, terrainHeight(cx, cz), cz);
  }

  // ------------------------------------------------------------------
  // Lighthouse on the north-east point.
  // ------------------------------------------------------------------
  function buildLighthouse(scene) {
    var lx = 430, lz = -250;
    var base = terrainHeight(lx, lz);
    var grp = new THREE.Group();
    grp.position.set(lx, base, lz);
    var whiteM = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.8 });
    var redM = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 });
    var darkM = new THREE.MeshStandardMaterial({ color: 0x22282e, roughness: 0.6 });
    var bands = [whiteM, redM, whiteM, redM];
    var y = 0;
    for (var i = 0; i < 4; i++) {
      var bh = i === 3 ? 4 : 5.2;
      var cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(3.1 - i * 0.28, 3.4 - i * 0.28, bh, 12), bands[i]);
      cyl.position.y = y + bh / 2;
      grp.add(cyl);
      y += bh;
    }
    var gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 1.1, 12), darkM);
    gallery.position.y = y + 0.55;
    grp.add(gallery);
    var lamp = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd98c })
    );
    lamp.position.y = y + 2.4;
    grp.add(lamp);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.9, 12), darkM);
    cap.position.y = y + 4.3;
    grp.add(cap);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.9
    }));
    glow.scale.set(26, 26, 1);
    glow.position.y = y + 2.4;
    grp.add(glow);
    scene.add(grp);
    return new THREE.Vector3(lx, base + y + 2.4, lz);
  }

  // Distant mountain cones across the water.
  function buildMountains(scene) {
    var mat = new THREE.MeshStandardMaterial({ color: 0x6f87a0, roughness: 1, flatShading: true });
    var seed = 97;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
      var dist = 2350 + rnd() * 800;
      var h = 280 + rnd() * 280;
      var cone = new THREE.Mesh(new THREE.ConeGeometry(240 + rnd() * 220, h, 6), mat);
      cone.position.set(Math.cos(a) * dist, h / 2 - 24, Math.sin(a) * dist);
      cone.rotation.y = rnd() * Math.PI;
      scene.add(cone);
    }
  }

  // Low-poly clouds: clusters of flattened spheres.
  function buildClouds(scene) {
    var mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.88
    });
    var seed = 53;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 13; i++) {
      var grp = new THREE.Group();
      var n = 3 + Math.floor(rnd() * 3);
      for (var j = 0; j < n; j++) {
        var r = 16 + rnd() * 22;
        var s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
        s.position.set((rnd() - 0.5) * 55, (rnd() - 0.5) * 7, (rnd() - 0.5) * 30);
        s.scale.y = 0.42;
        grp.add(s);
      }
      var a = rnd() * Math.PI * 2, dist = 260 + rnd() * 1500;
      grp.position.set(Math.cos(a) * dist, 195 + rnd() * 110, Math.sin(a) * dist);
      scene.add(grp);
    }
  }

  SKY.buildWorld = buildWorld;
  SKY.terrainHeight = terrainHeight;
  SKY.RUNWAY = RUNWAY;
})();
