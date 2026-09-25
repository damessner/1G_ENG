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

  /* ---------------- timing ----------------
     Tuned for a child who is still learning to listen: the prompt is heard
     three times with a gap, and there is a real silence after the feedback
     sound before the next question starts. Advancing used to be a fixed
     820ms guess, which was shorter than the "Well done" clip, so the next
     prompt cut the praise off mid-word. Everything below now chains off the
     end of the audio itself instead of guessing.
  */
  var TIMING = {
    firstPlayMs: 320,      // let the layout settle before the first word
    repeatGapMs: 700,      // silence between repeats of the same prompt
    afterCorrectMs: 2000,  // silence between "Well done!" and the next one
    afterWrongMs: 2300     // longer on a mistake -- time to read the answer
  };

  /* Guards the repeat loop. Starting a new playthrough (or leaving the
     level) bumps this so any older chain quietly gives up instead of
     talking over the new audio. */
  var playToken = 0;

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
    dom.replay    = document.getElementById('btnReplay');
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

    /* The small re-hear button only makes sense when there is something to
       hear. Reading levels (the number sequences, "Read and Tap") have no
       prompt audio, so it is hidden rather than left there doing nothing. */
    if (dom.replay) dom.replay.hidden = keys.length === 0;

    var listen = UI.el('button', { class: 'listen-btn', type: 'button' });
    listen.appendChild(UI.el('span', { class: 'spk', text: '\uD83D\uDD0A' }));
    listen.appendChild(UI.el('span', { class: 'lbl', text: keys.length ? 'Listen' : 'Tap to hear' }));
    listen.addEventListener('click', function () {
      // Tapping restarts the three repeats from the beginning rather than
      // queueing another set on top of the ones already playing.
      stopPrompt();
      playPrompt(q);
      UI.flashClass(listen, 'pulse', 400);
    });
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

  /* The prompt is a single clip, or an ordered sequence (a word followed by
     its spelling). The whole thing is repeated, so a pupil hears
     "cat... c-a-t, c-a-t, c-a-t" rather than each part three times. */
  function playPrompt(q, repeats) {
    var keys = speakKeysOf(q);
    if (!keys.length) return Promise.resolve();
    var times = repeats || LG.Store.get('settings.repeats', 3);
    var token = ++playToken;

    function once() {
      return keys.length === 1
        ? LG.Audio.say(keys[0])
        : LG.Audio.playSequence(keys);
    }

    var chain = Promise.resolve();
    for (var i = 0; i < times; i++) {
      if (i > 0) chain = chain.then(function () {
        return token === playToken ? LG.Audio.wait(TIMING.repeatGapMs) : null;
      });
      chain = chain.then(function () {
        return token === playToken ? once() : null;
      });
    }
    return chain;
  }

  /* Stop any repeat loop that is still running. */
  function stopPrompt() {
    playToken += 1;
    LG.Audio.stop();
  }

  /* ---------------- pending timers ----------------
     Every deferred action for the current question is registered here so it
     can be cancelled. Previously a single `S.timer` slot was reused for both
     the audio and the advance, which meant whichever wrote last won and the
     other leaked. A leaked advance timer would fire later against whatever
     question happened to be on screen and skip straight past it -- which is
     exactly the "a question vanished" symptom pupils reported. */
  function setTimer(fn, ms) {
    if (!S) return null;
    var id = setTimeout(fn, ms);
    S.timers.push(id);
    return id;
  }

  function clearTimers() {
    if (!S || !S.timers) return;
    S.timers.forEach(clearTimeout);
    S.timers = [];
  }

  /* A mode may hold resources outside the DOM (choice.js listens on
     document). Tear it down before the next question renders, or listeners
     pile up one per question for the whole round. */
  function destroyHandle() {
    if (S && S.handle && typeof S.handle.destroy === 'function') {
      try { S.handle.destroy(); } catch (e) { /* never block the round */ }
    }
    if (S) S.handle = null;
  }

  /* ---------------- one question ---------------- */

  function next() {
    clearTimers();
    stopPrompt();
    destroyHandle();

    if (S.index >= S.questions.length) return finish();

    S.locked = false;
    S.submitted = false;
    S.advanced = false;
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
    setTimer(function () {
      if (S && !S.locked && S.current) playPrompt(S.current);
    }, TIMING.firstPlayMs);
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
    var feedbackSound;

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

      stopPrompt();
      feedbackSound = LG.Audio.say('ui/correct');
      UI.clear(dom.feedback);
      dom.feedback.className = 'feedback good';
      dom.feedback.textContent = Q_pick(PRAISE) + (S.streak >= 3 ? '  ' + S.streak + ' in a row!' : '');
      UI.burst(18, S.tapX, S.tapY);
    } else {
      S.streak = 0;
      stopPrompt();
      feedbackSound = LG.Audio.say('ui/wrong');
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

    /* Wait for the praise to finish, THEN pause, THEN move on. Chaining
       off the audio end event is what guarantees the next prompt cannot
       start on top of this one.

       `advanced` makes advance() idempotent: the promise chain and the
       safety timer both call it, and whichever loses must do nothing at
       all -- not even a second index increment. */
    var gap = ok ? TIMING.afterCorrectMs : TIMING.afterWrongMs;
    var round = S;
    var advance = function () {
      if (round.advanced) return;
      round.advanced = true;
      if (S !== round) return;          // pupil quit, or a new level started
      S.index += 1;
      next();
    };
    feedbackSound
      .then(function () { return LG.Audio.wait(gap); })
      .then(advance, advance);
    // Safety net: a missing or broken clip must never freeze the round.
    // Registered so the next question can cancel it.
    setTimer(advance, gap + 8000);
  }

  function Q_pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------------- finishing ---------------- */

  function finish() {
    clearTimers();
    stopPrompt();
    destroyHandle();
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
      locked: false, submitted: false, advanced: false,
      hinted: false, hintsUsed: 0,
      timers: [],
      startedAt: 0, handle: null
    };

    cacheDom();
    buildDots();

    /* The small re-hear control: a single play-through, for when the three
       automatic repeats were not enough. Holding the big Listen button is
       still the way to get the full set again. */
    if (dom.replay) {
      dom.replay.addEventListener('click', function () {
        if (!S || !S.current) return;
        stopPrompt();
        playPrompt(S.current, 1);
        UI.flashClass(dom.replay, 'pulse', 400);
      });
    }

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
    // Prefer the running level's own topic: App.currentTopic is only set if
    // we arrived via the level list, and quitting should still land
    // somewhere sensible if a level was started directly.
    var topic = (S && S.topic) || LG.App.currentTopic;
    if (S) { clearTimers(); destroyHandle(); }
    LG.Audio.stop();
    stopPrompt();
    S = null;
    if (topic) LG.App.showLevels(topic);
    else LG.App.showHome();
  }

  function isRunning() { return !!S; }

  return { start: start, quit: quit, isRunning: isRunning };
})();
