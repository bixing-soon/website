// bixing.me — WebGL "server room": a ring of computers you scroll around,
// drag to orbit, and click a screen to zoom into. Screens play a GIF, one at a
// time (the focused computer's), each with a CRT "static -> image" boot.
//
// If WebGL / three.js / image decoding is unavailable, nothing here runs and the
// sections simply stay as plain, stacked, readable content.

var overlayOpen = false;
var zoomOut = null;

var windowsById = {};
var windowListEls = [];
var lastApp = null;

/* ---------------- screens (overlays) ---------------- */

function openScreen(id, trigger) {
  var w = windowsById[id];
  if (!w) return;
  closeAll();
  overlayOpen = true;
  lastApp = trigger || null;
  w.classList.add('is-open');
  w.setAttribute('aria-hidden', 'false');
  w.inert = false;
  var close = w.querySelector('.window-close');
  if (close) close.focus();
}

function closeScreen(w) {
  if (!w) return;
  w.classList.remove('is-open');
  w.setAttribute('aria-hidden', 'true');
  w.inert = true;
  overlayOpen = false;
  if (zoomOut) zoomOut();
  if (lastApp) lastApp.focus();
}

function closeAll() {
  windowListEls.forEach(function (w) {
    if (w.classList.contains('is-open')) {
      w.classList.remove('is-open');
      w.setAttribute('aria-hidden', 'true');
      w.inert = true;
    }
  });
}

/* ---------------- base UI ---------------- */

function setupUI() {
  windowListEls = Array.prototype.slice.call(document.querySelectorAll('.window'));
  windowListEls.forEach(function (w) {
    windowsById[w.id] = w;
  });

  Array.prototype.forEach.call(document.querySelectorAll('.window-close'), function (btn) {
    btn.addEventListener('click', function () {
      closeScreen(btn.closest('.window'));
    });
  });

  windowListEls.forEach(function (w) {
    w.addEventListener('click', function (e) {
      if (e.target === w) closeScreen(w);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    windowListEls.forEach(function (w) {
      if (w.classList.contains('is-open')) closeScreen(w);
    });
  });
}

// Only once WebGL is up do the sections become closed overlays opened from the
// 3D scene. With no 3D (reduced motion / no WebGL / no three.js) the sections
// just stay as readable, stacked content.
function enter3DMode() {
  document.documentElement.classList.remove('pending3d');
  document.body.classList.remove('no-js');
  document.body.classList.add('js');
  document.body.classList.add('webgl');
  windowListEls.forEach(function (w) {
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-modal', 'true');
    w.setAttribute('aria-hidden', 'true');
    w.inert = true;
  });
}

// Hand the plain sections back if 3D can't run after all.
function revealContent() {
  document.documentElement.classList.remove('pending3d');
}

/* ---------------- 3D enhancement ---------------- */

var SCREENS = [
  { id: 'about', label: 'About', gif: '/images/anon-heart.gif' },
  { id: 'setup', label: 'Setup', gif: '/images/tomori-GUGUGAGA.gif' },
  { id: 'moments', label: 'Moments', gif: '/images/sakiko-spin.gif' },
  { id: 'links', label: 'Links', gif: '/images/soyo-peek.gif' }
];

var SCREEN_W = 480;
var SCREEN_H = 320;
var GIF_MAX_W = 320; // decode GIFs no larger than this (memory)
var BOOT_MS = 1150;
var GIF_INTERVAL = 1000 / 12; // draw the GIF ~12fps

function webglAvailable() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function init3D(THREE) {
  var canvas = document.getElementById('scene3d');
  var bank = document.querySelector('.gif-bank');
  if (!canvas) throw new Error('no canvas element');

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // static scene: shadows render once
  renderer.shadowMap.needsUpdate = true;

  var scene = new THREE.Scene();
  var PASTEL = 0xfff7fb;
  scene.background = new THREE.Color(PASTEL);
  scene.fog = new THREE.Fog(PASTEL, 15, 36);

  var camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2d8e6, 1.1));

  var key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  scene.add(key);

  var fill = new THREE.DirectionalLight(0xffd9ea, 0.5);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  /* ---- procedural textures ---- */

  function brushTexture(base, strength) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1400; i++) {
      var y = Math.random() * 256;
      var light = Math.random() < 0.5;
      x.strokeStyle = (light ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (Math.random() * strength) + ')';
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(256, y + (Math.random() * 2 - 1));
      x.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function ventTexture() {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = '#efe7ee';
    x.fillRect(0, 0, 256, 128);
    for (var ry = 10; ry < 122; ry += 15) {
      for (var rx = 10; rx < 250; rx += 17) {
        x.fillStyle = 'rgba(58,44,60,0.55)';
        x.beginPath();
        x.ellipse(rx + (ry % 2 ? 8 : 0), ry, 5, 2.6, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function plateTexture(text) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    var x = c.getContext('2d');
    x.fillStyle = '#ece2ea';
    x.fillRect(0, 0, 256, 64);
    x.strokeStyle = 'rgba(90,70,90,0.35)';
    x.lineWidth = 2;
    x.strokeRect(3, 3, 250, 58);
    x.fillStyle = '#6f5f74';
    x.font = 'bold 30px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // small tileable noise, upscaled for blocky CRT static
  function noiseTile() {
    var c = document.createElement('canvas');
    c.width = 120;
    c.height = 80;
    var x = c.getContext('2d');
    var img = x.createImageData(120, 80);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  var noiseTiles = [noiseTile(), noiseTile(), noiseTile()];

  /* ---- screen canvas state machine ---- */

  function makeScreenState(def) {
    var c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    var ctx = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return {
      def: def, canvas: c, ctx: ctx, texture: tex,
      mode: null,            // 'og' (omggif) | 'img' (fallback) | null
      img: null, loaded: false,
      gen: 0, phase: 'off', bootStart: 0, lastDraw: 0,
      ready: false, reader: null, gw: 0, gh: 0, dw: 0, dh: 0, scale: 1,
      count: 0, meta: null, durs: null, total: 0, start: 0, lastElapsed: 0, cur: -1,
      acc: null, accCtx: null, tmpCanvas: null, tmpCtx: null, tmpBuf: null, imageData: null,
      frames: null, decoder: null
    };
  }

  function drawOffBase(state) {
    var ctx = state.ctx;
    ctx.fillStyle = '#241d2b';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (var y = 0; y < SCREEN_H; y += 3) ctx.fillRect(0, y, SCREEN_W, 1);
  }

  function drawImageCover(state, now) {
    var ctx = state.ctx;

    if (state.mode === 'og') {
      if (!state.ready) return false;
      drawStreaming(state, now);
      return true;
    }

    if (state.mode === 'img') {
      var img = state.img;
      if (!state.loaded || !img || !img.naturalWidth) return false;
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var s = Math.max(SCREEN_W / iw, SCREEN_H / ih);
      ctx.drawImage(img, (SCREEN_W - iw * s) / 2, (SCREEN_H - ih * s) / 2, iw * s, ih * s);
      return true;
    }

    return false;
  }

  function drawScanlines(ctx, alpha) {
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    for (var y = 0; y < SCREEN_H; y += 3) ctx.fillRect(0, y, SCREEN_W, 1);
  }

  function drawNoise(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseTiles[(Math.random() * noiseTiles.length) | 0], 0, 0, SCREEN_W, SCREEN_H);
    ctx.imageSmoothingEnabled = true;
  }

  function drawBoot(state, p, now) {
    var ctx = state.ctx;
    var reveal = p <= 0.3 ? 0 : (p - 0.3) / 0.7;
    var edge = SCREEN_H * reveal;

    drawOffBase(state);

    if (reveal > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SCREEN_W, edge);
      ctx.clip();
      if (!drawImageCover(state, now)) drawOffBase(state);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, Math.max(0, edge - 3), SCREEN_W, 3);
    }

    if (reveal < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, edge, SCREEN_W, SCREEN_H - edge);
      ctx.clip();
      drawNoise(ctx);
      ctx.restore();
    }

    if (p < 0.3) {
      ctx.globalAlpha = 1 - p / 0.3;
      drawNoise(ctx);
      ctx.globalAlpha = 1;
    }

    drawScanlines(ctx, 0.1);
  }

  function drawOn(state, now) {
    var ctx = state.ctx;
    drawOffBase(state);
    drawImageCover(state, now);
    drawScanlines(ctx, 0.07);
  }

  /* ---- one screen per computer ---- */

  function makeUnit(def, index) {
    var g = new THREE.Group();
    var state = makeScreenState(def);

    var shell = new THREE.MeshStandardMaterial({
      map: brushTexture('#f7eef5', 0.05),
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.15
    });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 1.2), shell);
    body.position.y = 1.0;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    var ventMat = new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: 0.7 });
    var grille = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.44), ventMat);
    grille.position.set(0, 0.42, 0.601);
    g.add(grille);

    var sideGeo = new THREE.PlaneGeometry(0.9, 1.3);
    var sideL = new THREE.Mesh(sideGeo, ventMat);
    sideL.position.set(-0.701, 1.0, 0);
    sideL.rotation.y = -Math.PI / 2;
    g.add(sideL);
    var sideR = new THREE.Mesh(sideGeo, ventMat);
    sideR.position.set(0.701, 1.0, 0);
    sideR.rotation.y = Math.PI / 2;
    g.add(sideR);

    var bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.78, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x302837, roughness: 0.4, metalness: 0.2 })
    );
    bezel.position.set(0, 1.24, 0.6);
    g.add(bezel);

    var screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.64),
      new THREE.MeshBasicMaterial({ map: state.texture, toneMapped: false })
    );
    screen.position.set(0, 1.24, 0.64);
    screen.userData.screenId = def.id;
    g.add(screen);

    var plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.16),
      new THREE.MeshStandardMaterial({ map: plateTexture('\u78A7\u661F-' + (index + 1).toString().padStart(2, '0')), roughness: 0.6 })
    );
    plate.position.set(0, 0.76, 0.601);
    g.add(plate);

    var footMat = new THREE.MeshStandardMaterial({ color: 0xdccdd8, roughness: 0.8 });
    var footGeo = new THREE.BoxGeometry(0.16, 0.12, 0.16);
    [[-0.55, -0.45], [0.55, -0.45], [-0.55, 0.45], [0.55, 0.45]].forEach(function (p) {
      var foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(p[0], 0.06, p[1]);
      foot.castShadow = true;
      g.add(foot);
    });

    var leds = [];
    var ledColors = [0xef94bd, 0xb6a4e6, 0x83d6a8];
    for (var i = 0; i < 3; i++) {
      var led = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        new THREE.MeshBasicMaterial({ color: ledColors[i], transparent: true })
      );
      led.position.set(-0.4 + i * 0.18, 0.62, 0.606);
      led.userData.phase = i * 1.3;
      g.add(led);
      leds.push(led);
    }

    g.userData.screen = screen;
    g.userData.leds = leds;
    g.userData.state = state;
    return g;
  }

  var N = SCREENS.length;
  var R = 5;
  var STEP = (Math.PI * 2) / N;
  var NORMAL_DIST = 4.8;
  var ZOOM_DIST = 2.1;
  var LOOK_Y = 1.15;

  var screens = [];
  var states = [];
  var allLeds = [];
  SCREENS.forEach(function (def, i) {
    var unit = makeUnit(def, i);
    var angle = i * STEP;
    unit.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R);
    unit.rotation.y = angle;
    scene.add(unit);
    screens.push(unit.userData.screen);
    states.push(unit.userData.state);
    allLeds = allLeds.concat(unit.userData.leds);
    drawOffBase(unit.userData.state);
    unit.userData.state.texture.needsUpdate = true;
  });

  /* ---- GIF loading: only the focused computer ---- */

  function wrapIndex(i) {
    return ((i % N) + N) % N;
  }

  var activeIndex = -1;

  function closeFrames(state) {
    state.ready = false;
    state.reader = null;
    state.meta = null;
    state.durs = null;
    state.acc = null;
    state.accCtx = null;
    state.tmpCanvas = null;
    state.tmpCtx = null;
    state.tmpBuf = null;
    state.imageData = null;
    state.frames = null;
    state.decoder = null;
    state.cur = -1;
  }

  function unloadScreen(state) {
    state.gen += 1;
    state.loaded = false;
    state.mode = null;
    state.total = 0;
    closeFrames(state);
    if (state.img) {
      if (bank && state.img.parentNode) bank.removeChild(state.img);
      state.img.src = '';
      state.img = null;
    }
    state.phase = 'off';
    drawOffBase(state);
    state.texture.needsUpdate = true;
  }

  function loadFallbackImg(state, gen) {
    state.mode = 'img';
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () { if (state.gen === gen) state.loaded = true; };
    img.onerror = function () { state.loaded = false; };
    img.src = state.def.gif;
    state.img = img;
    state.loaded = false;
    if (bank) bank.appendChild(img);
  }

  // Stream the GIF: keep one composited buffer and composite frames forward as
  // time advances, honoring transparency and disposal. Memory stays ~constant
  // no matter how many frames the GIF has (some here have 100+).
  function prepareReader(state, reader) {
    var gw = reader.width;
    var gh = reader.height;
    var count = reader.numFrames();
    var scale = Math.min(1, GIF_MAX_W / gw);
    var dw = Math.max(1, Math.round(gw * scale));
    var dh = Math.max(1, Math.round(gh * scale));

    var meta = new Array(count);
    var durs = new Float64Array(count);
    var total = 0;
    for (var i = 0; i < count; i++) {
      var info = reader.frameInfo(i);
      var d = info.delay || 10;
      meta[i] = { x: info.x, y: info.y, w: info.width, h: info.height, disposal: info.disposal };
      durs[i] = d * 10;
      total += d * 10;
    }

    var acc = document.createElement('canvas');
    acc.width = dw;
    acc.height = dh;
    var tmp = document.createElement('canvas');
    tmp.width = gw;
    tmp.height = gh;

    state.reader = reader;
    state.gw = gw;
    state.gh = gh;
    state.dw = dw;
    state.dh = dh;
    state.scale = scale;
    state.count = count;
    state.meta = meta;
    state.durs = durs;
    state.total = total || 1;
    state.acc = acc;
    state.accCtx = acc.getContext('2d');
    state.tmpCanvas = tmp;
    state.tmpCtx = tmp.getContext('2d');
    state.tmpBuf = new Uint8ClampedArray(gw * gh * 4);
    state.imageData = state.tmpCtx.createImageData(gw, gh);
    state.lastElapsed = 0;
    state.start = performance.now();
    state.ready = true;
    resetComposite(state);
  }

  function resetComposite(state) {
    if (state.accCtx) state.accCtx.clearRect(0, 0, state.dw, state.dh);
    state.cur = -1;
  }

  function composeTo(state, target) {
    var meta = state.meta;
    for (var i = state.cur + 1; i <= target; i++) {
      if (i > 0 && meta[i - 1].disposal === 2) {
        var p = meta[i - 1];
        state.accCtx.clearRect(p.x * state.scale, p.y * state.scale, p.w * state.scale, p.h * state.scale);
      }
      state.tmpBuf.fill(0);
      state.reader.decodeAndBlitFrameRGBA(i, state.tmpBuf);
      state.imageData.data.set(state.tmpBuf);
      state.tmpCtx.clearRect(0, 0, state.gw, state.gh);
      state.tmpCtx.putImageData(state.imageData, 0, 0);
      // source-over: transparent pixels leave the composite untouched
      state.accCtx.drawImage(state.tmpCanvas, 0, 0, state.gw, state.gh, 0, 0, state.dw, state.dh);
      state.cur = i;
    }
  }

  function drawStreaming(state, now) {
    var elapsed = (now - state.start) % state.total;
    if (elapsed < state.lastElapsed) resetComposite(state); // wrapped
    state.lastElapsed = elapsed;

    var target = state.count - 1;
    var acc = 0;
    for (var i = 0; i < state.count; i++) {
      acc += state.durs[i];
      if (elapsed < acc) { target = i; break; }
    }
    if (target < state.cur) resetComposite(state);
    composeTo(state, target);

    var w = state.dw;
    var h = state.dh;
    var s = Math.max(SCREEN_W / w, SCREEN_H / h);
    state.ctx.drawImage(state.acc, (SCREEN_W - w * s) / 2, (SCREEN_H - h * s) / 2, w * s, h * s);
  }

  function loadScreen(state) {
    state.gen += 1;
    var gen = state.gen;

    if (!window.GifReader) {
      loadFallbackImg(state, gen);
      return;
    }

    state.mode = 'og';
    fetch(state.def.gif)
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) {
        if (state.gen !== gen) return;
        prepareReader(state, new window.GifReader(new Uint8Array(buf)));
      })
      .catch(function () {
        if (state.gen === gen) loadFallbackImg(state, gen);
      });
  }

  function activateScreen(index) {
    if (index === activeIndex) return;
    if (activeIndex >= 0) unloadScreen(states[activeIndex]);
    activeIndex = index;
    var state = states[index];
    loadScreen(state);
    state.phase = 'boot';
    state.bootStart = performance.now();
    state.lastDraw = 0;
  }

  /* ---- camera + state ---- */

  var focus = 0;
  var focusSmooth = 0;
  var dist = NORMAL_DIST;
  var distTarget = NORMAL_DIST;
  var yaw = 0;
  var pitch = 0.2;
  var lookAtPoint = new THREE.Vector3(0, LOOK_Y, R);

  function nearestIndex(target) {
    while (target - focusSmooth > N / 2) target -= N;
    while (focusSmooth - target > N / 2) target += N;
    return target;
  }

  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var dragging = false;
  var moved = 0;
  var lastX = 0;
  var lastY = 0;
  var hovered = false;

  function setPointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(screens, false)[0];
    return hit ? hit.object : null;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (overlayOpen) return;
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    requestRender();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (overlayOpen) return;
    setPointer(e);
    if (dragging) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.006;
      pitch = Math.max(-0.1, Math.min(1.0, pitch + dy * 0.005));
      requestRender();
      return;
    }
    var over = !!pick();
    if (over !== hovered) {
      hovered = over;
      canvas.style.cursor = over ? 'pointer' : 'grab';
    }
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    requestRender();
    if (overlayOpen) return;
    if (moved > 6) return;
    setPointer(e);
    var hit = pick();
    if (!hit) return;
    var id = hit.userData.screenId;
    var idx = 0;
    for (var i = 0; i < SCREENS.length; i++) {
      if (SCREENS[i].id === id) idx = i;
    }
    focus = nearestIndex(idx);
    distTarget = ZOOM_DIST;
    requestRender();
    window.setTimeout(function () { openScreen(id); }, 680);
  });

  canvas.addEventListener('pointercancel', function () { dragging = false; });

  window.addEventListener('wheel', function (e) {
    if (overlayOpen) return;
    e.preventDefault();
    focus = nearestIndex(focus + (e.deltaY > 0 ? 1 : -1));
    requestRender();
  }, { passive: false });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    requestRender();
  });

  zoomOut = function () { distTarget = NORMAL_DIST; requestRender(); };

  /* ---- render loop (on demand) ---- */

  var clock = new THREE.Clock();
  var running = false;

  function drawFrame() {
    var t = clock.getElapsedTime();

    focusSmooth += (focus - focusSmooth) * 0.09;
    dist += (distTarget - dist) * 0.08;

    var moving = dragging ||
      Math.abs(focus - focusSmooth) > 0.002 ||
      Math.abs(distTarget - dist) > 0.002;

    var angle = focusSmooth * STEP;
    lookAtPoint.set(Math.sin(angle) * R, LOOK_Y, Math.cos(angle) * R);

    var dirX = Math.sin(angle + yaw) * Math.cos(pitch);
    var dirY = Math.sin(pitch);
    var dirZ = Math.cos(angle + yaw) * Math.cos(pitch);

    camera.position.set(
      lookAtPoint.x + dirX * dist,
      lookAtPoint.y + dirY * dist,
      lookAtPoint.z + dirZ * dist
    );
    camera.lookAt(lookAtPoint);

    for (var l = 0; l < allLeds.length; l++) {
      var led = allLeds[l];
      led.material.opacity = moving
        ? 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + led.userData.phase))
        : 1;
    }

    // screen animation: the focused computer boots then plays its GIF
    var animating = false;
    if (!overlayOpen) {
      if (!moving) {
        activateScreen(wrapIndex(Math.round(focusSmooth)));
      }
      if (activeIndex >= 0) {
        var s = states[activeIndex];
        var nowMs = performance.now();
        if (s.phase === 'boot') {
          var p = (nowMs - s.bootStart) / BOOT_MS;
          if (p >= 1) {
            s.phase = 'on';
            drawOn(s, nowMs);
          } else {
            drawBoot(s, p, nowMs);
          }
          s.texture.needsUpdate = true;
          animating = true;
        } else if (s.phase === 'on') {
          if (nowMs - s.lastDraw >= GIF_INTERVAL) {
            drawOn(s, nowMs);
            s.texture.needsUpdate = true;
            s.lastDraw = nowMs;
          }
          animating = true;
        }
      }
    }

    renderer.render(scene, camera);

    if (moving || animating) {
      requestAnimationFrame(drawFrame);
    } else {
      running = false;
    }
  }

  function requestRender() {
    if (running) return;
    running = true;
    requestAnimationFrame(drawFrame);
  }

  canvas.style.cursor = 'grab';
  requestRender();
}

/* ---------------- boot ---------------- */

setupUI();

(function maybe3D() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { revealContent(); return; }
  if (!webglAvailable()) { revealContent(); return; }
  import('./vendor/three.module.js')
    .then(function (THREE) {
      try {
        init3D(THREE);
        enter3DMode();
      } catch (err) {
        revealContent();
        if (window.console) console.warn('3D scene failed; showing plain content:', err);
      }
    })
    .catch(function () {
      revealContent();
    });
})();
