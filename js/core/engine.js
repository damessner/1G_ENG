/* =============================================================
   engine.js — runs one level from start to finish.

   The engine knows nothing about any particular subject. It asks a
   level for questions, hands each one to the mode the level names,
   and owns the parts that must feel identical in every game: audio
   playback, scoring, streaks, feedback timing and the progress dots.
   ============================================================= */
window.LG = window.LG || {};

LG.Engine = (function () {
  'use strict';

  var UI = LG.UI;
  var S = null;                 // round state

  var PRAISE = ['Yes!', 'Well done!', 'Correct!', 'Brilliant!', 'Got it!', 'Perfect!'];
  var RETRY  = ['Not quite', 'Try again', 'Almost!', 'Have another look'];

  /* ---------------- question generation ---------------- */

  function makeQuestions(level) {
    var out = [], seen = {}, guard = 0;
    while (out.length < level.count && guard < level.count * 40) {
      guard += 1;
      var q = level.build();
      var key = q.dedupe || JSON.stringify(q);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(q);
    }
    // If the level's word pool is smaller than its question count, the
    // loop above cannot avoid repeats. Rather than spin, allow them.
    while (out.length < level.count) out.push(level.build());
    return out;
  }

  function speakKeysOf(q) {
    if (!q.prompt || !q.prompt.speak) return [];
    return Array.isArray(q.prompt.speak) ? q.prompt.speak : [q.prompt.speak];
  }

  /* ---------------- screen wiring ---------------- */

  var dom = {};

  function cacheDom() {
    dom.btnQuit   = document.getElementById('btnQuit');
    dom.dots      = document.getElementById('progressDots');
    dom.streak    = document.getElementById('hudStreak');
    dom.streakNum = document.getElementById('hudStreakNum');
    dom.promptBox = document.getElementById('promptBox');
    dom.answer    = document.getElementById('answerArea');
    dom.feedback  = document.getElementById('feedback');
  }

  function buildDots() {
    UI.clear(dom.dots);
    for (var i = 0; i < S.questions.length; i++) {
      dom.dots.appendChild(UI.el('i', { class: 'dot' }));
    }
  }

  function paintDots() {
    var nodes = dom.dots.children;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].className = 'dot' + (i < S.index ? ' done' : '') + (i === S.index ? ' now' : '');
    }
  }

  /* ---------------- the prompt ---------------- */

  function paintPrompt(q) {
    UI.clear(dom.promptBox);
    var keys = speakKeysOf(q);

    var listen = UI.el('button', { class: 'listen-btn', type: 'button' });
    listen.appendChild(UI.el('span', { class: 'spk', text: '\uD83D\uDD0A' }));
    listen.appendChild(UI.el('span', { class: 'lbl', text: keys.length ? 'Listen' : 'Tap to hear' }));
    listen.addEventListener('click', function () { playPrompt(q); UI.flashClass(listen, 'pulse', 400); });
    dom.promptBox.appendChild(listen);

    if (q.prompt && q.prompt.swatch) {
      dom.promptBox.appendChild(UI.el('div', {
        class: 'big-swatch', style: 'background:' + q.prompt.swatch
      }));
    }

    if (q.prompt && q.prompt.show) {
      dom.promptBox.appendChild(UI.el('div', { class: 'prompt-text', text: q.prompt.show }));
    }
  }

  function playPrompt(q) {
    var keys = speakKeysOf(q);
    if (keys.length === 1) return LG.Audio.say(keys[0]);
    if (keys.length > 1) return LG.Audio.playSequence(keys);
    return Promise.resolve();
  }

  /* ---------------- one question ---------------- */

  function next() {
    if (S.index >= S.questions.length) return finish();

    S.locked = false;
    S.submitted = false;
    S.hinted = false;
    S.startedAt = Date.now();
    S.current = S.questions[S.index];

    UI.clear(dom.answer);
    UI.clear(dom.feedback);
    paintDots();
    paintPrompt(S.current);

    var mode = LG.Modes[S.level.mode];
    if (!mode) {
      UI.toast('Missing game mode: ' + S.level.mode);
      return finish();
    }

    var api = {
      submit: submit,
      lock: function () { S.locked = true; },
      isLocked: function () { return S.locked; }
    };

    S.handle = mode.render(dom.answer, S.current, api) || {};

    if (S.handle.hint) {
      var h = UI.el('button', { class: 'btn btn-ghost btn-hint', type: 'button', text: 'Give me a hint' });
      h.addEventListener('click', function () {
        if (S.locked) return;
        S.hinted = true;
        S.hintsUsed += 1;
        S.handle.hint();
      });
      dom.answer.appendChild(h);
    }

    // Give the layout a frame before audio, so the first syllable is
    // not swallowed by the render.
    setTimeout(function () { if (!S.locked) playPrompt(S.current); }, 160);
  }

  /* ---------------- answering ---------------- */

  function submit(ok, meta) {
    // NB: `locked` means "the pupil cannot answer again" and is set by the
    // mode via api.lock() *before* it calls us. So re-entry is guarded by
    // `submitted` instead -- sharing one flag here would silently discard
    // every answer.
    if (S.submitted) return;
    S.submitted = true;
    meta = meta || {};

    var seconds = (Date.now() - S.startedAt) / 1000;
    var fast = seconds < 3.2;
    var xp = 0;

    S.answered += 1;
    LG.Game.bumpStat('stats.answered');

    if (ok) {
      S.correct += 1;
      S.streak += 1;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      LG.Game.bumpStat('stats.correct');

      xp = 10 * S.level.difficulty;
      xp += Math.min(S.streak, 5) * 2;
      if (fast) xp += 3;
      if (S.hinted) xp = Math.round(xp * 0.6);
      S.xp += xp;

      LG.Audio.say('ui/correct');
      UI.clear(dom.feedback);
      dom.feedback.className = 'feedback good';
      dom.feedback.textContent = Q_pick(PRAISE) + (S.streak >= 3 ? '  ' + S.streak + ' in a row!' : '');
      UI.burst(18, S.tapX, S.tapY);
    } else {
      S.streak = 0;
      LG.Audio.say('ui/wrong');
      UI.clear(dom.feedback);
      dom.feedback.className = 'feedback bad';
      dom.feedback.textContent = Q_pick(RETRY);
      UI.shake(dom.answer);
      if (S.handle && S.handle.destroy) { /* keep the board visible to study */ }
      if (!document.querySelector('.opt.right, .slot.right')) {
        var mode = LG.Modes[S.level.mode];
        if (mode && mode.reveal) mode.reveal(dom.answer, S.current);
      }
    }

    dom.streakNum.textContent = String(S.streak);
    dom.streak.hidden = S.streak < 2;
    paintDots();

    var wait = ok ? 820 : 1500;
    S.timer = setTimeout(function () {
      S.index += 1;
      next();
    }, wait);
  }

  function Q_pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------------- finishing ---------------- */

  function finish() {
    LG.Audio.stop();
    var stars = LG.Game.starsFor(S.correct, S.answered);
    var accuracy = S.answered ? S.correct / S.answered : 0;
    var best = LG.Game.recordStars(S.topic.id, S.level.id, stars, accuracy);
    var gained = LG.Game.awardXP(S.xp);
    LG.Game.touchDay();

    var summary = {
      answered: S.answered,
      correct: S.correct,
      xp: S.xp,
      bestStreak: S.bestStreak,
      total: S.answered,
      // Only meaningful for spelling levels, and only if no hint was used.
      spelledClean: S.level.mode === 'assemble' && S.hintsUsed === 0
    };
    var badges = LG.Game.checkBadges(summary, S.topic);

    if (stars >= 3) LG.Audio.say('ui/levelComplete');
    LG.App.showResult({
      topic: S.topic, level: S.level, stars: stars, best: best,
      accuracy: accuracy, correct: S.correct, total: S.answered,
      xp: S.xp, totalXp: gained, badges: badges,
      isLast: S.topic.levels.indexOf(S.level) === S.topic.levels.length - 1
    });
    S = null;
  }

  /* ---------------- entry points ---------------- */

  function start(topic, level) {
    LG.Audio.stop();
    S = {
      topic: topic, level: level,
      mode: level.mode,
      questions: makeQuestions(level),
      index: 0, answered: 0, correct: 0,
      streak: 0, bestStreak: 0, xp: 0,
      locked: false, submitted: false, hinted: false, hintsUsed: 0,
      startedAt: 0, handle: null, timer: null
    };

    cacheDom();
    buildDots();
    dom.streak.hidden = true;
    dom.streakNum.textContent = '0';
    UI.show('game');

    // Warm the clips this round will need so taps are instant.
    var keys = [];
    S.questions.forEach(function (q) { keys = keys.concat(speakKeysOf(q)); });
    LG.Audio.prefetch(keys);

    next();
  }

  function quit() {
    if (S && S.timer) clearTimeout(S.timer);
    LG.Audio.stop();
    S = null;
    LG.App.showLevels(LG.App.currentTopic);
  }

  function isRunning() { return !!S; }

  return { start: start, quit: quit, isRunning: isRunning };
})();
