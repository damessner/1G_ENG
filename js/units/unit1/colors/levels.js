/* =============================================================
   topics/colors/levels.js — colour words.

   Colour is the one topic where listening and reading are genuinely
   different tasks, so they get separate levels before they are mixed:
   hear the word and pick the colour, read the word and pick the
   colour, then both at once. Levels 5 and 6 reverse the direction
   (colour to word) and look for the odd one out.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var NAMES = LG.VOCAB.topics.colors.words;
  var HEX = LG.VOCAB.topics.colors.swatches;

  LG.topicData('colors', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'c1', name: 'Listen and Tap', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear the colour. Tap the right one.',
      build: function () {
        var c = Q.pick(NAMES);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(c)),
          options: Q.swatches(c, NAMES, HEX, 3),
          answer: c,
          dedupe: 'ls' + c
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'c2', name: 'Read and Tap', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Read the colour. Tap the right one.',
      build: function () {
        var c = Q.pick(NAMES);
        return Q.choice({
          prompt: Q.text(c),
          options: Q.swatches(c, NAMES, HEX, 3),
          answer: c,
          dedupe: 'rs' + c
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'c3', name: 'Ears or Eyes?', mode: 'choice',
      difficulty: 2, count: 12,
      blurb: 'Sometimes you hear it, sometimes you read it.',
      build: function () {
        var c = Q.pick(NAMES);
        var byEar = Math.random() < 0.5;
        return Q.choice({
          prompt: byEar ? Q.audio(Q.wordKey(c)) : Q.text(c),
          options: Q.swatches(c, NAMES, HEX, 3),
          answer: c,
          dedupe: 'mix' + c + (byEar ? 'a' : 'v')
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'c4', name: 'Colour Trap', mode: 'choice',
      difficulty: 4, count: 8,
      blurb: 'Each word is printed in a colour. Only one is correct.',
      build: function () {
        var names = Q.shuffle(NAMES).slice(0, 4);
        var right = Q.pick(names);
        // Painting a word white-on-white (or pale yellow on white) would
        // be unfair rather than clever, so those are never used as ink.
        var inks = NAMES.filter(function (c) { return c !== 'white' && c !== 'yellow'; });
        var opts = names.map(function (n) {
          // the right word wears its own colour; every other word
          // deliberately wears the wrong one
          var paint = n === right
            ? HEX[n]
            : HEX[Q.pick(inks.filter(function (c) { return c !== n; }))];
          return Q.opt('word', n, { color: paint, id: n });
        });
        return Q.choice({
          prompt: Q.read('Tap the word that matches its own colour.'),
          options: opts,
          correct: opts.findIndex(function (o) { return o.id === right; }),
          dedupe: 'trap' + right
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'c5', name: 'Name It', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'The other way round: find the colour\'s name.',
      build: function () {
        var c = Q.pick(NAMES);
        return Q.choice({
          prompt: { speak: null, show: null, swatch: HEX[c] },
          options: Q.texts(c, Q.sample(NAMES.filter(function (x) { return x !== c; }), 3)),
          answer: c,
          dedupe: 'nm' + c
        });
      }
    },

    /* 6 ------------------------------------------------------------- */
    {
      id: 'c6', name: 'Odd One Out', mode: 'choice',
      difficulty: 4, count: 8,
      blurb: 'Eight of these are the same. One is different.',
      build: function () {
        var base = Q.pick(NAMES);
        var odd = Q.pick(NAMES.filter(function (c) { return c !== base; }));
        var cells = [];
        for (var i = 0; i < 8; i++) cells.push(Q.opt('swatch', base, { bg: HEX[base] }));
        cells.push(Q.opt('swatch', odd, { bg: HEX[odd] }));
        cells = Q.shuffle(cells);
        return Q.choice({
          prompt: Q.read('Which one is different?'),
          options: cells,
          correct: cells.findIndex(function (c) { return c.value === odd; }),
          dedupe: 'odd' + base + odd
        });
      }
    }
  ]);
})();
