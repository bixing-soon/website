/* ANON TOKYO — intro hand-off, access check, and dress-up room. */
(function () {
  'use strict';

  var body = document.body;

  var poster = document.getElementById('poster');
  var wordmark = document.getElementById('posterWordmark');
  var miniBrand = document.getElementById('miniBrand');

  var quiz = document.getElementById('quiz');
  var prompt = document.getElementById('quizPrompt');
  var card = document.getElementById('quizCard');
  var qCount = document.getElementById('qCount');
  var qText = document.getElementById('qText');
  var optionsEl = document.getElementById('options');
  var quizBar = document.getElementById('quizBar');

  var failScreen = document.getElementById('fail');
  var failError = document.getElementById('failError');
  var failDenied = document.getElementById('failDenied');

  var welcome = document.getElementById('welcome');
  var enterGameBtn = document.getElementById('enterGame');
  var construction = document.getElementById('construction');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------ access tag */

  // Mirrors mutou's #happi-mu: the pass lives for the tab/session, and the
  // hash only carries it across a reload. Leaving the page drops the hash.
  var CLEAR_TAG = '#anon-tokyo-cleared';
  var CLEAR_KEY = 'anontokyo:cleared';

  var cleared = window.location.hash === CLEAR_TAG;
  try {
    if (window.sessionStorage.getItem(CLEAR_KEY) === '1') cleared = true;
  } catch (e) { /* storage can be unavailable */ }

  window.addEventListener('pagehide', function () {
    if (window.location.hash === CLEAR_TAG && window.history && window.history.replaceState) {
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
          window.sessionStorage.removeItem(CLEAR_KEY);
        }
      } catch (err) { /* ignore */ }
    });
  }

  /* ------------------------------------------------------------ screens */

  function activate(el) {
    el.hidden = false;
    window.requestAnimationFrame(function () { el.classList.add('is-active'); });
  }

  function deactivate(el) {
    el.classList.remove('is-active');
    el.hidden = true;
  }

  /* ---------------------------------------------------- intro hand-off */

  var handedOff = false;
  var handoffDone = false;

  // The wordmark is revealed only after the script face is ready, so the poster
  // never flashes in a fallback font.
  function startIntro() {
    body.classList.add('fonts-ready');
    window.setTimeout(beginHandoff, 1000);
  }

  function beginHandoff() {
    if (handedOff) return;
    handedOff = true;

    if (reduceMotion || !wordmark.animate) {
      finishHandoff();
      return;
    }

    poster.classList.add('is-handoff');

    var from = wordmark.getBoundingClientRect();
    var to = miniBrand.getBoundingClientRect();
    var scale = to.width / Math.max(1, from.width);
    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    var anim = wordmark.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')' }
    ], {
      duration: 850,
      easing: 'cubic-bezier(.55, .06, .22, 1)',
      fill: 'forwards'
    });

    anim.onfinish = finishHandoff;
    // If the tab is throttled and the animation never reports finishing.
    window.setTimeout(finishHandoff, 1100);
  }

  function finishHandoff() {
    if (handoffDone) return;
    handoffDone = true;

    wordmark.style.opacity = '0';
    miniBrand.classList.add('is-visible');
    deactivate(poster);
    activate(quiz);

    window.setTimeout(function () { prompt.classList.add('is-flickering'); }, 1200);
    window.setTimeout(function () { prompt.classList.remove('is-flickering'); }, 2000);
    window.setTimeout(showCard, 2500);
  }

  /* -------------------------------------------------------------- quiz */

  var QUESTIONS = [
    {
      q: 'What instrument does Chihaya Anon play in MyGO!!!!!?',
      options: ['Drums', 'Rhythm guitar', 'Bass', 'Keyboard'],
      answer: 1
    },
    {
      q: "What is Anon's self-named clothing brand for the band's costumes?",
      options: ['ANON TOKYO', 'MyGO Closet', 'Haneoka Threads', 'Tokyo Ribbon'],
      answer: 0
    },
    {
      q: 'Which school does Anon attend?',
      options: ['Hanasakigawa Girls\' High School', 'Tsukinomori Girls\' Academy', 'Haneoka Girls\' High School', 'She is homeschooled'],
      answer: 2
    },
    {
      q: "When is Anon's birthday?",
      options: ['September 8', 'March 12', 'August 9', 'December 1'],
      answer: 0
    },
    {
      q: "Who is MyGO!!!!!'s vocalist?",
      options: ['Nagasaki Soyo', 'Shiina Taki', 'Kaname Raana', 'Takamatsu Tomori'],
      answer: 3
    }
  ];

  var current = 0;
  var locked = false;
  var cardShown = false;
  var failed = false;
  var anyWrong = false;

  function showCard() {
    if (cardShown) return;
    cardShown = true;
    quiz.classList.add('has-card');
    renderQuestion();
    card.hidden = false;
    card.classList.add('is-in');
  }

  function renderQuestion() {
    var q = QUESTIONS[current];
    locked = false;
    qCount.textContent = 'Question ' + (current + 1) + ' / ' + QUESTIONS.length;
    quizBar.style.width = (current / QUESTIONS.length * 100) + '%';
    qText.textContent = q.q;
    optionsEl.innerHTML = '';

    q.options.forEach(function (label, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';

      var key = document.createElement('span');
      key.className = 'option-key';
      key.textContent = 'ABCD'.charAt(i);

      var text = document.createElement('span');
      text.className = 'option-label';
      text.textContent = label;

      btn.appendChild(key);
      btn.appendChild(text);
      btn.addEventListener('click', function () { answer(i); });
      optionsEl.appendChild(btn);
    });
  }

  function setOptionsDisabled(state) {
    Array.prototype.forEach.call(optionsEl.querySelectorAll('button'), function (btn) {
      btn.disabled = state;
    });
  }

  // No feedback per question: the answer is remembered silently, and the
  // verdict only lands after the fifth one.
  function answer(index) {
    if (locked) return;
    var q = QUESTIONS[current];

    if (index !== q.answer) anyWrong = true;

    locked = true;
    setOptionsDisabled(true);
    quizBar.style.width = ((current + 1) / QUESTIONS.length * 100) + '%';

    window.setTimeout(function () {
      current += 1;
      if (current >= QUESTIONS.length) {
        if (anyWrong) {
          failSequence();
        } else {
          winSequence();
        }
        return;
      }
      card.classList.remove('is-in');
      void card.offsetWidth;
      renderQuestion();
      card.classList.add('is-in');
    }, 650);
  }

  /* ----------------------------------------------------------- failure */

  function failSequence() {
    if (failed) return;
    failed = true;

    body.classList.add('is-failing');
    deactivate(quiz);
    activate(failScreen);
    failScreen.classList.add('is-glitching');

    window.setTimeout(function () {
      failScreen.classList.remove('is-glitching');
      failError.hidden = true;
      failDenied.hidden = false;
      failDenied.classList.add('is-in');
    }, 1500);

    window.setTimeout(function () {
      failScreen.classList.add('is-blackout');
    }, 3400);

    // Fade to darkness, then the tower kicks them back out.
    window.setTimeout(function () {
      window.location.href = '/#anon-tokyo';
    }, 4500);
  }

  /* ------------------------------------------------------------- win */

  function winSequence() {
    try { window.sessionStorage.setItem(CLEAR_KEY, '1'); } catch (e) { /* ignore */ }
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', CLEAR_TAG); } catch (e) { /* ignore */ }
    }
    document.documentElement.classList.add('is-cleared');
    deactivate(quiz);
    activate(welcome);
  }

  // Already passed in this tab: skip the poster and the questions entirely.
  function showCleared() {
    try { window.sessionStorage.setItem(CLEAR_KEY, '1'); } catch (e) { /* ignore */ }
    if (window.location.hash !== CLEAR_TAG && window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', CLEAR_TAG); } catch (e) { /* ignore */ }
    }
    miniBrand.classList.add('is-visible');
    deactivate(poster);
    activate(welcome);
  }

  /* ------------------------------------------------------ step inside */

  enterGameBtn.addEventListener('click', function () {
    deactivate(welcome);
    activate(construction);
  });

  /* ---------------------------------------------------------- startup */

  var fonts = (document.fonts && document.fonts.load)
    ? document.fonts.load('400 100px "Anon Script"').catch(function () {})
    : Promise.resolve();
  var fallback = new Promise(function (resolve) {
    window.setTimeout(resolve, 1600);
  });

  Promise.race([fonts, fallback]).then(cleared ? showCleared : startIntro);
})();
