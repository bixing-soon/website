// bixing.me — WebGL skyscraper city: a ring of towers you scroll around and
// drag to orbit. Each tower carries a big "page" screen (a section of the site,
// drawn to a canvas and clickable to zoom into) plus a small, tilted decorative
// GIF screen with a CRT "static -> image" boot. A hidden pink window on a
// tower's back zooms into the portfolio.
//
// If WebGL / three.js / image decoding is unavailable, nothing here runs.

function enter3DMode() {
  document.body.classList.remove('no-js');
  document.body.classList.add('js');
  document.body.classList.add('webgl');
  revealContent();
}

// Hide the loading screen once the scene is up — but hold it for at least a beat
// so it never blinks past too fast.
function revealContent() {
  var elapsed = performance.now() - (window.__boot || 0);
  var wait = Math.max(0, 1000 - elapsed);
  window.setTimeout(function () {
    document.documentElement.classList.remove('pending3d');
  }, wait);
}

/* ---------------- 3D enhancement ---------------- */

// Each billboard is its own little page: a title bar, a heading, some body,
// and optionally a spec/link list or tag chips. `label` is the window title,
// `sub` a muted subtitle under the heading.
var SCREENS = [
  {
    id: 'welcome', label: 'Welcome', gif: '/images/anon-heart.gif',
    heading: 'Hiya, I\u2019m bixing.',
    sub: 'welcome to my corner of the internet',
    paras: [
      'feel free to take a look around.'
    ],
    links: [
      { icon: 'github', url: 'https://github.com/bixing-soon' },
      { icon: 'bilibili', url: 'https://b23.tv/qtjpVnX' },
      { icon: 'discord', url: 'https://discord.com/users/1182958535290662932' }
    ],
    textLink: { label: 'Source Code', url: 'https://github.com/bixing-soon/website' }
  },
  {
    id: 'setup', label: 'Setup', gif: '/images/tomori-GUGUGAGA.gif',
    heading: 'PLACEHOLDER'
  },
  {
    id: 'moments', label: 'Moments', gif: '/images/uika-throws-mutsumi.gif',
    heading: 'PLACEHOLDER'
  },
  {
    id: 'links', label: 'Links', gif: '/images/soyo-peek.gif',
    heading: 'PLACEHOLDER'
  }
];

// Icon assets. Self-hosted images (served from /images/* like the GIFs, i.e.
// from the R2 bucket in production and ./images in dev), so the page never
// depends on a foreign host at runtime. Drop the files in and they're picked
// up; anything missing falls back to the inline vector glyph further down.
var ICON_SRC = {
  github: '/images/github.svg',
  bilibili: '/images/bilibili.svg',
  discord: '/images/discord.svg'
};

// Loaded <img> elements, keyed by icon name; filled in by preloadIcons().
var ICON_IMAGES = {};

// Preload every icon a screen references so contentTexture can draw it
// synchronously. Resolves once they all settle (loaded or failed); a slow or
// missing icon just means that button falls back to its vector glyph.
function preloadIcons() {
  var names = {};
  SCREENS.forEach(function (def) {
    (def.links || []).forEach(function (lk) {
      if (lk.icon && ICON_SRC[lk.icon]) names[lk.icon] = true;
    });
  });
  var tasks = Object.keys(names).map(function (name) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { ICON_IMAGES[name] = img; resolve(); };
      img.onerror = function () { resolve(); };
      img.src = ICON_SRC[name];
    });
  });
  var timeout = new Promise(function (resolve) { window.setTimeout(resolve, 4000); });
  return Promise.race([Promise.all(tasks), timeout]);
}

// Recolour a monochrome brand glyph to the page accent so any installed icon
// (often solid black) reads on the dark button. Returns a cached offscreen
// canvas, or null when the image isn't loaded.
var iconTint = {};
function tintedIcon(name, color, size) {
  var img = ICON_IMAGES[name];
  if (!img) return null;
  var key = name + '|' + color + '|' + size;
  if (iconTint[key]) return iconTint[key];
  var off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  var octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, size, size);
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = color;
  octx.fillRect(0, 0, size, size);
  iconTint[key] = off;
  return off;
}

// GIF decode canvas (small; the animated screens are decorative).
var SCREEN_W = 480;
var SCREEN_H = 320;
// Content pages are drawn much larger so they stay crisp when zoomed into.
var PAGE_W = 1080;
var PAGE_H = 720;
// On-screen "page" billboard size in world units (matches the PlaneGeometry in
// makeUnit). Kept here so the zoom-fit maths and the mesh stay in sync.
var CONTENT_W = 1.8;
var CONTENT_H = 1.2;
// Canvas font stack. Avoid generic keywords (e.g. ui-rounded) so an unsupported
// family can't reject the whole `font` assignment; quoted names fall back safely.
var FONT = '"Noto Sans CJK JP", "Noto Sans", "Quicksand", "Nunito", system-ui, sans-serif';
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

  var scene = new THREE.Scene();
  var HAZE = 0x40313f; // dark, gloomy pink haze
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.Fog(HAZE, 5, 32);

  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);

  scene.add(new THREE.HemisphereLight(0xb9a7c6, 0x2a2130, 0.6));

  var key = new THREE.DirectionalLight(0xffe0ef, 0.55);
  key.position.set(6, 20, 8);
  scene.add(key);

  var fill = new THREE.DirectionalLight(0xd9a0c8, 0.3);
  fill.position.set(-8, -6, -6);
  scene.add(fill);

  /* ---- procedural textures ---- */

  // A tile of a night skyscraper facade. Returns a colour map plus an emissive
  // "glow" map (lit windows only) so windows glow against the gloom.
  function facadeTexture(seed) {
    var W = 128;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = W;
    var x = c.getContext('2d');
    var g = document.createElement('canvas');
    g.width = W;
    g.height = W;
    var gx = g.getContext('2d');

    var bases = ['#2a2230', '#2f2635', '#241d2b', '#332a3a'];
    x.fillStyle = bases[seed % bases.length];
    x.fillRect(0, 0, W, W);
    gx.fillStyle = '#000000';
    gx.fillRect(0, 0, W, W);

    x.fillStyle = 'rgba(0,0,0,0.35)';
    for (var mx = 0; mx < W; mx += 32) x.fillRect(mx, 0, 2, W);

    var cols = 4;
    var rows = 6;
    var pad = 6;
    var ww = (W - pad * (cols + 1)) / cols;
    var wh = (W - pad * (rows + 1)) / rows;
    var rnd = seed * 9973 + 7;
    function rand() { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; }

    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var wx = pad + col * (ww + pad);
        var wy = pad + r * (wh + pad);
        if (rand() < 0.22) {
          var lit = rand() < 0.5 ? '#ffcf8f' : '#ff9fc4';
          x.fillStyle = lit;
          x.fillRect(wx, wy, ww, wh);
          gx.fillStyle = lit;
          gx.fillRect(wx, wy, ww, wh);
        } else {
          x.fillStyle = '#161020';
          x.fillRect(wx, wy, ww, wh);
        }
      }
    }

    function texOf(canvas) {
      var t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    return { map: texOf(c), glow: texOf(g) };
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

  function makeScreenState(gifUrl) {
    var c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    var ctx = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return {
      url: gifUrl, canvas: c, ctx: ctx, texture: tex,
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

  // greedy word-wrap; returns the y of the next line
  function wrapText(ctx, text, px, py, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';
    for (var n = 0; n < words.length; n++) {
      var test = line + words[n] + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, px, py);
        py += lineHeight;
        line = words[n] + ' ';
      } else {
        line = test;
      }
    }
    ctx.fillText(line, px, py);
    return py + lineHeight;
  }

  function roundRectPath(ctx, rx, ry, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
  }

  // the pink circular close (X) button, top-right of every page
  function drawCloseButton(ctx, cx, cy, r) {
    ctx.fillStyle = '#ef94bd';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1a22';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    var d = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx + d, cy - d);
    ctx.lineTo(cx - d, cy + d);
    ctx.stroke();
  }

  // Brand glyphs (Simple Icons, 24x24 viewBox) drawn as vector paths so the
  // buttons need no image assets. Parsed once and cached as Path2D objects.
  var ICON_PATHS = {
    github: 'M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z',
    bilibili: 'M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z',
    discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z'
  };
  var iconCache = {};
  function iconPath(kind) {
    if (!ICON_PATHS[kind]) return null;
    if (!iconCache[kind]) iconCache[kind] = new Path2D(ICON_PATHS[kind]);
    return iconCache[kind];
  }

  // a single corner icon: dim and unobtrusive by default, bright white on
  // hover. Its rect is recorded so clicks (and hover) can be hit-tested.
  function drawIconLink(ctx, x, y, size, lk, hovered) {
    var color = hovered ? '#ffffff' : 'rgba(240,211,228,0.32)';
    var tinted = tintedIcon(lk.icon, color, size * 2);
    if (tinted) {
      ctx.drawImage(tinted, x, y, size, size);
    } else {
      var path = iconPath(lk.icon);
      if (path) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 24, size / 24);
        ctx.fillStyle = color;
        ctx.fill(path);
        ctx.restore();
      }
    }
  }

  // draws a page-like screen: window bar, heading, subtitle, body, rows, chips,
  // a hover-highlighted icon row, and a text link. Returns a redrawable texture.
  function contentTexture(def) {
    var c = document.createElement('canvas');
    c.width = PAGE_W;
    c.height = PAGE_H;
    var x = c.getContext('2d');
    var buttons = [];

    // (re)paint the page; hoverIcon is the hovered icon's index, or -1
    function draw(hoverIcon) {
    buttons.length = 0;
    var W = PAGE_W;
    var H = PAGE_H;
    var PAD = 62;
    var CW = W - PAD * 2;

    var grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2b2130');
    grad.addColorStop(1, '#382c3e');
    x.fillStyle = grad;
    x.fillRect(0, 0, W, H);

    var glow = x.createRadialGradient(W * 0.5, 0, 8, W * 0.5, 0, H);
    glow.addColorStop(0, 'rgba(239,148,189,0.14)');
    glow.addColorStop(1, 'rgba(239,148,189,0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, W, H);

    // title bar
    x.fillStyle = '#4c3e53';
    x.fillRect(0, 0, W, 84);
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.fillRect(0, 82, W, 2);

    x.fillStyle = '#ef94bd';
    x.beginPath();
    x.arc(48, 42, 12, 0, Math.PI * 2);
    x.fill();

    x.fillStyle = '#ead6e6';
    x.font = '700 34px ' + FONT;
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillText(def.label, 78, 44);

    drawCloseButton(x, W - 56, 42, 26);

    // content column
    x.textAlign = 'left';
    x.textBaseline = 'top';
    var y = 122;

    x.fillStyle = '#f4e4f0';
    x.font = '700 56px ' + FONT;
    x.fillText(def.heading, PAD, y);
    y += 62;

    if (def.sub) {
      x.fillStyle = '#b6a0ba';
      x.font = '400 28px ' + FONT;
      x.fillText(def.sub, PAD, y);
      y += 40;
    }

    x.strokeStyle = 'rgba(239,148,189,0.28)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(PAD, y + 10);
    x.lineTo(W - PAD, y + 10);
    x.stroke();
    y += 34;

    (def.paras || []).forEach(function (p) {
      x.fillStyle = '#cdb9d0';
      x.font = '400 30px ' + FONT;
      y = wrapText(x, p, PAD, y, CW, 42) + 18;
    });

    if (def.rows) {
      def.rows.forEach(function (row) {
        x.fillStyle = '#9d89a5';
        x.font = '400 28px ' + FONT;
        x.fillText(row[0], PAD, y + 2);
        x.fillStyle = '#e7d2e4';
        x.font = '600 30px ' + FONT;
        x.fillText(row[1], PAD + 340, y);
        y += 50;
      });
      y += 8;
    }

    if (def.chips) {
      var chipX = PAD;
      var chipH = 50;
      y += 4;
      x.font = '600 26px ' + FONT;
      def.chips.forEach(function (tag) {
        var cw = x.measureText(tag).width + 44;
        if (chipX + cw > W - PAD) {
          chipX = PAD;
          y += chipH + 12;
        }
        x.fillStyle = 'rgba(239,148,189,0.14)';
        roundRectPath(x, chipX, y, cw, chipH, chipH / 2);
        x.fill();
        x.strokeStyle = 'rgba(239,148,189,0.45)';
        x.lineWidth = 2;
        x.stroke();
        x.fillStyle = '#f0d3e4';
        x.textBaseline = 'middle';
        x.fillText(tag, chipX + 22, y + chipH / 2 + 1);
        x.textBaseline = 'top';
        chipX += cw + 14;
      });
    }

    if (def.links) {
      // brand icons tucked into the bottom-left corner; dim until hovered white
      var iconSize = 44;
      var iconGap = 26;
      var iconY = H - 34 - iconSize - 24;
      def.links.forEach(function (lk, i) {
        var ix = PAD + i * (iconSize + iconGap);
        drawIconLink(x, ix, iconY, iconSize, lk, hoverIcon === i);
        buttons.push({ kind: 'icon', index: i, x: ix, y: iconY, w: iconSize, h: iconSize, url: lk.url });
      });
    }

    if (def.textLink) {
      // a plain clickable text link, e.g. "Source Code", with a hand-drawn
      // underline; its rect is recorded so clicks can be hit-tested too
      var tl = def.textLink;
      x.textAlign = 'left';
      x.textBaseline = 'alphabetic';
      x.font = '600 30px ' + FONT;
      var tw = x.measureText(tl.label).width;
      var ty = y + 40;
      x.fillStyle = '#ef94bd';
      x.fillText(tl.label, PAD, ty);
      x.strokeStyle = 'rgba(239,148,189,0.55)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(PAD, ty + 10);
      x.lineTo(PAD + tw, ty + 10);
      x.stroke();
      if (tl.url) buttons.push({ x: PAD - 6, y: ty - 28, w: tw + 12, h: 46, url: tl.url });
      y = ty + 34;
    }

    // a small in-page footer bar, like a real page's status line
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillStyle = '#8b7893';
    x.font = '400 22px ' + FONT;
    x.fillText('bixing.me/' + def.id, PAD, H - 34);

    }

    draw(-1);

    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    function redraw(hoverIcon) {
      draw(hoverIcon);
      tex.needsUpdate = true;
    }

    return { texture: tex, buttons: buttons, redraw: redraw };
  }

  /* ---- one skyscraper per screen ---- */

  var BW = 2.0;   // tower footprint
  var BD = 2.0;
  var SCREEN_Y = 20; // billboards sit at the same height on every tower

  function makeUnit(def, index) {
    var g = new THREE.Group();

    var BH = 24 + ((index * 5) % 10); // uneven peaks, each above the billboard

    var facade = facadeTexture(index);
    facade.map.repeat.set(1, BH / 4.0);
    facade.glow.repeat.set(1, BH / 4.0);
    var sideMat = new THREE.MeshStandardMaterial({
      map: facade.map,
      emissiveMap: facade.glow,
      emissive: 0xffffff,
      emissiveIntensity: 1.1,
      roughness: 0.9
    });
    var capMat = new THREE.MeshStandardMaterial({ color: 0x161019, roughness: 1 });
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(BW, BH, BD),
      [sideMat, sideMat, capMat, capMat, sideMat, sideMat]
    );
    body.position.y = BH / 2;
    g.add(body);

    var antenna = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x120d18 })
    );
    antenna.position.set(0, BH + 1.2, 0);
    g.add(antenna);

    var frameMat = new THREE.MeshStandardMaterial({ color: 0x0f0b14, roughness: 0.6 });

    // main screen = the section content (static, not clickable)
    var contentFrame = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.32, 0.07), frameMat);
    contentFrame.position.set(0, SCREEN_Y, BD / 2 + 0.02);
    g.add(contentFrame);

    var contentTex = contentTexture(def);
    var content = new THREE.Mesh(
      new THREE.PlaneGeometry(CONTENT_W, CONTENT_H),
      new THREE.MeshBasicMaterial({ map: contentTex.texture, toneMapped: false })
    );
    content.position.set(0, SCREEN_Y, BD / 2 + 0.07);
    content.userData.screenIndex = index;
    content.userData.buttons = contentTex.buttons;
    content.userData.redraw = contentTex.redraw;
    g.add(content);

    // a small decorative GIF screen in a corner, tilted in 2D (its own rotation)
    var corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]]; // tr, tl, br, bl
    var tilts = [0.14, -0.14, 0.16, -0.16];
    var c = corners[index % 4];
    var dx = c[0] * 0.5;
    var dy = c[1] * 0.84;
    var gifStates = [];

    var dframe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.05), frameMat);
    dframe.position.set(dx, SCREEN_Y + dy, BD / 2 + 0.09);
    dframe.rotation.z = tilts[index % 4];
    g.add(dframe);

    var st = makeScreenState(def.gif);
    var decor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.38),
      new THREE.MeshBasicMaterial({ map: st.texture, toneMapped: false })
    );
    decor.position.set(dx, SCREEN_Y + dy, BD / 2 + 0.12);
    decor.rotation.z = tilts[index % 4];
    g.add(decor);
    gifStates.push(st);

    g.userData.contentScreen = content;
    g.userData.gifStates = gifStates;
    return g;
  }

  var N = SCREENS.length;
  var R = 6;
  var STEP = (Math.PI * 2) / N;
  var NORMAL_DIST = 6.5;
  // no fixed zoom distance — it is fit to the viewport in fitDistance(), below
  var LOOK_Y = SCREEN_Y;

  var contentScreens = [];
  var towerGifStates = [];
  var portfolioWindows = [];

  SCREENS.forEach(function (def, i) {
    var unit = makeUnit(def, i);
    var angle = i * STEP;
    unit.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R);
    unit.rotation.y = angle;
    scene.add(unit);
    contentScreens.push(unit.userData.contentScreen);
    unit.userData.gifStates.forEach(function (st) {
      drawOffBase(st);
      st.texture.needsUpdate = true;
    });
    towerGifStates.push(unit.userData.gifStates);

    // the literal window on the first tower that opens the portfolio
    if (i === 0) {
      var pw = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.82),
        new THREE.MeshBasicMaterial({ color: 0xffb6d6, toneMapped: false })
      );
      pw.position.set(0, SCREEN_Y, -(BD / 2 + 0.03)); // back of the tower, billboard height
      pw.rotation.y = Math.PI;                        // faces inward, away from the billboard
      pw.userData.portfolio = true;
      unit.add(pw);
      portfolioWindows.push(pw);
    }
  });

  // faint distant towers for depth — cheap: one shared material, no screens
  (function backgroundTowers() {
    var facade = facadeTexture(3);
    facade.map.repeat.set(1, 5);
    facade.glow.repeat.set(1, 5);
    var mat = new THREE.MeshStandardMaterial({
      map: facade.map,
      emissiveMap: facade.glow,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 1,
      color: 0x6f6478
    });
    var s = 20260;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var b = 0; b < 16; b++) {
      var a = (b / 16) * Math.PI * 2 + rnd() * 0.25;
      var rad = 16 + rnd() * 10;
      var h = 12 + rnd() * 26;
      var w = 1.8 + rnd() * 2.2;
      var t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      t.position.set(Math.sin(a) * rad, h / 2, Math.cos(a) * rad);
      t.rotation.y = a;
      scene.add(t);
    }
  })();

  // A bank of pink haze below the billboards. Many faint planes (rather than a
  // few strong ones) so the gradient reads smooth instead of banding; the
  // bottom-most are dense, so the tower bases are swallowed.
  (function groundHaze() {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#7a7a7a');
    g.addColorStop(1, '#000000');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    var alpha = new THREE.CanvasTexture(c);

    var levels = [
      [17, 0.12], [15, 0.2], [13, 0.3], [11, 0.42], [9, 0.55], [7, 0.72]
    ];
    levels.forEach(function (l) {
      var m = new THREE.Mesh(
        new THREE.CircleGeometry(72, 64),
        new THREE.MeshBasicMaterial({
          color: HAZE,
          alphaMap: alpha,
          transparent: true,
          opacity: l[1],
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = l[0];
      scene.add(m);
    });
  })();

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
    img.src = state.url;
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
    fetch(state.url)
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
    if (activeIndex >= 0) towerGifStates[activeIndex].forEach(unloadScreen);
    activeIndex = index;
    var now = performance.now();
    towerGifStates[index].forEach(function (st) {
      loadScreen(st);
      st.phase = 'boot';
      st.bootStart = now;
      st.lastDraw = 0;
    });
  }

  /* ---- camera + state ---- */

  var focus = 0;
  var focusSmooth = 0;
  var dist = NORMAL_DIST;
  var distTarget = NORMAL_DIST;
  var yaw = 0;
  var pitch = 0;
  var lookAtPoint = new THREE.Vector3(0, LOOK_Y, R);
  var zoomLook = null;    // glass world position while a zoom is active
  var zoomNormal = null;  // direction the glass faces
  var zoomTarget = 0;     // 0 = orbit pose, 1 = glass pose
  var zoomT = 0;          // blend between the two (0..1)
  var zoomedScreen = null; // the big screen we've zoomed into, or null

  // Distance at which a w x h plane just fills the viewport, plus a little
  // margin. A fixed zoom distance framed the page far too tightly on tall,
  // narrow phone screens (the page overflowed and the close button fell off
  // screen); fitting to the camera's aspect keeps the whole page reachable.
  function fitDistance(w, h) {
    var tanHalf = Math.tan(camera.fov * Math.PI / 360);
    var dH = (h / 2) / tanHalf;
    var dW = (w / 2) / (tanHalf * camera.aspect);
    return Math.max(dH, dW) * 1.15;
  }

  function startZoom(object) {
    zoomLook = new THREE.Vector3();
    object.getWorldPosition(zoomLook);
    zoomNormal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
    zoomTarget = 1;
    requestRender();
  }

  function leaveZoom() {
    zoomTarget = 0;
    zoomedScreen = null;
    distTarget = NORMAL_DIST;
    document.body.classList.remove('in-page');
    setHoverIcon(null, -1);
    requestRender();
  }

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
  // touch gesture state: lock to a horizontal (orbit) or vertical (move) axis
  // so a swipe can change towers without also tilting the camera
  var isTouch = false;
  var axis = null;
  var totDx = 0;
  var totDy = 0;
  var TOUCH_SLOP = 12;

  function setPointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var c = raycaster.intersectObjects(contentScreens, false)[0];
    if (c) return { kind: 'screen', mesh: c.object, uv: c.uv };
    var pw = raycaster.intersectObjects(portfolioWindows, false)[0];
    if (pw) return { kind: 'portfolio', mesh: pw.object, uv: pw.uv };
    return null;
  }

  // the close (X) button lives in the top-right of each page (matches
  // drawCloseButton in contentTexture)
  function onCloseButton(uv) {
    return !!uv && uv.x > 0.84 && uv.y > 0.82;
  }

  // a clickable region on the page (an icon or the text link), tested in
  // page-canvas pixels. UV (0,0) is the bottom-left of the plane, so y flips.
  function regionAt(mesh, uv) {
    var list = mesh && mesh.userData && mesh.userData.buttons;
    if (!list || !uv) return null;
    var px = uv.x * PAGE_W;
    var py = (1 - uv.y) * PAGE_H;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
    }
    return null;
  }

  // which corner icon is currently lit (repainted white on hover)
  var hoverMesh = null;
  var hoverIcon = -1;
  function setHoverIcon(mesh, iconIndex) {
    if (mesh === hoverMesh && iconIndex === hoverIcon) return;
    if (hoverMesh && hoverMesh.userData.redraw && hoverMesh !== mesh) {
      hoverMesh.userData.redraw(-1);
    }
    hoverMesh = mesh;
    hoverIcon = iconIndex;
    if (hoverMesh && hoverMesh.userData.redraw) hoverMesh.userData.redraw(hoverIcon);
    requestRender();
  }

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    isTouch = e.pointerType === 'touch';
    axis = null;
    totDx = 0;
    totDy = 0;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    requestRender();
  });

  canvas.addEventListener('pointermove', function (e) {
    setPointer(e);
    if (dragging) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (zoomedScreen) return; // a page doesn't orbit
      if (isTouch) {
        totDx += dx;
        totDy += dy;
        if (!axis && (Math.abs(totDx) > TOUCH_SLOP || Math.abs(totDy) > TOUCH_SLOP)) {
          axis = Math.abs(totDy) > Math.abs(totDx) ? 'y' : 'x';
        }
        if (axis === 'x') {
          // horizontal drag orbits; vertical is reserved for the swipe
          yaw -= dx * 0.006;
          requestRender();
        }
        return;
      }
      yaw -= dx * 0.006;
      pitch = Math.max(-0.1, Math.min(1.0, pitch + dy * 0.005));
      requestRender();
      return;
    }
    var hit = pick();
    var hot = false;
    var litMesh = null;
    var litIcon = -1;
    if (hit) {
      if (hit.kind === 'portfolio') {
        hot = true;
      } else {
        var region = regionAt(hit.mesh, hit.uv);
        if (zoomedScreen) {
          hot = zoomedScreen === hit.mesh && (onCloseButton(hit.uv) || !!region);
          if (zoomedScreen === hit.mesh && region && region.kind === 'icon') {
            litMesh = hit.mesh;
            litIcon = region.index;
          }
        } else {
          hot = hit.kind === 'screen';
        }
      }
    }
    setHoverIcon(litMesh, litIcon);
    canvas.style.cursor = hot ? 'pointer' : (zoomedScreen ? 'default' : 'grab');
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    requestRender();

    // a vertical swipe moves between towers — the touch equivalent of the wheel
    if (axis === 'y') {
      var swiped = Math.abs(totDy) > 30;
      axis = null;
      if (swiped) {
        focus = nearestIndex(focus + (totDy < 0 ? 1 : -1));
        requestRender();
      }
      return;
    }
    axis = null;

    if (moved > (isTouch ? TOUCH_SLOP : 6)) return; // it was a drag, not a click
    setPointer(e);
    var hit = pick();

    if (zoomedScreen) {
      // inside a page: the close (X) button leaves, link buttons open in a tab
      if (hit && hit.kind === 'screen' && hit.mesh === zoomedScreen) {
        if (onCloseButton(hit.uv)) {
          leaveZoom();
          return;
        }
        var region = regionAt(hit.mesh, hit.uv);
        if (region && region.url) window.open(region.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    if (!hit) return;
    if (hit.kind === 'portfolio') {
      focus = nearestIndex(0);
      startZoom(hit.mesh);
      distTarget = fitDistance(0.5, 0.82);
      requestRender();
      window.setTimeout(function () { window.location.href = '/portfolio/'; }, 800);
      return;
    }
    focus = nearestIndex(hit.mesh.userData.screenIndex);
    startZoom(hit.mesh);
    distTarget = fitDistance(CONTENT_W, CONTENT_H);
    zoomedScreen = hit.mesh;
    document.body.classList.add('in-page'); // hides the orbit HUD
    requestRender();
  });

  canvas.addEventListener('pointercancel', function () { dragging = false; axis = null; });

  // moving the pointer off the canvas should not leave an icon lit
  canvas.addEventListener('pointerleave', function () { setHoverIcon(null, -1); });

  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (zoomedScreen) return; // a page doesn't scroll or navigate the ring
    focus = nearestIndex(focus + (e.deltaY > 0 ? 1 : -1));
    requestRender();
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && zoomedScreen) leaveZoom();
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // re-fit the zoomed page if the viewport shape changed (e.g. rotation)
    if (zoomedScreen) distTarget = fitDistance(CONTENT_W, CONTENT_H);
    requestRender();
  });

  // Coming back via the browser Back button restores the zoomed state from the
  // bfcache, which left the view stuck zoomed in. Snap back to normal.
  window.addEventListener('pageshow', function () {
    zoomLook = null;
    zoomNormal = null;
    zoomTarget = 0;
    zoomT = 0;
    zoomedScreen = null;
    dist = NORMAL_DIST;
    distTarget = NORMAL_DIST;
    document.body.classList.remove('in-page');
    setHoverIcon(null, -1);
    requestRender();
  });

  /* ---- render loop (on demand) ---- */

  var running = false;

  function drawFrame() {
    focusSmooth += (focus - focusSmooth) * 0.09;
    dist += (distTarget - dist) * 0.08;

    var moving = dragging ||
      Math.abs(zoomTarget - zoomT) > 0.002 ||
      Math.abs(focus - focusSmooth) > 0.002 ||
      Math.abs(distTarget - dist) > 0.002;

    // blend the camera between the orbit pose and the glass pose
    zoomT += (zoomTarget - zoomT) * 0.15;
    if (zoomTarget === 0 && zoomT < 0.005) {
      zoomT = 0;
      zoomLook = null;
      zoomNormal = null;
    }

    var angle = focusSmooth * STEP;
    var lookX = Math.sin(angle) * R;
    var lookZ = Math.cos(angle) * R;
    var dirX = Math.sin(angle + yaw) * Math.cos(pitch);
    var dirY = Math.sin(pitch);
    var dirZ = Math.cos(angle + yaw) * Math.cos(pitch);
    var orbitPosX = lookX + dirX * dist;
    var orbitPosY = LOOK_Y + dirY * dist;
    var orbitPosZ = lookZ + dirZ * dist;

    var t = zoomLook ? zoomT : 0;
    var gLookX = lookX;
    var gLookY = LOOK_Y;
    var gLookZ = lookZ;
    var gPosX = orbitPosX;
    var gPosY = orbitPosY;
    var gPosZ = orbitPosZ;
    if (zoomLook) {
      gLookX = zoomLook.x;
      gLookY = zoomLook.y;
      gLookZ = zoomLook.z;
      gPosX = zoomLook.x + zoomNormal.x * dist;
      gPosY = zoomLook.y + zoomNormal.y * dist;
      gPosZ = zoomLook.z + zoomNormal.z * dist;
    }

    lookAtPoint.set(
      lookX + (gLookX - lookX) * t,
      LOOK_Y + (gLookY - LOOK_Y) * t,
      lookZ + (gLookZ - lookZ) * t
    );
    camera.position.set(
      orbitPosX + (gPosX - orbitPosX) * t,
      orbitPosY + (gPosY - orbitPosY) * t,
      orbitPosZ + (gPosZ - orbitPosZ) * t
    );
    camera.lookAt(lookAtPoint);

    // the focused tower's screen boots, then plays its GIF
    var animating = false;
    if (!moving) {
      activateScreen(wrapIndex(Math.round(focusSmooth)));
    }
    if (activeIndex >= 0) {
      var nowMs = performance.now();
      towerGifStates[activeIndex].forEach(function (s) {
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
      });
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

(function maybe3D() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { revealContent(); return; }
  if (!webglAvailable()) { revealContent(); return; }
  import('./vendor/three.module.js')
    .then(function (THREE) {
      // load local icon images first so the page textures draw with them
      return preloadIcons().then(function () { return THREE; });
    })
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
