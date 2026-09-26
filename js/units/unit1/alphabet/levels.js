/* =============================================================
   topics/alphabet/levels.js — letters, sounds and spelling.

   Seven levels that walk the skill in the order it actually breaks
   down: recognise a letter, map sound to letter, fill a gap, spell
   from sound, tell similar words apart, blend digraphs, then spell
   longer words unaided.

   Every level exposes build(), which returns one question. The engine
   supplies the repeats, the scoring and the feedback.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var V = LG.VOCAB.topics.alphabet;
  var cvc = V.cvc, blend = V.blend, tricky = V.tricky, longer = V.long;
  var ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');

  /* Blank a single middle letter out of a word. */
  function missing(word, index) {
    var chars = word.split('');
    var letter = chars[index];
    chars[index] = '_';
    return { show: chars.join(' '), letter: letter };
  }

  LG.topicData('alphabet', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'a1', name: 'Letter Match', icon: '🔤', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear a letter. Tap the letter you hear.',
      build: function () {
        var ch = Q.pick(ALPHA);
        return Q.choice({
          prompt: Q.audio('letter/name/' + ch),
          options: Q.letters(ch, 3, ALPHA),
          answer: ch,
          dedupe: 'nm' + ch
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'a2', name: 'First Sound', icon: '👂', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear a word. Tap the letter it starts with.',
      build: function () {
        var w = Q.pick(cvc);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(w)),
          options: Q.letters(w[0], 3),
          answer: w[0],
          dedupe: 'fs' + w
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'a3', name: 'Missing Letter', icon: '🕳', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'One letter is hidden. Hear the word and find it.',
      build: function () {
        var w = Q.pick(cvc);
        var m = missing(w, Q.randInt(1, w.length - 2));
        return Q.choice({
          prompt: Q.read(m.show, Q.wordKey(w)),
          options: Q.letters(m.letter, 3),
          answer: m.letter,
          dedupe: 'ml' + w + m.show
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'a4', name: 'Spell It', icon: '🔡', mode: 'assemble',
      difficulty: 2, count: 8,
      blurb: 'The word is spelled out loud. Tap the letters in order.',
      build: function () {
        var w = Q.pick(cvc);
        return Q.assemble({
          prompt: { speak: [Q.wordKey(w), Q.spellKey(w)], show: null },
          answer: w,
          dedupe: 'sp' + w
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'a5', name: 'Tricky Pairs', icon: '👀', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'Two words that sound almost the same. Which one did you hear?',
      build: function () {
        var pair = Q.pick(tricky);
        var w = Q.pick(pair);
        var other = pair[0] === w ? pair[1] : pair[0];
        return Q.choice({
          prompt: Q.audio(Q.wordKey(w)),
          options: Q.texts(w, [other]),
          answer: w,
          dedupe: 'tp' + w + other
        });
      }
    },

    /* 6 ------------------------------------------------------------- */
    {
      id: 'a6', name: 'Blend It', icon: '🧩', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'Words with sh, ch, th, ai, oa. Find the missing letter.',
      build: function () {
        var w = Q.pick(blend);
        var i = Q.randInt(1, w.length - 2);
        var m = missing(w, i);
        return Q.choice({
          prompt: Q.read(m.show, Q.wordKey(w)),
          options: Q.letters(m.letter, 3),
          answer: m.letter,
          dedupe: 'bl' + w + i
        });
      }
    },

    /* 7 ------------------------------------------------------------- */
    {
      id: 'a7', name: 'Spell It Out', icon: '✍️', mode: 'assemble',
      difficulty: 4, count: 8,
      blurb: 'Longer words, spelled from sound. No letters given.',
      build: function () {
        var w = Q.pick(longer);
        return Q.assemble({
          prompt: { speak: [Q.wordKey(w), Q.spellKey(w)], show: null },
          answer: w,
          revealFirst: 0,
          dedupe: 'lo' + w
        });
      }
    }
  ]);
})();
