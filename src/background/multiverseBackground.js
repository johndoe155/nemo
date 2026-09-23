/* =============================================================================
   Multiverse background runtime — extracted from multiverse-background-webgl-3.html

   Kept verbatim: both renderers (window.__runFallback2D and the WebGL2 build),
   every shader (VS_FULL, FS_BG, FS_HOLE, VS_SEG, FS_SEG, FS_DECAY, FS_TRAILC,
   VS_CARD, FS_CARD, VS_DUST, FS_DUST, FS_PRE, FS_DOWN, FS_UP, FS_FINAL),
   render targets, particle / dust / ember / card pools, and the quality governor.

   Not carried over: donor sections, copy, HUD, scroll-hint, split-text reveals,
   and the donor's own Lenis / wheel hijack. This page already has one scroller.

   Beat space is still 0…9 with the donor names, so the keyframe tables are
   unchanged. Anchors are measured from the live layout (see BEAT_SELECTOR).
   Density dims only while #nemoverse or #perks covers the viewport.
   ========================================================================== */

var BEAT_NAMES = ['hero', 'universes', 'perks', 'dissolve', 'color', 'burn', 'comet', 'constellation', 'pull', 'always'];
var BEAT_SELECTOR = {
  hero: '#top',
  universes: '#nemoverse',
  perks: '#perks',
  dissolve: '#pulls',
  color: '#store',
  burn: '#artists',
  comet: '#lore',
  constellation: '.signoff__crawl',
  pull: '#singularity',
  always: '#connect'
};
var DENSITY_SELECTORS = ['#nemoverse', '#perks'];

function mountClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function layoutBox(el) {
  var node = el;
  if (el.parentElement && el.parentElement.classList && el.parentElement.classList.contains('pin-spacer')) node = el.parentElement;
  var r = node.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height || node.offsetHeight || 1 };
}

function readBeatLayout() {
  var vh = window.innerHeight;
  var maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  var centers = new Array(BEAT_NAMES.length);
  for (var i = 0; i < BEAT_NAMES.length; i++) {
    var el = document.querySelector(BEAT_SELECTOR[BEAT_NAMES[i]]);
    if (!el) { centers[i] = null; continue; }
    var box = layoutBox(el);
    centers[i] = box.top + box.height / 2;
  }
  var known = -1;
  for (var k = 0; k < centers.length; k++) if (centers[k] != null) { known = k; break; }
  if (known < 0) {
    for (var e = 0; e < centers.length; e++) centers[e] = maxScroll * (e / (centers.length - 1));
  } else {
    if (known > 0) {
      for (var b = 0; b < known; b++) centers[b] = centers[known] * (b / known);
    }
    var cursor = known;
    while (cursor < centers.length) {
      if (centers[cursor] != null) { cursor++; continue; }
      var start = cursor - 1;
      var end = cursor + 1;
      while (end < centers.length && centers[end] == null) end++;
      var endVal = end < centers.length ? centers[end] : maxScroll;
      var span = end - start;
      var last = end < centers.length ? end : centers.length;
      for (var f = start + 1; f < last; f++) {
        centers[f] = centers[start] + (endVal - centers[start]) * ((f - start) / span);
      }
      cursor = end < centers.length ? end : centers.length;
    }
  }
  var anchors = new Array(centers.length);
  var prev = -1e9;
  for (var n = 0; n < centers.length; n++) {
    var a = mountClamp(centers[n] - vh / 2, 0, maxScroll);
    if (a < prev + 1) a = prev + 1;
    anchors[n] = a;
    prev = a;
  }
  return { vh: vh, maxScroll: maxScroll, centers: centers, anchors: anchors };
}

function mountMultiverseBackground(host, hooks) {
  hooks = hooks || {};
  var state = { disposed: false, rafs: [], unsubs: [], observers: [], gl: null, freeGL: null, lost: false };

  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    state.unsubs.push(function () { target.removeEventListener(type, fn, opts); });
  }
  function addEventListener(type, fn, opts) { listen(window, type, fn, opts); }
  function requestAnimationFrame(fn) {
    if (state.disposed) return 0;
    var id = window.requestAnimationFrame(function (t) {
      var idx = state.rafs.indexOf(id);
      if (idx >= 0) state.rafs.splice(idx, 1);
      if (!state.disposed) fn(t);
    });
    state.rafs.push(id);
    return id;
  }
  function cancelAnimationFrame(id) {
    var idx = state.rafs.indexOf(id);
    if (idx >= 0) state.rafs.splice(idx, 1);
    window.cancelAnimationFrame(id);
  }

  function instrumentGL(gl) {
    var made = { programs: [], shaders: [], textures: [], fbos: [], buffers: [], vaos: [] };
    function wrap(method, bucket) {
      var orig = gl[method].bind(gl);
      gl[method] = function () {
        var obj = orig.apply(gl, arguments);
        if (obj) made[bucket].push(obj);
        return obj;
      };
    }
    wrap('createProgram', 'programs');
    wrap('createShader', 'shaders');
    wrap('createTexture', 'textures');
    wrap('createFramebuffer', 'fbos');
    wrap('createBuffer', 'buffers');
    wrap('createVertexArray', 'vaos');
    state.freeGL = function () {
      made.vaos.forEach(function (o) { gl.deleteVertexArray(o); });
      made.fbos.forEach(function (o) { gl.deleteFramebuffer(o); });
      made.textures.forEach(function (o) { gl.deleteTexture(o); });
      made.buffers.forEach(function (o) { gl.deleteBuffer(o); });
      made.programs.forEach(function (o) { gl.deleteProgram(o); });
      made.shaders.forEach(function (o) { gl.deleteShader(o); });
    };
  }

  function bindDensity(onChange) {
    var dense = new Set();
    DENSITY_SELECTORS.forEach(function (sel, i) {
      var el = document.querySelector(sel);
      if (!el) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.45) dense.add(i);
          else dense.delete(i);
        });
        onChange(dense.size > 0 ? 1 : 0);
      }, { threshold: [0, 0.45, 1] });
      io.observe(el);
      state.observers.push(io);
    });
  }


  var hostHooks = hooks;


window.__runFallback2D = function () {
  'use strict';

  /* =====================================================================
     PHASED MULTIVERSE BACKGROUND
     Merges two donors into one scroll-driven system:
       • Donor A (flow-field particles)  -> #particles canvas  [kept faithful]
       • Donor B (cards + aura + scroll) -> #scene canvas
     Everything is driven by a single scrollProgress (0..1) fed through the
     keyframed TRACKS below. Tune those tables; the render code follows them.
  ===================================================================== */

  ['scene', 'particles'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  var glEl = document.getElementById('gl');
  if (glEl) glEl.style.display = 'none';
  var sceneC = document.getElementById('scene');
  var partC  = document.getElementById('particles');
  if (!sceneC || !partC) return;
  var sctx   = sceneC.getContext('2d');
  var pctx   = partC.getContext('2d');

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile     = window.matchMedia('(pointer: coarse)').matches;

  /* ---- palette (from both donors) ---------------------------------- */
  var palette = {
    ink:    '#0B0A14',
    plum:   '#1B1330',
    gold:   [232, 161, 92],
    violet: [139, 127, 232],
    rose:   [217, 115, 143],
    white:  [255, 255, 255]
  };

  /* ---- phase / subphase windows (single source of truth) ----------- */
  var WIN = {
    comet:        [0.66, 0.80],
    constellation:[0.80, 0.92],
    blackhole:    [0.92, 1.00]
  };

  /* ---- KEYFRAME TRACKS: scrollProgress -> value -------------------- *
     Each track is a sorted list of [position, value] stops.
     track()  interpolates scalars; trackColor() interpolates RGB.       */
  var T = {
    // particle count as a fraction of the (fixed, mobile-safe) pool
    fraction:  [[0,0.35],[0.33,0.42],[0.45,0.68],[0.66,0.80],[0.90,0.90],[1,1.00]],
    // particle line opacity
    opacity:   [[0,0.22],[0.33,0.30],[0.45,0.50],[0.66,0.62],[0.80,0.72],[1,0.85]],
    // base speed multiplier (comet/constellation/blackhole shaping)
    speed:     [[0,1],[0.64,1],[0.68,0.55],[0.80,0.50],[0.82,0.16],[0.90,0.16],[0.92,0.55],[1,0.70]],
    // white glow (shadowBlur, desktop only)
    glow:      [[0,0],[0.64,0],[0.72,8],[1,14]],
    // cards: overall opacity, and white->color mix
    cardOp:    [[0,1],[0.22,1],[0.34,0],[1,0]],
    cardColor: [[0,0],[0.10,0],[0.26,1],[1,1]],
    // scene aura strength, and black-hole darkening of the scene bg
    aura:      [[0,1],[0.66,1],[0.80,0.30],[1,0.15]],
    darken:    [[0,0],[0.80,0],[1,0.85]]
  };
  var COLOR_STOPS = [
    [0.00, palette.white], [0.44, palette.white],
    [0.50, palette.violet],[0.57, palette.gold],[0.64, palette.rose],
    [0.72, palette.white], [1.00, palette.white]
  ];

  /* ---- math helpers ------------------------------------------------ */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function wrap(v, min, max) { var r = max - min; return min + (((v - min) % r) + r) % r; }
  function inWin(p, w) { return p >= w[0] && p <= w[1]; }
  function winT(p, w) { return clamp((p - w[0]) / (w[1] - w[0]), 0, 1); }

  function track(stops, p) {
    if (p <= stops[0][0]) return stops[0][1];
    var last = stops[stops.length - 1];
    if (p >= last[0]) return last[1];
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        return lerp(a[1], b[1], smooth((p - a[0]) / (b[0] - a[0])));
      }
    }
    return last[1];
  }
  function trackColor(stops, p) {
    if (p <= stops[0][0]) return stops[0][1];
    var last = stops[stops.length - 1];
    if (p >= last[0]) return last[1];
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = smooth((p - a[0]) / (b[0] - a[0]));
        return [
          Math.round(lerp(a[1][0], b[1][0], t)),
          Math.round(lerp(a[1][1], b[1][1], t)),
          Math.round(lerp(a[1][2], b[1][2], t))
        ];
      }
    }
    return last[1];
  }

  /* ---- sizing ------------------------------------------------------ */
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    [sceneC, partC].forEach(function (c) {
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + 'px'; c.style.height = H + 'px';
    });
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =====================================================================
     SCENE CANVAS  (Donor B: gradient bg + aura + floating cards)
  ===================================================================== */
  var NUM_FRAMES = isMobile ? 14 : 22;
  var frames = [];
  var baseDrift = { x: -7, y: -3.2 };

  function pickColor() {
    var r = Math.random();
    if (r < 0.62) return palette.gold;
    if (r < 0.84) return palette.violet;
    return palette.rose;
  }
  function buildFrames() {
    frames = [];
    for (var i = 0; i < NUM_FRAMES; i++) {
      var z = 0.22 + Math.random() * 0.78;
      var w = lerp(34, 118, z);
      var h = w * (1.15 + Math.random() * 0.55);
      frames.push({
        id: 1 + i,
        x: Math.random() * (W * 1.5) - W * 0.25,
        y: Math.random() * (H * 1.5) - H * 0.25,
        z: z, w: w, h: h,
        rot: (Math.random() - 0.5) * 0.14,
        color: pickColor(),
        phase: Math.random() * Math.PI * 2
      });
    }
    frames.sort(function (a, b) { return a.z - b.z; });
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawAura(time, prog, auraStrength) {
    var cx = W * 0.5 + (mouse.x - 0.5) * 40;
    var cy = H * 0.46 + (mouse.y - 0.5) * 24;
    var pulse = 0.85 + Math.sin(time * 0.15) * 0.15;
    var r = Math.min(W, H) * 0.42 * pulse;

    var hueShift = clamp(prog + Math.sin(time * 0.08) * 0.04, 0, 1);
    var c1 = palette.gold, c2 = palette.violet, c3 = palette.rose, mixed;
    if (hueShift < 0.5) { var tt = hueShift / 0.5; mixed = [lerp(c1[0],c2[0],tt),lerp(c1[1],c2[1],tt),lerp(c1[2],c2[2],tt)]; }
    else { var t2 = (hueShift - 0.5) / 0.5; mixed = [lerp(c2[0],c3[0],t2),lerp(c2[1],c3[1],t2),lerp(c2[2],c3[2],t2)]; }
    mixed = mixed.map(function (v) { return Math.round(v); });

    var s = auraStrength * lerp(1, 0.45, density);
    var grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,   'rgba(' + mixed.join(',') + ',' + (0.16 * s) + ')');
    grad.addColorStop(0.5, 'rgba(' + mixed.join(',') + ',' + (0.06 * s) + ')');
    grad.addColorStop(1,   'rgba(' + mixed.join(',') + ',0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, W, H);
  }

  function drawFrame(f, time, driftMul, cardOp, colorMix) {
    var px = wrap(f.x + baseDrift.x * f.z * t * driftMul, -W * 0.25, W * 1.25);
    var py = wrap(f.y + baseDrift.y * f.z * t * driftMul, -H * 0.25, H * 1.25);
    var bob = Math.sin(time * 0.4 + f.phase) * 5 * f.z;
    var parallax = 46;
    var rx = px + (mouse.x - 0.5) * parallax * f.z;
    var ry = py + (mouse.y - 0.5) * parallax * f.z + bob;

    var densityMul = lerp(1, 0.4, density) * cardOp;
    var opacity = lerp(0.18, 0.8, f.z) * densityMul;

    // sub 1a -> 1b : cards start WHITE, then gain their palette color
    var c = [
      Math.round(lerp(255, f.color[0], colorMix)),
      Math.round(lerp(255, f.color[1], colorMix)),
      Math.round(lerp(255, f.color[2], colorMix))
    ];

    sctx.save();
    sctx.translate(rx, ry);
    sctx.rotate(f.rot);

    sctx.fillStyle = 'rgba(' + c.join(',') + ',' + ((0.03 + 0.05 * f.z) * densityMul) + ')';
    roundRect(sctx, -f.w / 2, -f.h / 2, f.w, f.h, 6); sctx.fill();

    sctx.lineWidth = lerp(0.5, 1.1, f.z);
    sctx.strokeStyle = 'rgba(' + c.join(',') + ',' + opacity + ')';
    roundRect(sctx, -f.w / 2, -f.h / 2, f.w, f.h, 6); sctx.stroke();

    if (f.z > 0.55) {
      sctx.font = '400 9px Georgia, serif';
      sctx.fillStyle = 'rgba(' + c.join(',') + ',' + (opacity * 0.9) + ')';
      sctx.fillText('\u2116 ' + String(f.id).padStart(3, '0'), -f.w / 2 + 8, f.h / 2 - 8);
    }
    sctx.restore();
  }

  function renderScene(time, prog, driftMul) {
    // base gradient, darkened toward black through the black-hole window
    var dk = track(T.darken, prog);
    var top = mixHex(palette.ink, '#000000', dk);
    var bot = mixHex(palette.plum, '#000000', dk);
    var bg = sctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, top); bg.addColorStop(1, bot);
    sctx.fillStyle = bg; sctx.fillRect(0, 0, W, H);

    drawAura(time, prog, track(T.aura, prog));

    var cardOp = track(T.cardOp, prog);
    if (cardOp > 0.001) {
      var colorMix = track(T.cardColor, prog);
      for (var i = 0; i < frames.length; i++) drawFrame(frames[i], time, driftMul, cardOp, colorMix);
    }

    // black-hole imitation: subtle central darkening (placeholder for real shader)
    if (inWin(prog, WIN.blackhole)) {
      var bt = winT(prog, WIN.blackhole);
      var g = sctx.createRadialGradient(W/2, H*0.5, 0, W/2, H*0.5, Math.min(W,H)*0.55);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.6 * bt) + ')');
      g.addColorStop(0.6, 'rgba(0,0,0,' + (0.25 * bt) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
    }
  }

  function mixHex(h1, h2, t) {
    var a = hex2rgb(h1), b = hex2rgb(h2);
    return 'rgb(' + Math.round(lerp(a[0],b[0],t)) + ',' + Math.round(lerp(a[1],b[1],t)) + ',' + Math.round(lerp(a[2],b[2],t)) + ')';
  }
  function hex2rgb(h) { h = h.replace('#',''); return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)]; }

  /* =====================================================================
     PARTICLE CANVAS  (Donor A: flow field — kept faithful)
     Pool is allocated ONCE at the mobile-safe max; phases only activate a
     fraction of it, so "more particles" never exceeds the tuned budget.
  ===================================================================== */
  var POOL = reduceMotion ? 0 : (isMobile ? 120 : 260);
  var particles = [];
  for (var i = 0; i < POOL; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      a: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.0,
      life: Math.random() * 200,
      isComet: (i % 7 === 0)            // ~15% eligible to streak in phase III
    });
  }

  // identical steering field to Donor A
  function noise(x, y, tt) {
    return Math.sin(x * 0.0025 + tt * 0.4) + Math.sin(y * 0.003 - tt * 0.3) +
           Math.sin((x + y) * 0.0018 + tt * 0.2);
  }

  function renderParticles(tt, prog) {
    if (POOL === 0) return;

    // trail fade — Donor A used source-over black @0.08; on this transparent
    // overlay we erase at the same rate so the scene shows through.
    pctx.globalCompositeOperation = 'destination-out';
    pctx.fillStyle = 'rgba(0,0,0,0.08)';
    pctx.fillRect(0, 0, W, H);
    pctx.globalCompositeOperation = 'lighter';

    var active   = Math.max(1, Math.floor(POOL * track(T.fraction, prog)));
    var opacity  = track(T.opacity, prog);
    var speedMul = track(T.speed, prog);
    var glow     = isMobile ? 0 : track(T.glow, prog);
    var col      = trackColor(COLOR_STOPS, prog);

    var cometOn = inWin(prog, WIN.comet);
    var constOn = inWin(prog, WIN.constellation);
    var holeOn  = inWin(prog, WIN.blackhole);
    var cx = W / 2, cy = H / 2;

    for (var i = 0; i < active; i++) {
      var p = particles[i];
      var angle = noise(p.x, p.y, tt) * 1.6;

      // mouse repel (Donor A)
      if (mouse.active) {
        var mdx = p.x - mouse.px, mdy = p.y - mouse.py;
        var md = Math.sqrt(mdx * mdx + mdy * mdy) + 0.001;
        if (md < 260) angle += Math.atan2(mdy, mdx) * (1 - md / 260) * 1.2;
      }

      // black-hole imitation: bias heading toward center
      if (holeOn) {
        var pull = winT(prog, WIN.blackhole) * 0.9;
        angle = lerp(angle, Math.atan2(cy - p.y, cx - p.x), pull * 0.4);
      }

      var thisSpeed = p.speed * speedMul;
      if (cometOn && p.isComet) thisSpeed = p.speed * 3.2; // comets punch through the slowed field

      var nx = p.x + Math.cos(angle) * thisSpeed;
      var ny = p.y + Math.sin(angle) * thisSpeed;

      var op = opacity;
      var lw = 1.35;
      var segX = nx, segY = ny;
      if (cometOn && p.isComet) {           // long bright streak + tail
        segX = p.x + Math.cos(angle) * thisSpeed * 6;
        segY = p.y + Math.sin(angle) * thisSpeed * 6;
        op = Math.min(1, opacity + 0.25);
        lw = 1.8;
      }

      pctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + op + ')';
      pctx.lineWidth = lw;
      if (glow > 0) { pctx.shadowColor = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.5)'; pctx.shadowBlur = glow; }

      pctx.beginPath();
      pctx.moveTo(p.x, p.y);
      pctx.lineTo(segX, segY);
      pctx.stroke();

      if (glow > 0) pctx.shadowBlur = 0;

      p.x = nx; p.y = ny; p.life--;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life < 0) {
        p.x = Math.random() * W; p.y = Math.random() * H; p.life = 150 + Math.random() * 150;
      }
    }

    // constellation: near-frozen field, capped nearest-neighbour links
    if (constOn) {
      var ct = winT(prog, WIN.constellation);
      var fade = Math.sin(ct * Math.PI);            // ease in and back out
      var K = isMobile ? 3 : 6;                      // neighbour window (bounds cost to O(n*K))
      var maxD = isMobile ? 110 : 140;
      pctx.lineWidth = 0.6;
      for (var a = 0; a < active; a++) {
        var pa = particles[a];
        for (var b = a + 1; b <= a + K && b < active; b++) {
          var pb = particles[b];
          var dx = pa.x - pb.x, dy = pa.y - pb.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) {
            var la = (1 - d / maxD) * 0.5 * fade;
            pctx.strokeStyle = 'rgba(255,255,255,' + la + ')';
            pctx.beginPath(); pctx.moveTo(pa.x, pa.y); pctx.lineTo(pb.x, pb.y); pctx.stroke();
          }
        }
      }
    }

    hud.count = active;
  }

  /* =====================================================================
     SHARED STATE: pointer, scroll, density
  ===================================================================== */
  var mouse = { x: 0.5, y: 0.5, px: -9999, py: -9999, active: false };
  var mouseTarget = { x: 0.5, y: 0.5 };
  addEventListener('mousemove', function (e) {
    mouseTarget.x = e.clientX / W; mouseTarget.y = e.clientY / H;
    mouse.px = e.clientX; mouse.py = e.clientY; mouse.active = true;
  });
  addEventListener('mouseout', function () { mouse.active = false; });

  var scrollProgress = 0, scrollVelocity = 0, lastScrollY = window.scrollY, speedBoost = 0;
  var density = 0, targetDensity = 0;
  bindDensity(function (v) { targetDensity = v; });

  addEventListener('scroll', function () {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    var hint = document.getElementById('scrollHint');
    if (hint) hint.style.opacity = scrollProgress > 0.03 ? '0' : '1';
  }, { passive: true });

  /* ---- HUD --------------------------------------------------------- */
  var hud = { count: 0 };
  var hudEl = document.getElementById('hud');
  var elPhase = document.getElementById('hudPhase'), elSub = document.getElementById('hudSub'),
      elScroll = document.getElementById('hudScroll'), elCount = document.getElementById('hudCount'),
      elBar = document.getElementById('hudBar');
  addEventListener('keydown', function (e) { if ((e.key === 'h' || e.key === 'H') && hudEl) hudEl.classList.toggle('hidden'); });

  function labelFor(p) {
    if (p < 0.33) return ['I', track(T.cardColor, p) < 0.5 ? 'cards · white' : 'cards · gaining color'];
    if (p < 0.66) {
      if (p < 0.45) return ['II', 'field · white'];
      return ['II', 'field · violet → gold → rose'];
    }
    if (inWin(p, WIN.comet)) return ['III', 'comet shower'];
    if (inWin(p, WIN.constellation)) return ['III', 'constellation'];
    return ['III', 'black-hole pull'];
  }
  var hudTick = 0;
  function updateHud(p) {
    if (!elPhase) return;
    if ((hudTick++ % 6) !== 0) return;      // throttle DOM writes
    var l = labelFor(p);
    elPhase.textContent = l[0]; elSub.textContent = l[1];
    elScroll.textContent = Math.round(p * 100) + '%';
    elCount.textContent = hud.count;
    elBar.style.width = (p * 100) + '%';
  }

  /* =====================================================================
     MAIN LOOP  (one rAF drives both canvases)
  ===================================================================== */
  var last = performance.now(), t = 0, ft = 0;

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!reduceMotion) {
      t += dt; ft += 0.008;
      mouse.x = lerp(mouse.x, mouseTarget.x, 0.04);
      mouse.y = lerp(mouse.y, mouseTarget.y, 0.04);

      var dy = window.scrollY - lastScrollY; lastScrollY = window.scrollY;
      scrollVelocity = lerp(scrollVelocity, dy, 0.3);
      speedBoost = lerp(speedBoost, clamp(Math.abs(scrollVelocity) / 40, 0, 3), 0.08);
      density = lerp(density, targetDensity, 0.06);
    }

    var driftMul = 1 + speedBoost;
    renderScene(t, scrollProgress, driftMul);
    renderParticles(ft, scrollProgress);
    updateHud(scrollProgress);

    requestAnimationFrame(loop);
  }

  /* ---- boot -------------------------------------------------------- */
  resize();
  buildFrames();
  addEventListener('resize', function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize(); buildFrames();
  });

  if (reduceMotion) {
    // static, accessible fallback
    var bg = sctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, palette.ink); bg.addColorStop(1, palette.plum);
    sctx.fillStyle = bg; sctx.fillRect(0, 0, W, H);
    updateHud(0);
  } else {
    requestAnimationFrame(loop);
  }
};

(function () {
  'use strict';

  /* =====================================================================
     MULTIVERSE BACKGROUND — WebGL2 / HDR build
     • Same palette, steering field, cards, phases and copy as the 2D build
     • Timeline is keyed to SECTIONS ("beats"), not page fraction
     • Pipeline: bg → dust → cards → [hole placeholder] → trails → links →
                 comets → HDR bloom → filmic finish (CA, grain, dither, vignette)
     • Black-hole lensing is intentionally NOT here — see BLACK HOLE HOOK.
  ===================================================================== */

  var doc = document.documentElement;
  var qs = new URLSearchParams(window.location.search);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(pointer: coarse)').matches;
  var glCanvas = document.getElementById('gl');
  if (!glCanvas) { fallback('no #gl canvas'); return; }

  function fallback(reason) {
    console.warn('[multiverse] using Canvas-2D fallback:', reason);
    if (glCanvas) glCanvas.style.display = 'none';
    ['scene', 'particles'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    window.__runFallback2D();
  }

  var gl = null;
  try {
    gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) {}
  if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
    fallback('WebGL2 + float render targets unavailable'); return;
  }
  instrumentGL(gl);

  /* ---- helpers --------------------------------------------------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function sstep(a, b, x) { return smooth(clamp((x - a) / (b - a), 0, 1)); }
  function wrap(v, min, max) { var r = max - min; return min + (((v - min) % r) + r) % r; }
  function rand() { return Math.random(); }

  /* ---- palette (unchanged) -------------------------------------------- */
  var palette = {
    ink: [11, 10, 20], plum: [27, 19, 48],
    gold: [232, 161, 92], violet: [139, 127, 232], rose: [217, 115, 143], white: [255, 255, 255]
  };

  /* =====================================================================
     BEATS — timeline anchored to sections
     Each <section data-beat="name"> is one beat. Scroll position is mapped
     piecewise-linearly to a continuous beat value b (0 … N-1), so adding or
     resizing sections never shifts the phases.
  ===================================================================== */
  /* Beats stay in the donor's 0…9 space so every track offset (B.color-.6,
     WIN.comet, etc.) resolves exactly. Anchors are this page's chapters,
     remeasured whenever layout moves — not the culled donor sections. */
  var B = { hero: 0, universes: 1, perks: 2, dissolve: 3, color: 4, burn: 5, comet: 6, constellation: 7, pull: 8, always: 9 };
  var NB = 10;
  var vh = window.innerHeight, maxScroll = 0;
  var anchors = [], secCenter = [];
  function measure() {
    var layout = readBeatLayout();
    vh = layout.vh;
    maxScroll = layout.maxScroll;
    anchors = layout.anchors;
    secCenter = layout.centers;
  }
  function beatAt(y) {
    if (y <= anchors[0]) return 0;
    for (var i = 1; i < NB; i++) {
      if (y <= anchors[i]) return (i - 1) + (y - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
    }
    return NB - 1;
  }

  /* ---- keyframe tracks, in BEAT space -----------------------------------
     (was: page fraction. Timings re-aimed so each phase peaks on the
      section whose copy describes it.)                                     */
  var T = {
    fraction:  [[0,.35],[B.dissolve,.42],[B.color+.05,.68],[B.comet-.06,.80],[B.pull+.1,.90],[B.always,1]],
    opacity:   [[0,.22],[B.dissolve,.30],[B.color+.05,.50],[B.comet-.06,.62],[B.constellation+.2,.72],[B.always,.85]],
    speed:     [[0,1],[B.burn+.4,1],[B.comet-.1,.55],[B.comet+.5,.50],[B.constellation-.25,.16],
                [B.constellation+.25,.16],[B.constellation+.6,.55],[B.always,.70]],
    cardColor: [[0,0],[B.universes-.1,0],[B.perks+.3,1],[B.always,1]],
    diss:      [[B.perks+.15,0],[B.dissolve+.4,1]],
    aura:      [[0,1],[B.comet-.06,1],[B.constellation+.2,.30],[B.always,.15]],
    darken:    [[B.pull-.5,0],[B.always,.85]],
    // NEW (HDR): line gain before tone-mapping, bloom strength, dust visibility
    gain:      [[0,1],[B.color+.8,1],[B.burn+.5,2.6],[B.comet+.1,1.2],[B.always,1.35]],
    bloom:     [[0,.10],[B.dissolve,.18],[B.color,.32],[B.burn+.5,.95],[B.comet,.60],[B.constellation,.70],[B.always,.95]],
    dust:      [[0,.45],[B.dissolve,.60],[B.burn,1],[B.always,1]]
  };
  var COLOR_STOPS = [
    [0, palette.white], [B.color-.6, palette.white],
    [B.color-.15, palette.violet], [B.color+.3, palette.gold], [B.color+.75, palette.rose],
    [B.burn+.55, palette.white], [B.always, palette.white]
  ];
  var WIN = {
    comet:         [B.comet-.5, B.comet+.5],
    constellation: [B.constellation-.5, B.constellation+.5],
    blackhole:     [B.pull-.5, B.always]
  };
  function inWin(p, w) { return p >= w[0] && p <= w[1]; }
  function winT(p, w) { return clamp((p - w[0]) / (w[1] - w[0]), 0, 1); }
  function track(stops, p) {
    if (p <= stops[0][0]) return stops[0][1];
    var last = stops[stops.length - 1];
    if (p >= last[0]) return last[1];
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) { var a = stops[i - 1], b = stops[i]; return lerp(a[1], b[1], smooth((p - a[0]) / (b[0] - a[0]))); }
    }
    return last[1];
  }
  function trackColor(stops, p) {
    if (p <= stops[0][0]) return stops[0][1];
    var last = stops[stops.length - 1];
    if (p >= last[0]) return last[1];
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = smooth((p - a[0]) / (b[0] - a[0]));
        return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
      }
    }
    return last[1];
  }

  /* =====================================================================
     QUALITY GOVERNOR
  ===================================================================== */
  var Q = [
    { dpr: 1.0,  bloom: 4, dust: 0.30, embers: 0.40 },
    { dpr: 1.25, bloom: 4, dust: 0.55, embers: 0.60 },
    { dpr: 1.5,  bloom: 5, dust: 0.80, embers: 0.85 },
    { dpr: 2.0,  bloom: 5, dust: 1.00, embers: 1.00 }
  ];
  var q = qs.has('q') ? clamp(parseInt(qs.get('q'), 10) || 0, 0, 3) : (isMobile ? 1 : 3);
  var qCeil = q, govLocked = qs.has('lock');

  /* =====================================================================
     GL PLUMBING
  ===================================================================== */
  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n'));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var inf = gl.getActiveUniform(p, i); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
    return { p: p, u: u };
  }
  function makeTex(w, h, ifmt, fmt, type, filter, wrapMode, data) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);
    return t;
  }
  function makeTarget(w, h) {
    var t = makeTex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('HDR framebuffer incomplete');
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex: t, fbo: f, w: w, h: h };
  }
  function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } }

  /* ---- shaders ----------------------------------------------------------- */
  var VS_FULL = '#version 300 es\nout vec2 vUv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
  var H_ = '#version 300 es\nprecision highp float;\n';

  var FS_BG = H_ + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform vec3 uTop, uBot, uAuraCol; uniform vec4 uAura;
void main(){
  vec2 px = vec2(vUv.x, 1.0-vUv.y)*uRes;
  vec3 col = mix(uTop, uBot, px.y/uRes.y);
  float d = length(px-uAura.xy)/uAura.z;
  float a = d<0.5 ? mix(0.16,0.06,d/0.5) : mix(0.06,0.0,clamp((d-0.5)/0.5,0.0,1.0));
  a *= uAura.w;
  o = vec4(mix(col,uAuraCol,a),1.0);
}`;

  /* BLACK HOLE HOOK ---------------------------------------------------------
     Placeholder = the original's soft central darkening (NOT lensing).
     Replace this pass, or use MultiverseBG.hooks.afterScene, with your shader. */
  var FS_HOLE = H_ + `
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uAmt;
void main(){
  vec2 px = vec2(vUv.x,1.0-vUv.y)*uRes;
  float d = length(px-uRes*0.5)/(min(uRes.x,uRes.y)*0.55);
  float a = d<0.6 ? mix(0.6,0.25,d/0.6) : mix(0.25,0.0,clamp((d-0.6)/0.4,0.0,1.0));
  o = vec4(0.0,0.0,0.0,a*uAmt);
}`;

  var VS_SEG = '#version 300 es\nprecision highp float;\n' + `
layout(location=0) in vec2 aC; layout(location=1) in vec4 iP; layout(location=2) in vec4 iC; layout(location=3) in vec3 iS;
uniform vec2 uRes;
out vec2 vL; out float vLen; out vec4 vCol; out vec3 vS;
void main(){
  vec2 d = iP.zw-iP.xy; float len = length(d);
  vec2 dir = len>1e-4 ? d/len : vec2(1.0,0.0);
  vec2 nrm = vec2(-dir.y,dir.x);
  float pad = iS.z*3.0+1.0; float hw = iS.x*0.5+pad;
  float along = mix(-pad, len+pad, aC.x); float across = aC.y*hw;
  vec2 pos = iP.xy + dir*along + nrm*across;
  vec2 clip = pos/uRes*2.0-1.0; gl_Position = vec4(clip.x,-clip.y,0.0,1.0);
  vL = vec2(along,across); vLen=len; vCol=iC; vS=iS;
}`;
  var FS_SEG = H_ + `
in vec2 vL; in float vLen; in vec4 vCol; in vec3 vS; out vec4 o; uniform float uDpr;
void main(){
  float u = clamp(vL.x/max(vLen,1e-4),0.0,1.0);
  float hw = vS.x*0.5*mix(1.0-0.85*vS.y,1.0,u);
  float dA = abs(vL.y);
  float dL = vL.x<0.0 ? -vL.x : (vL.x>vLen ? vL.x-vLen : 0.0);
  float cov;
  if (vS.z <= 0.0) cov = clamp((hw-dA)*uDpr+0.5,0.0,1.0)*clamp(1.0-dL*uDpr,0.0,1.0);
  else { float e = max(dA-hw,0.0); cov = exp(-0.5*(e*e+dL*dL)/(vS.z*vS.z)); }
  float al = mix(1.0-vS.y,1.0,pow(u,1.6));
  o = vec4(vCol.rgb*vCol.a*cov*al,0.0);
}`;

  var FS_DECAY = H_ + 'in vec2 vUv; out vec4 o; uniform float uA; void main(){o=vec4(0.0,0.0,0.0,uA);}';
  var FS_TRAILC = H_ + 'in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uGain; void main(){o=vec4(min(texture(uTex,vUv).rgb,vec3(1.0))*uGain,0.0);}';

  var VS_CARD = '#version 300 es\nprecision highp float;\n' + `
layout(location=0) in vec2 aC; layout(location=1) in vec4 iA; layout(location=2) in vec4 iB; layout(location=3) in vec3 iC;
uniform vec2 uRes; uniform float uFocus, uMaxBlur;
out vec2 vLocal; out vec2 vHs; out vec4 vB; out vec3 vCol;
void main(){
  float z=iB.y; float sig=abs(z-uFocus)*uMaxBlur; vec2 hs=iA.zw*0.5;
  float pad=3.0*sqrt(sig*sig+0.16)+3.0; vec2 local=aC*(hs+pad);
  float cs=cos(iB.x), sn=sin(iB.x);
  vec2 world=iA.xy+vec2(cs*local.x-sn*local.y, sn*local.x+cs*local.y);
  vec2 clip=world/uRes*2.0-1.0; gl_Position=vec4(clip.x,-clip.y,0.0,1.0);
  vLocal=local; vHs=hs; vB=iB; vCol=iC;
}`;
  var FS_CARD = H_ + `
in vec2 vLocal; in vec2 vHs; in vec4 vB; in vec3 vCol; out vec4 o;
uniform sampler2D uNoise, uLabels; uniform float uMix, uDens, uDiss, uFocus, uMaxBlur;
float sdRB(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
void main(){
  float z=vB.y, seed=vB.z, id=vB.w;
  float bl=abs(z-uFocus)*uMaxBlur; float sig=sqrt(bl*bl+0.16);      // depth-of-field
  float d=sdRB(vLocal,vHs,6.0);
  float lw=mix(0.5,1.1,z); float v=sig*sig+lw*lw/12.0;
  float line=min(1.0,lw/sqrt(6.2832*v))*exp(-d*d/(2.0*v));          // energy-conserving blurred stroke
  float fill=1.0-smoothstep(-1.7*sig,1.7*sig,d);
  float fillA=(0.03+0.05*z)*uDens; float strokeA=mix(0.18,0.8,z)*uDens;
  vec3 c=mix(vec3(1.0),vCol,uMix);
  vec2 luv=(vLocal-vec2(-vHs.x+8.0,vHs.y-16.5))/vec2(48.0,12.0);
  float inBox=step(0.0,luv.x)*step(luv.x,1.0)*step(0.0,luv.y)*step(luv.y,1.0)*step(0.55,z);
  vec2 cell=vec2(mod(id-1.0,4.0),floor((id-1.0)/4.0));
  float lab=texture(uLabels,(cell+clamp(luv,0.02,0.98))/vec2(4.0,6.0)).a*inBox*strokeA*0.9/(1.0+sig*0.9);
  float a=clamp(fillA*fill+strokeA*line+lab,0.0,1.0);
  // dissolve: noise-eroded with a hot ember front
  float ell=uDiss*1.3-seed*0.3;
  float n=texture(uNoise,vLocal/110.0+vec2(seed*7.13,seed*3.71)).r;
  float m=n-ell;
  float keep=smoothstep(0.0,0.035,m);
  float front=smoothstep(-0.005,0.02,m)*(1.0-smoothstep(0.03,0.14,m))*smoothstep(0.0,0.05,ell)*(1.0-smoothstep(1.0,1.15,ell));
  vec3 hot=mix(c,vec3(1.0,0.92,0.78),0.4);
  vec3 emit=hot*front*(line*0.9+fill*0.16+lab)*2.2*uDens;
  o=vec4(c*a*keep+emit,a*keep);
}`;

  var VS_DUST = '#version 300 es\nprecision highp float;\n' + `
layout(location=0) in vec4 aSeed;
uniform vec2 uRes, uMouse; uniform float uT, uTw, uScroll, uDpr, uAmt;
out float vA;
void main(){
  float z=aSeed.z, ph=aSeed.w; vec2 base=aSeed.xy*uRes;
  float sp=mix(3.0,14.0,z);
  vec2 p=base+vec2(-0.85,-0.32)*sp*uT
    +vec2(sin(uT*0.09+ph*6.283+base.y*0.003),cos(uT*0.07+ph*6.283+base.x*0.003))*(8.0+26.0*z);
  p+=(uMouse-0.5)*vec2(36.0,22.0)*z;
  p.y-=uScroll*(0.03+0.12*z);
  vec2 wr=uRes+80.0; p=mod(p+40.0,wr)-40.0;
  vec2 clip=p/uRes*2.0-1.0; gl_Position=vec4(clip.x,-clip.y,0.0,1.0);
  gl_PointSize=(0.9+2.1*z*fract(ph*13.7+0.3))*uDpr*1.6;
  float tw=0.65+0.35*sin(uTw*(0.6+ph*1.8)+ph*40.0);
  vA=(0.10+0.42*z)*tw*uAmt;
}`;
  var FS_DUST = H_ + 'in float vA; out vec4 o; uniform vec3 uCol; void main(){vec2 c=gl_PointCoord*2.0-1.0;float d=dot(c,c);float a=exp(-d*3.5)*step(d,1.0);o=vec4(uCol*vA*a,0.0);}';

  var FS_PRE = H_ + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uHalf; uniform float uThr, uKnee;
vec3 pf(vec3 c){ c=min(c,vec3(1.35)); float br=max(c.r,max(c.g,c.b)); float rq=clamp(br-uThr+uKnee,0.0,2.0*uKnee); rq=rq*rq/(4.0*uKnee+1e-4); float w=max(br-uThr,rq)/max(br,1e-4); return c*w; }
void main(){
  vec3 s=pf(texture(uTex,vUv).rgb)*4.0;
  s+=pf(texture(uTex,vUv-uHalf).rgb); s+=pf(texture(uTex,vUv+uHalf).rgb);
  s+=pf(texture(uTex,vUv+vec2(uHalf.x,-uHalf.y)).rgb); s+=pf(texture(uTex,vUv-vec2(uHalf.x,-uHalf.y)).rgb);
  o=vec4(s/8.0,0.0);
}`;
  var FS_DOWN = H_ + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uHalf;
void main(){
  vec3 s=texture(uTex,vUv).rgb*4.0;
  s+=texture(uTex,vUv-uHalf).rgb; s+=texture(uTex,vUv+uHalf).rgb;
  s+=texture(uTex,vUv+vec2(uHalf.x,-uHalf.y)).rgb; s+=texture(uTex,vUv-vec2(uHalf.x,-uHalf.y)).rgb;
  o=vec4(s/8.0,0.0);
}`;
  var FS_UP = H_ + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uHalf; uniform float uW;
void main(){
  vec3 s=texture(uTex,vUv+vec2(-uHalf.x*2.0,0.0)).rgb;
  s+=texture(uTex,vUv+vec2(-uHalf.x,uHalf.y)).rgb*2.0; s+=texture(uTex,vUv+vec2(0.0,uHalf.y*2.0)).rgb;
  s+=texture(uTex,vUv+vec2(uHalf.x,uHalf.y)).rgb*2.0;  s+=texture(uTex,vUv+vec2(uHalf.x*2.0,0.0)).rgb;
  s+=texture(uTex,vUv+vec2(uHalf.x,-uHalf.y)).rgb*2.0; s+=texture(uTex,vUv+vec2(0.0,-uHalf.y*2.0)).rgb;
  s+=texture(uTex,vUv+vec2(-uHalf.x,-uHalf.y)).rgb*2.0;
  o=vec4(s/12.0*uW,0.0);
}`;

  var FS_FINAL = H_ + `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom; uniform float uBloomAmt, uCA, uFade, uTime, uGrain;
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 shoulder(vec3 x){ const float a=0.62; vec3 t=max(x-a,0.0); vec3 hi=a+(1.0-a)*(1.0-exp(-t/(1.0-a))); return mix(x,hi,step(a,x)); }
void main(){
  vec2 c=vUv-0.5; vec2 off=c*dot(c,c)*uCA*4.0;              // radial chromatic aberration
  vec3 col;
  col.r=texture(uScene,vUv+off).r; col.g=texture(uScene,vUv).g; col.b=texture(uScene,vUv-off).b;
  col+=texture(uBloom,vUv).rgb*uBloomAmt;
  col=shoulder(col);                                          // filmic highlight roll-off, ink blacks untouched
  vec2 cuv=vec2(vUv.x,1.0-vUv.y);                             // vignette: same stops as the CSS one
  float r=length((cuv-vec2(0.5,0.45))/vec2(1.2,1.0));
  float k=clamp((r-0.78)/0.22,0.0,1.0);
  float va=r<0.35?0.0:(r<0.78?mix(0.0,0.55,(r-0.35)/0.43):mix(0.55,0.92,k));
  col=mix(col,mix(vec3(6.0,5.0,10.0),vec3(4.0,3.0,8.0),k)/255.0,va);
  col*=uFade;
  float tq=floor(uTime*24.0); vec2 gp=gl_FragCoord.xy+vec2(tq*37.0,tq*17.0);
  float lum=dot(col,vec3(0.299,0.587,0.114));
  col+=(hash12(gp)-0.5)*uGrain*(0.012+0.10*lum*(1.0-lum));   // luminance-weighted animated grain
  col+=(hash12(gp*1.37+11.0)+hash12(gp*0.73+5.0)-1.0)/255.0; // triangular dither: kills banding
  o=vec4(col,1.0);
}`;

  var P;
  try {
    P = {
      bg: program(VS_FULL, FS_BG), hole: program(VS_FULL, FS_HOLE),
      seg: program(VS_SEG, FS_SEG), decay: program(VS_FULL, FS_DECAY), trailc: program(VS_FULL, FS_TRAILC),
      card: program(VS_CARD, FS_CARD), dust: program(VS_DUST, FS_DUST),
      pre: program(VS_FULL, FS_PRE), down: program(VS_FULL, FS_DOWN), up: program(VS_FULL, FS_UP),
      fin: program(VS_FULL, FS_FINAL)
    };
  } catch (e) { console.error(e); fallback('shader compile'); return; }

  /* ---- static geometry ---------------------------------------------------- */
  var emptyVAO = gl.createVertexArray();
  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,-1, 0,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  var cardQuad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cardQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

  var SEG_F = 11;
  function makeBatch(max) {
    var b = { data: new Float32Array(max * SEG_F), n: 0, max: max, buf: gl.createBuffer(), vao: gl.createVertexArray() };
    gl.bindVertexArray(b.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, b.data.byteLength, gl.DYNAMIC_DRAW);
    var st = SEG_F * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, st, 0);  gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 16); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, st, 32); gl.vertexAttribDivisor(3, 1);
    return b;
  }
  function seg(b, x0, y0, x1, y1, r, g, bl, a, w, fade, soft) {
    if (b.n >= b.max) return;
    var d = b.data, o = b.n * SEG_F;
    d[o] = x0; d[o+1] = y0; d[o+2] = x1; d[o+3] = y1; d[o+4] = r; d[o+5] = g; d[o+6] = bl; d[o+7] = a; d[o+8] = w; d[o+9] = fade; d[o+10] = soft;
    b.n++;
  }
  function drawBatch(b) {
    if (!b.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.data, 0, b.n * SEG_F);
    gl.bindVertexArray(b.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.n);
  }
  var trailB = makeBatch(1600), linesB = makeBatch(1800), cometB = makeBatch(500);

  var NUM_FRAMES = isMobile ? 14 : 22;
  var CARD_F = 11;
  var cardData = new Float32Array(NUM_FRAMES * CARD_F);
  var cardBuf = gl.createBuffer(), cardVAO = gl.createVertexArray();
  gl.bindVertexArray(cardVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, cardQuad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, cardBuf); gl.bufferData(gl.ARRAY_BUFFER, cardData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 44, 0);  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 44, 16); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 44, 32); gl.vertexAttribDivisor(3, 1);

  var DUST_MAX = isMobile ? 900 : 2600;
  var dustVAO = gl.createVertexArray(), dustBuf = gl.createBuffer();
  (function () {
    var d = new Float32Array(DUST_MAX * 4);
    for (var i = 0; i < d.length; i++) d[i] = Math.random();
    d = d.map(function (v, i) { return (i % 4 === 2) ? Math.pow(v, 1.6) : v; });   // bias toward far layer
    gl.bindVertexArray(dustVAO); gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  })();

  /* ---- dissolve noise texture: tileable fBm, rank-normalised so the value
        IS the fraction dissolved. CPU samples the same bytes for embers. --- */
  var NS = 128, noiseBytes = new Uint8Array(NS * NS);
  (function () {
    var s = 1337; function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    function lat(n) { var a = new Float32Array(n * n); for (var i = 0; i < a.length; i++) a[i] = r(); return a; }
    function vn(l, n, u, v) {
      var fx = u * n, fy = v * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
      var x0 = ix % n, x1 = (ix + 1) % n, y0 = iy % n, y1 = (iy + 1) % n;
      return lerp(lerp(l[y0*n+x0], l[y0*n+x1], tx), lerp(l[y1*n+x0], l[y1*n+x1], tx), ty);
    }
    var l1 = lat(8), l2 = lat(16), l3 = lat(32), vals = new Float32Array(NS * NS);
    for (var y = 0; y < NS; y++) for (var x = 0; x < NS; x++) {
      var u = x / NS, v = y / NS;
      vals[y*NS+x] = vn(l1,8,u,v)*.55 + vn(l2,16,u,v)*.3 + vn(l3,32,u,v)*.15;
    }
    var idx = new Uint32Array(NS * NS); for (var i = 0; i < idx.length; i++) idx[i] = i;
    idx.sort(function (a, b) { return vals[a] - vals[b]; });
    for (var k = 0; k < idx.length; k++) noiseBytes[idx[k]] = Math.round(k / (idx.length - 1) * 255);
  })();
  var noiseTex = makeTex(NS, NS, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR, gl.REPEAT, noiseBytes);
  function noiseAt(u, v) {
    var x = u * NS - 0.5, y = v * NS - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    x0 = ((x0 % NS) + NS) % NS; y0 = ((y0 % NS) + NS) % NS;
    var x1 = (x0 + 1) % NS, y1 = (y0 + 1) % NS;
    return lerp(lerp(noiseBytes[y0*NS+x0], noiseBytes[y0*NS+x1], fx), lerp(noiseBytes[y1*NS+x0], noiseBytes[y1*NS+x1], fx), fy) / 255;
  }

  /* ---- № label atlas (4 x 6 cells of 96x24 = 48x12 css px @2x) ---------- */
  var labelTex = (function () {
    var c = document.createElement('canvas'); c.width = 96 * 4; c.height = 24 * 6;
    var x = c.getContext('2d'); x.font = '400 18px Georgia, serif'; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    for (var i = 1; i <= 24; i++) x.fillText('\u2116 ' + String(i).padStart(3, '0'), ((i - 1) % 4) * 96 + 1, Math.floor((i - 1) / 4) * 24 + 17);
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  })();

  /* ---- render targets, resized by governor / viewport -------------------- */
  var W = window.innerWidth, H = window.innerHeight, rdpr = 1, bw = 2, bh = 2;
  var sceneT = null, trailT = null, mips = [];
  function resizeGL() {
    W = window.innerWidth; H = window.innerHeight;
    rdpr = Math.min(window.devicePixelRatio || 1, Q[q].dpr);
    bw = Math.max(2, Math.round(W * rdpr)); bh = Math.max(2, Math.round(H * rdpr));
    glCanvas.width = bw; glCanvas.height = bh;
    freeTarget(sceneT); freeTarget(trailT); mips.forEach(freeTarget); mips = [];
    sceneT = makeTarget(bw, bh); trailT = makeTarget(bw, bh);
    for (var i = 0; i < Q[q].bloom; i++) mips.push(makeTarget(Math.max(1, bw >> (i + 1)), Math.max(1, bh >> (i + 1))));
    measure();
  }
  function setQuality(n) { q = clamp(n, 0, 3); doc.classList.toggle('lowfx', q <= 1); resizeGL(); }

  /* Scroll position comes from the page's own Lenis (lib/scroll.ts).
     A second inertial scroller would preventDefault the wheel and fight
     holds, locks, and ScrollTrigger. Velocity is still derived from dy. */
  var scroller = {
    kind: 'page',
    update: function () { return window.scrollY; },
    to: function (y) {
      if (hostHooks.pageScrollTo) hostHooks.pageScrollTo(y, { smooth: true, duration: 1.6 });
      else window.scrollTo(0, y);
    }
  };

  /* =====================================================================
     REVEALS — split-text + fades on the same scroll clock
  ===================================================================== */
  var reveals = [];
  function buildReveals() {
    sections.forEach(function (sec, si) {
      var inner = sec.querySelector('.hero-inner, .card'); if (!inner) return;
      var isCard = inner.classList.contains('card');
      var units = [], ord = { n: 0 };
      if (isCard) units.push({ el: inner, kind: 'card', order: ord.n++ });
      [].slice.call(inner.children).forEach(function (ch) {
        if (ch.tagName === 'H1' || ch.tagName === 'H2') {
          var full = ch.textContent.replace(/\s+/g, ' ').trim(); ch.setAttribute('aria-label', full);
          var nodes = [].slice.call(ch.childNodes); ch.textContent = '';
          nodes.forEach(function (n) {
            if (n.nodeType === 3) {
              n.textContent.split(/(\s+)/).forEach(function (tok) {
                if (!tok) return;
                if (/^\s+$/.test(tok)) { if (ch.lastChild && ch.lastChild.nodeName !== 'BR') ch.appendChild(document.createTextNode(' ')); return; }
                var w = document.createElement('span'); w.className = 'rv-word'; w.setAttribute('aria-hidden', 'true');
                var i = document.createElement('span'); i.textContent = tok; w.appendChild(i); ch.appendChild(w);
                units.push({ el: i, kind: 'word', order: ord.n++ });
              });
            } else ch.appendChild(n.cloneNode(true));
          });
        } else if (ch.classList.contains('grid')) {
          [].forEach.call(ch.children, function (u) { units.push({ el: u, kind: 'fade', order: ord.n++ }); });
        } else units.push({ el: ch, kind: 'fade', order: ord.n++ });
      });
      reveals.push({ sec: sec, si: si, inner: inner, isCard: isCard, units: units, max: Math.max(1, ord.n - 1), hidden: null });
    });
  }
  /* Donor split-text reveals are content choreography. They rewrite headings.
     The host page owns its own type; this pass does not run them. */

  function setStyle(u, tf, op) {
    var key = tf + '|' + op;
    if (u.last === key) return; u.last = key;
    u.el.style.transform = tf; u.el.style.opacity = op;
  }
  function updateReveals(y, introGate) {
    for (var r = 0; r < reveals.length; r++) {
      var R = reveals[r];
      var d = (secCenter[R.si] - (y + vh / 2)) / vh;
      if (Math.abs(d) > 0.85) {
        if (R.hidden !== (d > 0 ? 'in' : 'out')) {
          R.hidden = d > 0 ? 'in' : 'out';
          R.units.forEach(function (u) { setStyle(u, u.kind === 'word' ? 'translate3d(0,110%,0)' : 'translate3d(0,24px,0)', u.kind === 'word' ? '1' : '0'); });
        }
        continue;
      }
      R.hidden = null;
      var enter = 1 - sstep(0.10, 0.52, d);
      if (R.si === 0) enter = Math.min(enter, introGate);
      var exit = sstep(0.16, 0.56, -d);
      var S = Math.min(0.09, 0.55 / R.max);
      for (var i = 0; i < R.units.length; i++) {
        var u = R.units[i];
        var e = smooth(clamp(enter * (1 + S * R.max) - u.order * S, 0, 1));
        if (u.kind === 'word') setStyle(u, 'translate3d(0,' + ((1 - e) * 110).toFixed(2) + '%,0)', '1');
        else if (u.kind === 'card') setStyle(u, 'translate3d(0,' + ((1 - e) * 26 - exit * 40).toFixed(1) + 'px,0)', (e * (1 - exit)).toFixed(3));
        else setStyle(u, 'translate3d(0,' + ((1 - e) * 22).toFixed(1) + 'px,0)', e.toFixed(3));
      }
      if (!R.isCard) { var tf = 'translate3d(0,' + (-exit * 40).toFixed(1) + 'px,0)', op = (1 - exit).toFixed(3); var k = tf + op;
        if (R.lastInner !== k) { R.lastInner = k; R.inner.style.transform = tf; R.inner.style.opacity = op; } }
    }
  }

  /* =====================================================================
     SIMULATION
  ===================================================================== */
  var mouse = { x: .5, y: .5, px: -9999, py: -9999, active: false, tx: .5, ty: .5, tpx: -9999, tpy: -9999, vx: 0, vy: 0 };
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    mouse.tx = e.clientX / W; mouse.ty = e.clientY / H; mouse.tpx = e.clientX; mouse.tpy = e.clientY;
    if (!mouse.active) { mouse.px = mouse.tpx; mouse.py = mouse.tpy; }
    mouse.active = true;
  });
  addEventListener('pointerout', function (e) { if (!e.relatedTarget) mouse.active = false; });

  var density = 0, targetDensity = 0;
  bindDensity(function (v) { targetDensity = v; });

  var POOL = reduceMotion ? 0 : (isMobile ? 120 : 260);
  var pool = [];
  for (var pi = 0; pi < POOL; pi++) pool.push({ x: rand() * W, y: rand() * H, speed: 0.8 + rand(), life: rand() * 200, isComet: pi % 12 === 0, tl: 55 + rand() * 65, ang: 0 });
  function flow(x, y, tt) { return Math.sin(x*.0025 + tt*.4) + Math.sin(y*.003 - tt*.3) + Math.sin((x+y)*.0018 + tt*.2); }

  var EMBER_MAX = isMobile ? 260 : 600, embers = [];
  for (var ei = 0; ei < EMBER_MAX; ei++) embers.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, c: [1, 1, 1] });
  var emberFree = 0;

  var frames = [], baseDrift = { x: -7, y: -3.2 };
  function pickColor() { var r = rand(); return r < .62 ? palette.gold : r < .84 ? palette.violet : palette.rose; }
  for (var fi = 0; fi < NUM_FRAMES; fi++) {
    var z = 0.22 + rand() * 0.78, fw = lerp(34, 118, z);
    frames.push({ id: 1 + fi, x: rand() * (W * 1.5) - W * .25, y: rand() * (H * 1.5) - H * .25, z: z, w: fw, h: fw * (1.15 + rand() * .55),
      rot: (rand() - .5) * .14, color: pickColor(), phase: rand() * Math.PI * 2, seed: rand(), acc: 0, cx: 0, cy: 0 });
  }
  frames.sort(function (a, b) { return a.z - b.z; });

  var S = { t: 0, ft: 0, driftT: 0, y: 0, b: 0, prog: 0, dy: 0, sv: 0, boost: 0, intro: 0, ignite: 0, diss: 0,
    col: [1, 1, 1], gain: 1, bloom: 0, active: 0, embers: 0, cf: 0, blackhole: 0 };

  function spawnEmber(f, ell, mixC, colField) {
    if (S.embersFull) return;
    for (var t = 0; t < 8; t++) {
      var per = 2 * (f.w + f.h), s = rand() * per, lx, ly;
      if (s < f.w) { lx = s - f.w/2; ly = -f.h/2; } else if (s < f.w + f.h) { lx = f.w/2; ly = s - f.w - f.h/2; }
      else if (s < 2*f.w + f.h) { lx = f.w/2 - (s - f.w - f.h); ly = f.h/2; } else { lx = -f.w/2; ly = f.h/2 - (s - 2*f.w - f.h); }
      var m = noiseAt(lx/110 + f.seed*7.13, ly/110 + f.seed*3.71) - ell;
      if (m < -0.02 || m > 0.14) continue;                         // only along the burning front
      var e = null;
      for (var k = 0; k < EMBER_MAX; k++) { emberFree = (emberFree + 1) % EMBER_MAX; if (!embers[emberFree].on) { e = embers[emberFree]; break; } }
      if (!e) { S.embersFull = true; return; }
      var cs = Math.cos(f.rot), sn = Math.sin(f.rot), L = Math.hypot(lx, ly) || 1, sp = 0.3 + rand() * 1.0;
      e.on = true; e.x = f.cx + cs*lx - sn*ly; e.y = f.cy + sn*lx + cs*ly;
      e.vx = (cs*lx - sn*ly)/L*sp; e.vy = (sn*lx + cs*ly)/L*sp;
      e.age = 0; e.life = 100 + rand() * 120;
      e.c = [lerp(1, f.color[0]/255, mixC), lerp(1, f.color[1]/255, mixC), lerp(1, f.color[2]/255, mixC)];
      return;
    }
  }

  var CARDS_ON = true;
  function stepScene(dt, k, b) {
    trailB.n = 0; linesB.n = 0; cometB.n = 0; S.embersFull = false;

    var opacity = track(T.opacity, b) * S.ignite, speedMul = track(T.speed, b);
    var col = trackColor(COLOR_STOPS, b); S.col = [col[0]/255, col[1]/255, col[2]/255];
    var cr = S.col[0], cg = S.col[1], cb = S.col[2];
    var cometOn = inWin(b, WIN.comet), constOn = inWin(b, WIN.constellation), holeOn = inWin(b, WIN.blackhole);
    var cf = 0; if (cometOn) { var wt = winT(b, WIN.comet); cf = sstep(0, .18, wt) * (1 - sstep(.82, 1, wt)); }
    S.cf = cf;
    var active = POOL ? Math.max(1, Math.floor(POOL * track(T.fraction, b))) : 0; S.active = active;
    var stretch = 1 + 0.6 * Math.min(S.boost, 2);
    var cx = W / 2, cy = H / 2;
    S.blackhole = holeOn ? winT(b, WIN.blackhole) : 0;

    // pointer: inertia + velocity
    var pk = 1 - Math.exp(-dt * 14);
    var ox = mouse.px, oy = mouse.py;
    mouse.x += (mouse.tx - mouse.x) * (1 - Math.pow(1 - .04, k)); mouse.y += (mouse.ty - mouse.y) * (1 - Math.pow(1 - .04, k));
    mouse.px += (mouse.tpx - mouse.px) * pk; mouse.py += (mouse.tpy - mouse.py) * pk;
    var iv = dt > 0 ? 1 / dt : 0;
    mouse.vx = lerp(mouse.vx, (mouse.px - ox) * iv, .2); mouse.vy = lerp(mouse.vy, (mouse.py - oy) * iv, .2);
    var pspeed = Math.hypot(mouse.vx, mouse.vy), R = 260 * (1 + Math.min(pspeed / 2400, .5));

    var comets = [];
    for (var i = 0; i < active; i++) {
      var p = pool[i];
      var angle = flow(p.x, p.y, S.ft) * 1.6;
      var falloff = 0;
      if (mouse.active) {
        var mdx = p.x - mouse.px, mdy = p.y - mouse.py, md = Math.sqrt(mdx*mdx + mdy*mdy) + .001;
        if (md < R) { falloff = 1 - md / R; angle += Math.atan2(mdy, mdx) * falloff * 1.2; }
      }
      if (holeOn) angle = lerp(angle, Math.atan2(cy - p.y, cx - p.x), S.blackhole * .9 * .4);
      var isC = p.isComet && cf > 0.02;
      var sp = p.speed * (isC ? lerp(speedMul, 2.3, cf) : speedMul) * k;
      var ca = Math.cos(angle), sa = Math.sin(angle);
      var nx = p.x + ca * sp, ny = p.y + sa * sp - S.sv * 0.02 * k;
      if (falloff) { nx += mouse.vx * falloff * .0012 * k; ny += mouse.vy * falloff * .0012 * k; }   // pointer wake
      var segLen = isC ? lerp(1, 3.5, cf) : stretch;
      var sx = p.x + ca * sp * segLen, sy = p.y + sa * sp * segLen;
      seg(trailB, p.x, p.y, sx, sy, cr, cg, cb, isC ? Math.min(1, opacity + .12 * cf) : opacity, isC ? lerp(1.35, 1.6, cf) : 1.35, 0, 0);
      p.ang = angle;
      if (isC) comets.push(p);
      p.x = nx; p.y = ny; p.life -= k;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life < 0) { p.x = rand() * W; p.y = rand() * H; p.life = 150 + rand() * 150; }
    }

    // comets: tapered tails + head flare + anamorphic streak (drawn direct, HDR)
    for (var c = 0; c < comets.length; c++) {
      var cp = comets[c], dx = Math.cos(cp.ang), dy = Math.sin(cp.ang), Lt = cp.tl * cf;
      seg(cometB, cp.x - dx*Lt, cp.y - dy*Lt, cp.x, cp.y, lerp(1, cr, .25), lerp(1, cg, .25), lerp(1, cb, .25), 0.6 * cf, 1.8, 1, 0);
      seg(cometB, cp.x - dx*2, cp.y - dy*2, cp.x + dx*2, cp.y + dy*2, 1, 1, 1, 0.75 * cf, 1.8, 0, 2.4);
      seg(cometB, cp.x - 22, cp.y, cp.x + 22, cp.y, .82, .82, 1, .07 * cf, .7, 0, .7);
    }

    // constellation: spatial nearest-neighbour links (was: index-adjacent), + star nodes
    if (constOn && active > 1) {
      var fade = Math.sin(winT(b, WIN.constellation) * Math.PI);
      var maxD = isMobile ? 110 : 140, KMAX = isMobile ? 3 : 4, cell = maxD;
      var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
      var grid = {}, deg = new Uint8Array(active);
      for (var a = 0; a < active; a++) { var key = ((pool[a].x / cell) | 0) + ',' + ((pool[a].y / cell) | 0); (grid[key] = grid[key] || []).push(a); }
      for (var a2 = 0; a2 < active; a2++) {
        var pa = pool[a2], gx = (pa.x / cell) | 0, gy = (pa.y / cell) | 0, cand = [];
        for (var ox2 = -1; ox2 <= 1; ox2++) for (var oy2 = -1; oy2 <= 1; oy2++) {
          var cellList = grid[(gx + ox2) + ',' + (gy + oy2)]; if (!cellList) continue;
          for (var ci = 0; ci < cellList.length; ci++) { var bb = cellList[ci]; if (bb <= a2) continue;
            var ddx = pa.x - pool[bb].x, ddy = pa.y - pool[bb].y, dd = Math.sqrt(ddx*ddx + ddy*ddy);
            if (dd < maxD) cand.push([dd, bb]); }
        }
        cand.sort(function (u, v) { return u[0] - v[0]; });
        for (var cj = 0; cj < cand.length && deg[a2] < KMAX; cj++) {
          var bi = cand[cj][1]; if (deg[bi] >= KMAX) continue;
          deg[a2]++; deg[bi]++;
          seg(linesB, pa.x, pa.y, pool[bi].x, pool[bi].y, 1, 1, 1, (1 - cand[cj][0] / maxD) * .5 * fade, .6, 0, 0);
        }
        seg(linesB, pa.x, pa.y, pa.x + .01, pa.y, 1, 1, 1, 1.15 * fade, 1.6, 0, 1.1);
      }
    }

    // embers: card outlines → particles that join the flow
    for (var ei2 = 0; ei2 < EMBER_MAX; ei2++) {
      var e = embers[ei2]; if (!e.on) continue;
      var ang = flow(e.x, e.y, S.ft) * 1.6, fs = 1.1 * speedMul * k;
      e.vx += (Math.cos(ang) * fs / k - e.vx) * (1 - Math.pow(.95, k)); e.vy += (Math.sin(ang) * fs / k - e.vy) * (1 - Math.pow(.95, k));
      var ex = e.x + e.vx * k, ey = e.y + e.vy * k;
      e.age += k;
      var u01 = e.age / e.life;
      if (u01 >= 1 || ex < -20 || ex > W + 20 || ey < -20 || ey > H + 20) { e.on = false; continue; }
      var env = sstep(0, .08, u01) * (1 - sstep(.5, 1, u01));
      seg(trailB, e.x, e.y, ex + (ex - e.x) * (stretch - 1), ey + (ey - e.y) * (stretch - 1),
        lerp(e.c[0], cr, u01), lerp(e.c[1], cg, u01), lerp(e.c[2], cb, u01), Math.max(.35, opacity) * env, 1.35, 0, 0);
      e.x = ex; e.y = ey; S.embers++;
    }
  }

  function stepCards(dt, b) {
    var mixC = track(T.cardColor, b), diss = S.diss;
    CARDS_ON = diss < 0.999;
    var rate = 18 * Q[q].embers * (isMobile ? .5 : 1);
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var px = wrap(f.x + baseDrift.x * f.z * S.driftT, -W * .25, W * 1.25);
      var py = wrap(f.y + baseDrift.y * f.z * S.driftT - S.y * .05 * f.z, -H * .25, H * 1.25);
      var bob = Math.sin(S.t * .4 + f.phase) * 5 * f.z;
      f.cx = px + (mouse.x - .5) * 46 * f.z; f.cy = py + (mouse.y - .5) * 46 * f.z + bob;
      var o = i * CARD_F;
      cardData[o] = f.cx; cardData[o+1] = f.cy; cardData[o+2] = f.w; cardData[o+3] = f.h;
      cardData[o+4] = f.rot; cardData[o+5] = f.z; cardData[o+6] = f.seed; cardData[o+7] = f.id;
      cardData[o+8] = f.color[0] / 255; cardData[o+9] = f.color[1] / 255; cardData[o+10] = f.color[2] / 255;
      var ell = diss * 1.3 - f.seed * .3;
      if (POOL && dt > 0 && ell > .02 && ell < 1.05 && f.cx > -60 && f.cx < W + 60 && f.cy > -60 && f.cy < H + 60) {
        f.acc += rate * dt * ((f.w + f.h) / 175);
        while (f.acc >= 1) { f.acc -= 1; spawnEmber(f, ell, mixC); }
      }
    }
  }

  /* =====================================================================
     DRAW
  ===================================================================== */
  function full() { gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  var hooks = { afterScene: null };

  function drawGL(b, k, now) {
    var prog = b / (NB - 1);
    var gain = track(T.gain, b), bloomAmt = track(T.bloom, b) * (isMobile ? .75 : 1) * (0.6 + 0.4 * (Q[q].bloom / 5));
    S.gain = gain; S.bloom = bloomAmt;
    var dk = track(T.darken, b);

    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);

    // -- 1. trails (persistent, HDR) -----------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailT.fbo); gl.viewport(0, 0, trailT.w, trailT.h);
    if (k > 0) {
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.decay.p); gl.uniform1f(P.decay.u.uA, 1 - Math.pow(.92, k)); full();
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.seg.p); gl.uniform2f(P.seg.u.uRes, W, H); gl.uniform1f(P.seg.u.uDpr, rdpr); drawBatch(trailB);
    }

    // -- 2. scene -------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneT.fbo); gl.viewport(0, 0, sceneT.w, sceneT.h);
    gl.disable(gl.BLEND);
    var hs = Math.min(1, Math.max(0, prog + Math.sin(S.t * .08) * .04)), c1 = palette.gold, c2 = palette.violet, c3 = palette.rose, mx;
    if (hs < .5) { var tt = hs / .5; mx = [lerp(c1[0],c2[0],tt), lerp(c1[1],c2[1],tt), lerp(c1[2],c2[2],tt)]; }
    else { var t2 = (hs - .5) / .5; mx = [lerp(c2[0],c3[0],t2), lerp(c2[1],c3[1],t2), lerp(c2[2],c3[2],t2)]; }
    var ac = track(T.aura, b) * lerp(1, .45, density) * lerp(.55, 1, S.introE);
    var pulse = .85 + Math.sin(S.t * .15) * .15;
    gl.useProgram(P.bg.p);
    gl.uniform2f(P.bg.u.uRes, W, H);
    gl.uniform3f(P.bg.u.uTop, palette.ink[0]/255*(1-dk), palette.ink[1]/255*(1-dk), palette.ink[2]/255*(1-dk));
    gl.uniform3f(P.bg.u.uBot, palette.plum[0]/255*(1-dk), palette.plum[1]/255*(1-dk), palette.plum[2]/255*(1-dk));
    gl.uniform3f(P.bg.u.uAuraCol, mx[0]/255, mx[1]/255, mx[2]/255);
    gl.uniform4f(P.bg.u.uAura, W*.5 + (mouse.x-.5)*40, H*.46 + (mouse.y-.5)*24, Math.min(W,H)*.42*pulse, ac);
    full();

    gl.enable(gl.BLEND);
    // dust (far layer)
    gl.blendFunc(gl.ONE, gl.ONE);
    var nd = Math.floor(DUST_MAX * Q[q].dust);
    if (nd > 0) {
      var dp = P.dust; gl.useProgram(dp.p);
      gl.uniform2f(dp.u.uRes, W, H); gl.uniform2f(dp.u.uMouse, mouse.x, mouse.y);
      gl.uniform1f(dp.u.uT, S.driftT); gl.uniform1f(dp.u.uTw, S.t); gl.uniform1f(dp.u.uScroll, S.y); gl.uniform1f(dp.u.uDpr, rdpr);
      gl.uniform1f(dp.u.uAmt, track(T.dust, b) * S.ignite * lerp(1, .5, density));
      gl.uniform3f(dp.u.uCol, lerp(1, S.col[0], .6), lerp(1, S.col[1], .6), lerp(1, S.col[2], .6));
      gl.bindVertexArray(dustVAO); gl.drawArrays(gl.POINTS, 0, nd);
    }
    // cards
    if (CARDS_ON) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      var cp = P.card; gl.useProgram(cp.p);
      gl.uniform2f(cp.u.uRes, W, H); gl.uniform1f(cp.u.uMix, track(T.cardColor, b)); gl.uniform1f(cp.u.uDens, lerp(1, .4, density) * S.introE);
      gl.uniform1f(cp.u.uDiss, S.diss); gl.uniform1f(cp.u.uFocus, .85); gl.uniform1f(cp.u.uMaxBlur, 8);
      bindTex(0, noiseTex); gl.uniform1i(cp.u.uNoise, 0); bindTex(1, labelTex); gl.uniform1i(cp.u.uLabels, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, cardBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cardData);
      gl.bindVertexArray(cardVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NUM_FRAMES);
    }
    // black-hole placeholder (darkening only)
    if (S.blackhole > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.hole.p); gl.uniform2f(P.hole.u.uRes, W, H); gl.uniform1f(P.hole.u.uAmt, S.blackhole); full();
    }
    // trails → scene (clamped, then gained into HDR)
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.trailc.p); bindTex(0, trailT.tex); gl.uniform1i(P.trailc.u.uTex, 0);
    gl.uniform1f(P.trailc.u.uGain, gain); full();
    // constellation links + comets (direct, no accumulation)
    gl.useProgram(P.seg.p); gl.uniform2f(P.seg.u.uRes, W, H); gl.uniform1f(P.seg.u.uDpr, rdpr);
    drawBatch(linesB); drawBatch(cometB);
    gl.disable(gl.BLEND);
    if (hooks.afterScene) hooks.afterScene(gl, sceneT, S);

    // -- 3. bloom (dual-filter pyramid) ---------------------------------
    var L = mips.length;
    gl.useProgram(P.pre.p); gl.bindFramebuffer(gl.FRAMEBUFFER, mips[0].fbo); gl.viewport(0, 0, mips[0].w, mips[0].h);
    bindTex(0, sceneT.tex); gl.uniform1i(P.pre.u.uTex, 0); gl.uniform2f(P.pre.u.uHalf, 1 / sceneT.w, 1 / sceneT.h);
    gl.uniform1f(P.pre.u.uThr, .6); gl.uniform1f(P.pre.u.uKnee, .4); full();
    gl.useProgram(P.down.p); gl.uniform1i(P.down.u.uTex, 0);
    for (var i = 1; i < L; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i].fbo); gl.viewport(0, 0, mips[i].w, mips[i].h);
      bindTex(0, mips[i-1].tex); gl.uniform2f(P.down.u.uHalf, 1 / mips[i-1].w, 1 / mips[i-1].h); full();
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.up.p); gl.uniform1i(P.up.u.uTex, 0); gl.uniform1f(P.up.u.uW, .75);
    for (var j = L - 2; j >= 0; j--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[j].fbo); gl.viewport(0, 0, mips[j].w, mips[j].h);
      bindTex(0, mips[j+1].tex); gl.uniform2f(P.up.u.uHalf, .5 / mips[j+1].w, .5 / mips[j+1].h); full();
    }
    gl.disable(gl.BLEND);

    // -- 4. finish → screen -----------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, bw, bh);
    gl.useProgram(P.fin.p);
    bindTex(0, sceneT.tex); gl.uniform1i(P.fin.u.uScene, 0); bindTex(1, mips[0].tex); gl.uniform1i(P.fin.u.uBloom, 1);
    var ca = reduceMotion ? 0 : 0.0010 + 0.0022 * Math.min(S.boost, 2.5) + 0.010 * Math.pow(1 - S.introE, 2) + 0.0012 * (gain - 1) / 1.6;
    gl.uniform1f(P.fin.u.uBloomAmt, bloomAmt); gl.uniform1f(P.fin.u.uCA, ca);
    gl.uniform1f(P.fin.u.uFade, S.fade); gl.uniform1f(P.fin.u.uTime, reduceMotion ? 0 : now / 1000); gl.uniform1f(P.fin.u.uGrain, 1);
    full();
  }

  /* =====================================================================
     HUD + LOOP
  ===================================================================== */
  var hudEl = document.getElementById('hud');
  if (hudEl && qs.get('hud') === '0') hudEl.classList.add('hidden');
  var elPhase = document.getElementById('hudPhase'), elSub = document.getElementById('hudSub'), elScroll = document.getElementById('hudScroll'),
      elCount = document.getElementById('hudCount'), elBar = document.getElementById('hudBar'), elPerf = document.getElementById('hudPerf');
  if (hudEl) addEventListener('keydown', function (e) { if (e.key === 'h' || e.key === 'H') hudEl.classList.toggle('hidden'); });
  var hudTick = 0, lastHud = '';
  function labelFor(b) {
    if (b < B.perks + .15) return ['I', track(T.cardColor, b) < .5 ? 'cards · white' : 'cards · gaining color'];
    if (b < B.comet - .5) return ['II', b < B.color - .6 ? 'cards dissolve · field white' : b < B.burn + .55 ? 'field · violet → gold → rose' : 'field · burn to white'];
    if (inWin(b, WIN.constellation)) return ['III', 'constellation'];
    if (inWin(b, WIN.comet)) return ['III', 'comet shower'];
    if (inWin(b, WIN.blackhole)) return ['III', 'the pull'];
    return ['III', 'transition'];
  }

  var last = 0, introStart = -1, fpsAvg = 1 / 60, gvFrames = 0, gvSlow = 0, gvFast = 0, gvChange = 0, lastY = window.scrollY, prevBeat = -1;
  S.introE = reduceMotion ? 1 : 0; S.fade = reduceMotion ? 1 : 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (gl.isContextLost()) return;
    var raw = last ? (now - last) / 1000 : 1 / 60; last = now;
    var dt = clamp(raw, 0, .05), k = reduceMotion ? 0 : dt * 60;

    var y = scroller.update(now, dt);
    var dy = y - lastY; lastY = y;
    S.y = y; S.dy = dy;
    S.sv = lerp(S.sv, dy, .3);
    S.boost = lerp(S.boost, clamp(Math.abs(S.sv) / 40, 0, 3), 1 - Math.pow(1 - .08, Math.max(k, .001)));
    var b = beatAt(y); S.b = b; S.prog = b / (NB - 1);

    if (reduceMotion && Math.abs(b - prevBeat) < 1e-4 && frame.drawn) return;
    prevBeat = b;

    if (introStart < 0) introStart = now;
    var x = reduceMotion ? 1 : clamp((now - introStart) / 2600, 0, 1);
    S.intro = x; S.introE = 1 - Math.pow(1 - x, 3); S.fade = sstep(0, .5, x); S.ignite = sstep(.2, .75, x);
    var introGate = sstep(.45, 1, x);

    S.t += dt; S.ft += .008 * k;
    var driftMul = 1 + S.boost;
    S.driftT += dt * driftMul;
    density = lerp(density, targetDensity, 1 - Math.pow(1 - .06, Math.max(k, .001)));
    S.diss = track(T.diss, b);

    S.embers = 0;
    stepCards(dt, b);
    if (POOL && k > 0) stepScene(dt, k, b); else { trailB.n = linesB.n = cometB.n = 0; S.active = 0; }
    if (!POOL) { S.blackhole = inWin(b, WIN.blackhole) ? winT(b, WIN.blackhole) : 0; }
    drawGL(b, k, now); frame.drawn = true;

    // HUD (throttled)
    if (hudEl && elPhase && !hudEl.classList.contains('hidden') && (now - hudTick) > 150) {
      hudTick = now; var lb = labelFor(b);
      elPhase.textContent = lb[0]; elSub.textContent = lb[1]; elScroll.textContent = Math.round(b / (NB - 1) * 100) + '%';
      elCount.textContent = S.active + ' + ' + S.embers; elBar.style.width = (b / (NB - 1) * 100) + '%';
      elPerf.textContent = Math.round(1 / fpsAvg) + 'fps · q' + q + ' · ' + scroller.kind + ' · beat ' + b.toFixed(2);
    }
    var hint = document.getElementById('scrollHint'); if (hint) hint.style.opacity = (b > .12 || x < .8) ? '0' : '1';

    // governor
    if (raw < .25 && !govLocked) {
      fpsAvg = lerp(fpsAvg, raw, .05);
      if (++gvFrames > 90) {
        gvSlow = fpsAvg > .026 ? gvSlow + 1 : Math.max(0, gvSlow - 1);
        gvFast = fpsAvg < .0135 ? gvFast + 1 : 0;
        if (gvSlow > 60 && q > 0) { qCeil = q - 1; setQuality(q - 1); gvSlow = 0; gvChange = now; }
        else if (gvFast > 600 && q < qCeil && now - gvChange > 8000) { setQuality(q + 1); gvFast = 0; gvChange = now; }
      }
    } else if (raw < .25) fpsAvg = lerp(fpsAvg, raw, .05);
  }

  /* ---- lifecycle --------------------------------------------------------- */
  var lastW = window.innerWidth, lastH = window.innerHeight;
  addEventListener('resize', function () {
    clearTimeout(state.rzTimer);
    state.rzTimer = setTimeout(function () {
      if (state.disposed) return;
      if (window.innerWidth !== lastW || Math.abs(window.innerHeight - lastH) > 80) { lastW = window.innerWidth; lastH = window.innerHeight; resizeGL(); frame.drawn = false; }
      else measure();
    }, 120);
  });
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { measure(); });
    ro.observe(document.body);
    state.observers.push(ro);
  }
  listen(glCanvas, 'webglcontextlost', function (e) { e.preventDefault(); state.lost = true; });
  listen(glCanvas, 'webglcontextrestored', function () {
    if (!state.disposed && hostHooks.onContextRestored) hostHooks.onContextRestored();
  });
  listen(document, 'visibilitychange', function () { last = 0; });

  doc.classList.add('gl'); doc.classList.toggle('lowfx', q <= 1);
  if (host) host.classList.add('is-gl');
  state.gl = gl;
  ['scene', 'particles'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  try { resizeGL(); } catch (e) { console.error(e); doc.classList.remove('gl'); if (host) host.classList.remove('is-gl'); fallback('render targets'); return; }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!state.disposed) measure(); });
  requestAnimationFrame(frame);

  /* ---- public surface for the production site -------------------------- */
  window.MultiverseBG = { state: S, tracks: T, beats: B, windows: WIN, hooks: hooks, scroller: scroller, setQuality: setQuality, __host: host };
})();

  return function disposeMultiverseBackground() {
    if (state.disposed) return;
    state.disposed = true;
    clearTimeout(state.rzTimer);
    state.rafs.slice().forEach(function (id) { window.cancelAnimationFrame(id); });
    state.rafs.length = 0;
    state.unsubs.forEach(function (fn) { fn(); });
    state.unsubs.length = 0;
    state.observers.forEach(function (o) { o.disconnect(); });
    state.observers.length = 0;
    if (state.freeGL) {
      try { state.freeGL(); } catch (e) { /* context may already be lost */ }
    }
    document.documentElement.classList.remove('gl', 'lowfx');
    if (host) host.classList.remove('is-gl');
    ['gl', 'scene', 'particles'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    if (window.MultiverseBG && window.MultiverseBG.__host === host) delete window.MultiverseBG;
    if (window.__runFallback2D) delete window.__runFallback2D;
  };
}

export { mountMultiverseBackground };
