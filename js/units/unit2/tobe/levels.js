/* =============================================================
   topics/tobe — the verb to be: am / is / are, questions, negatives.

   Five levels, five DIFFERENT mechanics, so the grammar is drilled
   through five different mental routes rather than five variations on
   "tap the right one":

     1  choice      hear it, pick the form          (listening)
     2  assemble    fill the gap                    (production)
     3  findError   find the wrong word             (proof-reading)
     4  sort        positive or negative?           (sorting, 8 sentences)
     5  choice      change one word, third person  (transformation)

   Levels 3 and 4 are deliberately long: one paragraph with four
   separate mistakes, and eight sentences in one go. A pupil who can
   spot "am" in isolation has not proved they can read a whole text.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var B = LG.VOCAB.topics.tobe;
  // "Change one word" turns I into She and back, so it needs the
  // about-me sentences. They live in that topic's vocabulary.
  var OTHER = LG.VOCAB.topics.aboutme.other;
  var BE = ['am', 'is', 'are'];

  function gapIn(sentence) {
    var tokens = sentence.replace(/[.,!?]/g, '').split(' ');
    var at = -1;
    tokens.forEach(function (t, i) { if (at === -1 && BE.indexOf(t) !== -1) at = i; });
    return { tokens: tokens, gapAt: at };
  }

  function usable() { return B.gaps.filter(function (s) { return gapIn(s).gapAt !== -1; }); }

  LG.topicData('tobe', [

    /* 1 -- hear it, pick the form ---------------------------------- */
    {
      id: 'b1', name: 'Am, Is or Are?', mode: 'choice',
      difficulty: 2, count: 10, icon: '\uD83D\uDC42', skill: 'listening',
      blurb: 'Hear the sentence. Tap the right word.',
      build: function () {
        var s = Q.pick(usable());
        var g = gapIn(s);
        var right = g.tokens[g.gapAt];
        return Q.choice({
          prompt: Q.audio(Q.wordKey(s)),
          options: Q.texts(right, Q.sample(BE.filter(function (w) { return w !== right; }), 3)),
          answer: right,
          dedupe: 'pick' + s
        });
      }
    },

    /* 2 -- fill the gap --------------------------------------------- */
    {
      id: 'b2', name: 'Fill the Gap', mode: 'assemble',
      difficulty: 2, count: 8, icon: '\uD83D\uDD24', skill: 'writing',
      blurb: 'Hear the sentence. Tap the missing word.',
      build: function () {
        var s = Q.pick(usable());
        var g = gapIn(s);
        var right = g.tokens[g.gapAt];
        return Q.assemble({
          prompt: Q.audio(Q.wordKey(s)),
          answer: g.tokens,
          // the sentence arrives filled except for the verb under test
          given: g.tokens.map(function (_, i) { return i; }).filter(function (i) {
            return i !== g.gapAt;
          }),
          extras: Q.sample(BE.filter(function (w) { return w !== right; }), 2),
          dedupe: 'gap' + s
        });
      }
    },

    /* 3 -- find the wrong word -------------------------------------- */
    {
      id: 'b3', name: 'Find the Mistake', mode: 'findError',
      difficulty: 4, count: 3, icon: '\uD83D\uDD0E', skill: 'reading',
      blurb: 'Four mistakes hiding in a short text. Find them all.',
      build: function () {
        var text = Q.pick(B.paragraphs);
        return {
          type: 'findError',
          prompt: Q.read('Tap every word that is wrong.'),
          text: text,
          dedupe: 'para' + text.slice(0, 24)
        };
      }
    },

    /* 4 -- sort: positive or negative? (LONG) ----------------------- */
    {
      id: 'b4', name: 'Positive or Negative?', mode: 'sort',
      difficulty: 3, count: 3, icon: '\uD83D\uDD00', skill: 'reading',
      blurb: 'Eight sentences. Drag each one into the right box.',
      build: function () {
        var idx = Q.randInt(0, B.negative.length - 1);
        var pickNeg = B.negative.slice(idx, idx + 4);
        var pickPos = B.positives.slice(idx, idx + 4);
        var items = pickNeg.map(function (t, i) {
          return { id: 'n' + i, value: t };
        }).concat(pickPos.map(function (t, i) {
          return { id: 'p' + i, value: t };
        }));
        var answer = {};
        pickNeg.forEach(function (_, i) { answer['n' + i] = 'neg'; });
        pickPos.forEach(function (_, i) { answer['p' + i] = 'pos'; });
        return {
          type: 'sort',
          prompt: Q.read('Drag each sentence into a box.'),
          bins: [{ id: 'pos', label: 'positive' }, { id: 'neg', label: 'negative' }],
          items: Q.shuffle(items),
          answerOf: answer,
          dedupe: 'posneg' + pickNeg[0]
        };
      }
    },

    /* 5 -- change one word ------------------------------------------ */
    {
      id: 'b5', name: 'Change One Word', mode: 'choice',
      difficulty: 3, count: 5, icon: '\u270D\uFE0F', skill: 'writing',
      blurb: 'One word changes who it is about. Which one?',
      build: function () {
        var s = Q.pick(OTHER);
        var toks = s.replace(/[.,!?]/g, '').split(' ');
        var who = toks[0];
        var swap = who === 'I' ? 'She' : (who === 'We' ? 'They' : 'I');
        var changed = [swap].concat(toks.slice(1)).join(' ') + '.';
        var opts = [Q.opt('text', who, { id: 'a' }), Q.opt('text', swap, { id: 'b' })];
        opts = Q.shuffle(opts);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(s)),
          options: opts,
          correct: opts.findIndex(function (o) { return o.id === 'b'; }),
          dedupe: 'chg' + s
        });
      }
    }
  ]);
})();
