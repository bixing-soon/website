(function () {
  var container = document.getElementById('keys');
  var hint = document.getElementById('key-hint');
  var status = document.getElementById('key-status');
  var scare = document.getElementById('jumpscare');
  var closeBtn = document.querySelector('.close');
  if (!container) return;

  var COUNT = 8;
  var PINK_MS = 1500;
  var SWAP_MS = 480;
  var SETTLE_MS = 260;
  var ROTATIONS = 5;
  var HAPPI_KEY = 'mutou:happi-mu';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the old version stored this permanently; drop it if it is still around
  try { window.localStorage.removeItem(HAPPI_KEY); } catch (e) { /* ignore */ }

  // the #happi-mu tag lives for the tab/session, not forever
  var cleared = window.location.hash === '#happi-mu';
  try {
    if (window.sessionStorage.getItem(HAPPI_KEY) === '1') cleared = true;
  } catch (e) { /* storage can be unavailable */ }

  // leaving the site clears the session tag; leaving this page drops the hash
  window.addEventListener('pagehide', function () {
    if (window.location.hash === '#happi-mu' && window.history && window.history.replaceState) {
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) { /* ignore */ }
    }
  });

  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener('navigate', function (e) {
      try {
        var dest = new URL(e.destination.url, window.location.href);
        if (dest.origin !== window.location.origin) {
          window.sessionStorage.removeItem(HAPPI_KEY);
        }
      } catch (err) { /* ignore */ }
    });
  }

  if (cleared) {
    try { window.sessionStorage.setItem(HAPPI_KEY, '1'); } catch (e) { /* ignore */ }
    if (window.location.hash !== '#happi-mu' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#happi-mu');
    }
    hint.textContent = 'challenge cleared.';
    status.textContent = '#happi-mu';
    status.classList.add('is-happi');
    if (closeBtn) closeBtn.classList.remove('is-hidden');
    return;
  }

  // mirrored shrine layout: four keys down each side, like the reference art
  var WIDE = [
    [0.20, 0.22], [0.40, 0.30], [0.20, 0.68], [0.40, 0.74],
    [0.60, 0.30], [0.80, 0.22], [0.60, 0.74], [0.80, 0.68]
  ];
  var NARROW = [
    [0.26, 0.14], [0.74, 0.14], [0.26, 0.38], [0.74, 0.38],
    [0.26, 0.62], [0.74, 0.62], [0.26, 0.86], [0.74, 0.86]
  ];

  var keys = [];
  var locked = false;
  var playable = false;
  var rotating = false;
  var raf = 0;
  var last = 0;
  var wonKey = null;

  function slotList() {
    return window.innerWidth < 760 ? NARROW : WIDE;
  }

  function slotPosition(slot, k) {
    var list = slotList();
    var s = list[slot % list.length];
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(vw - k.w, s[0] * vw - k.w / 2)),
      y: Math.max(0, Math.min(vh - k.h, s[1] * vh - k.h / 2))
    };
  }

  function makeKey(i) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key';
    el.setAttribute('aria-label', 'Key ' + (i + 1));
    el.innerHTML = '<svg viewBox="0 0 32 92" aria-hidden="true"><use href="#key-icon"></use></svg>';
    container.appendChild(el);

    return {
      el: el,
      slot: i,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      w: el.offsetWidth,
      h: el.offsetHeight,
      rot: 0
    };
  }

  function applyTarget(k) {
    var p = slotPosition(k.slot, k);
    k.tx = p.x;
    k.ty = p.y;
  }

  function layout() {
    keys.forEach(function (k) {
      k.w = k.el.offsetWidth;
      k.h = k.el.offsetHeight;
      applyTarget(k);
    });
  }

  function paint(k) {
    k.el.style.transform = 'translate3d(' + k.x.toFixed(2) + 'px,' + k.y.toFixed(2) + 'px,0) rotate(' + k.rot.toFixed(2) + 'deg)';
  }

  // shuffle the keys into each other's slots (derangement if possible)
  function assignSlots() {
    var arr = [];
    for (var i = 0; i < COUNT; i++) arr.push(i);
    for (var n = arr.length - 1; n > 0; n--) {
      var j = (Math.random() * (n + 1)) | 0;
      var tmp = arr[n];
      arr[n] = arr[j];
      arr[j] = tmp;
    }

    for (var tries = 0; tries < 8; tries++) {
      var stuck = false;
      for (var s = 0; s < COUNT; s++) {
        if (arr[s] === keys[s].slot) { stuck = true; break; }
      }
      if (!stuck) break;
      arr.push(arr.shift());
    }

    keys.forEach(function (k, i) {
      k.slot = arr[i];
      applyTarget(k);
    });
  }

  for (var i = 0; i < COUNT; i++) keys.push(makeKey(i));
  layout();
  keys.forEach(function (k) {
    k.x = k.tx;
    k.y = k.ty;
    k.rot = 0;
    paint(k);
  });

  // one key is pink while everything is still, then they all become gold
  var target = keys[(Math.random() * keys.length) | 0];
  target.el.classList.add('is-pink');

  window.setTimeout(function () {
    target.el.classList.remove('is-pink');

    if (reduced) {
      playable = true;
      hint.textContent = 'which one was pink?';
      return;
    }

    startRotation();
  }, PINK_MS);

  function startRotation() {
    rotating = true;
    hint.textContent = 'follow it.';
    last = 0;
    window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(frame);

    var round = 0;
    function step() {
      assignSlots();
      round++;
      if (round >= ROTATIONS) {
        window.setTimeout(finishRotation, SETTLE_MS);
      } else {
        window.setTimeout(step, SWAP_MS);
      }
    }
    step();
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    keys.forEach(function (k) {
      var ease = Math.min(1, dt * 5.5);
      k.x += (k.tx - k.x) * ease;
      k.y += (k.ty - k.y) * ease;
      k.x = Math.max(0, Math.min(vw - k.w, k.x));
      k.y = Math.max(0, Math.min(vh - k.h, k.y));
      paint(k);
    });

    if (rotating) raf = window.requestAnimationFrame(frame);
  }

  function finishRotation() {
    rotating = false;
    window.cancelAnimationFrame(raf);
    keys.forEach(function (k) {
      k.x = k.tx;
      k.y = k.ty;
      k.rot = 0;
      paint(k);
    });
    playable = true;
    hint.textContent = 'which one was pink?';
  }

  function centerWon() {
    if (!wonKey) return;
    var x = (window.innerWidth - wonKey.w) / 2;
    var y = (window.innerHeight - wonKey.h) / 2;
    wonKey.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(0deg) scale(1.35)';
  }

  window.addEventListener('resize', function () {
    layout();
    if (wonKey) {
      centerWon();
      return;
    }
    if (!rotating) {
      keys.forEach(function (k) {
        k.x = k.tx;
        k.y = k.ty;
        paint(k);
      });
    }
  });

  function win(k) {
    locked = true;
    rotating = false;
    wonKey = k;
    window.cancelAnimationFrame(raf);
    keys.forEach(function (other) {
      if (other !== k) other.el.classList.add('is-gone');
    });
    k.el.classList.add('is-correct');

    // snap the remembered key into the middle as the payoff
    if (!reduced) {
      k.el.style.transition = 'transform 0.65s cubic-bezier(0.2, 0.9, 0.25, 1)';
    }
    centerWon();

    try { window.sessionStorage.setItem(HAPPI_KEY, '1'); } catch (e) { /* ignore */ }
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#happi-mu');
    }

    hint.textContent = 'challenge cleared.';
    status.textContent = '#happi-mu';
    status.classList.add('is-happi');
    if (closeBtn) closeBtn.classList.remove('is-hidden');
  }

  function lose() {
    locked = true;
    rotating = false;
    window.cancelAnimationFrame(raf);
    hint.textContent = '';
    status.textContent = '';
    if (scare) scare.classList.add('is-live');
    window.setTimeout(function () {
      window.location.href = '/#curse-of-mu';
    }, 900);
  }

  container.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.key') : null;
    if (!el || locked || !playable) return;

    var picked = null;
    for (var j = 0; j < keys.length; j++) {
      if (keys[j].el === el) { picked = keys[j]; break; }
    }
    if (!picked) return;

    if (picked === target) win(picked);
    else lose();
  });
})();
