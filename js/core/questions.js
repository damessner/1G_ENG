/* =============================================================
   questions.js — the vocabulary topic authors write against.

   A level does not describe a screen. It describes how to BUILD a
   question, and the engine hands the result to whichever mode can
   play it. That indirection is what makes topics interchangeable:

     LG.Q.choice({ prompt: Q.read('c_t', 'word/cat'),
                   options: Q.letters('t', 3),
                   correct: 0 })

   Three question shapes cover every game in the app:
     choice    — pick one of several options
     assemble  — build a word / sequence from letter tiles
     quantity  — tap the right number of objects
   ============================================================= */
window.LG = window.LG || {};

LG.Q = (function () {
  'use strict';

  /* ---------------- randomness ---------------- */

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function sample(arr, n, exclude) {
    var pool = arr.filter(function (x) { return exclude == null || x !== exclude; });
    return shuffle(pool).slice(0, n);
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /* ---------------- prompts ----------------
     A prompt always knows HOW to be heard, and optionally what to show. */

  function audio(key) { return { speak: key, show: null }; }
  function read(text, key) { return { speak: key || null, show: text }; }
  function text(text) { return { speak: null, show: text }; }
  function sequence(keys, show) { return { speak: keys.slice(), show: show || null }; }

  /* ---------------- option builders ---------------- */

  function opt(kind, value, extra) {
    var o = { kind: kind, value: value };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  /* Letters as answer options. "hard" biases distractors toward the
     visually confusable set — b/d, p/q, m/n — which is where reading
     actually breaks down. */
  var CONFUSABLE = 'bdpqmnuvwyftrsz';

  function letters(answer, count, pool) {
    count = count || 3;
    var src = pool || 'abcdefghijklmnopqrstuvwxyz'.split('');
    var near = CONFUSABLE.split('').filter(function (c) { return c !== answer; });
    var set = [];
    // two confusable letters + the rest random: keeps it a real decision
    while (set.length < count) {
      var next = set.length < 2 && Math.random() < 0.7 ? pick(near) : pick(src);
      if (next !== answer && set.indexOf(next) === -1) set.push(next);
    }
    var all = shuffle([opt('letter', answer)].concat(set.map(function (c) { return opt('letter', c); })));
    return all;
  }

  function texts(answer, distractors) {
    return shuffle(distractors.map(function (d) { return opt('text', d); })
      .concat([opt('text', answer)]));
  }

  function emojis(answer, distractors) {
    return shuffle(distractors.map(function (d) { return opt('emoji', d); })
      .concat([opt('emoji', answer)]));
  }

  /* Colour options carry both the name (for labels and answers) and the
     paint (for display), so a level never has to repeat hex codes. */
  function swatches(answer, names, swatchMap, count) {
    var others = sample(names.filter(function (c) { return c !== answer; }), count || 3);
    return shuffle(others.map(function (c) { return opt('swatch', c, { bg: swatchMap[c] }); })
      .concat([opt('swatch', answer, { bg: swatchMap[answer] })]));
  }

  /* ---------------- question shapes ---------------- */

  function choice(spec) {
    return {
      type: 'choice',
      prompt: spec.prompt,
      options: spec.options,
      correct: spec.correct != null ? spec.correct
        : spec.options.findIndex(function (o) { return o.value === spec.answer; }),
      // Must be carried through, or the engine cannot tell two questions
      // about the same word apart and may repeat one.
      dedupe: spec.dedupe || spec.answer,
      explain: spec.explain || null
    };
  }

  function assemble(spec) {
    var word = spec.answer;
    return {
      type: 'assemble',
      prompt: spec.prompt,
      answer: word,
      letters: word.split(''),
      revealFirst: spec.revealFirst != null ? spec.revealFirst : (word.length <= 3 ? 1 : 0),
      dedupe: spec.dedupe || word,
      explain: spec.explain || null
    };
  }

  function quantity(spec) {
    return {
      type: 'quantity',
      prompt: spec.prompt,
      answer: spec.answer,
      pool: spec.pool != null ? spec.pool : Math.max(spec.answer + 6, 12),
      item: spec.item || { kind: 'emoji', value: '⭐' },
      operation: spec.operation || 'count',
      // Answer plus the starting number, so "count 7" and "count up to 12"
      // in the same level are treated as different questions.
      dedupe: spec.dedupe || (spec.operation + ':' + (spec.start != null ? spec.start : '') + ':' + spec.answer)
    };
  }

  /* ---------------- small conveniences ---------------- */

  function wordKey(w) { return 'word/' + String(w).toLowerCase(); }
  function spellKey(w) { return 'spell/' + String(w).toLowerCase(); }
  function numberWord(n) {
    var names = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
      'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
      'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
    return names[n] != null ? names[n] : String(n);
  }
  function numberKey(n) { return 'word/' + numberWord(n); }

  /* Blank out one letter of a word, returning the display string and the index. */
  function gap(word, index) {
    var chars = word.split('');
    chars[index] = '_';
    return { show: chars.join(' '), index: index };
  }

  /* Choose a gap index that keeps the missing letter meaningful:
     never first, never last, and prefer middle letters for blends. */
  function gapIndex(word) {
    return randInt(1, word.length - 2);
  }

  return {
    shuffle: shuffle, pick: pick, sample: sample, randInt: randInt,
    audio: audio, read: read, text: text, sequence: sequence,
    opt: opt, letters: letters, texts: texts, emojis: emojis, swatches: swatches,
    choice: choice, assemble: assemble, quantity: quantity,
    wordKey: wordKey, spellKey: spellKey, numberKey: numberKey,
    numberWord: numberWord, gap: gap, gapIndex: gapIndex,
    CONFUSABLE: CONFUSABLE
  };
})();
