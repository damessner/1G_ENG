/* =============================================================
   topics/soundsz — the /z/ sound ("Sounds right: /z/", the wide-mouthed
   frog).

   z at the start: zebra, zoo, zip. z at the end: nose, these, quiz.
   The distractor words all have /s/ or /ʃ/ and no /z/ at all, so the
   pupil has to actually hear the buzzing sound rather than guess from
   the spelling.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var Z = LG.VOCAB.topics.soundsz.zWords;
  var S = LG.VOCAB.topics.soundsz.sWords;

  LG.topicData('soundsz', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'z1', name: 'Z or Not Z?', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Hear the buzzing word. Tap it, not the hissing ones.',
      build: function () {
        var right = Q.pick(Z);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(right)),
          options: Q.texts(right, Q.sample(S, 3)),
          answer: right,
          dedupe: 'zz' + right
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'z2', name: 'Buzz or Hiss?', mode: 'choice',
      difficulty: 2, count: 12,
      blurb: 'Hear a word. Does it buzz (/z/) or hiss (/s/)?',
      build: function () {
        var isZ = Math.random() < 0.5;
        var w = isZ ? Q.pick(Z) : Q.pick(S);
        // Judge the sound directly rather than recognising the word, so
        // this cannot be passed by guessing from the spelling.
        var opts = [Q.opt('text', 'buzz  /z/'), Q.opt('text', 'hiss  /s/')];
        return Q.choice({
          prompt: Q.audio(Q.wordKey(w)),
          options: opts,
          correct: isZ ? 0 : 1,
          dedupe: 'zs' + w
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'z3', name: 'Two Z or Two S?', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'Two words. Which one has the /z/ sound?',
      build: function () {
        var right = Q.pick(Z), wrong = Q.pick(S);
        var opts = Q.shuffle([Q.opt('text', right), Q.opt('text', wrong)]);
        return Q.choice({
          prompt: Q.read('Which word has the /z/ sound?'),
          options: opts,
          correct: opts.findIndex(function (o) { return o.value === right; }),
          dedupe: 'pair' + right + wrong
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'z4', name: 'Spell the Z Word', mode: 'assemble',
      difficulty: 3, count: 8,
      blurb: 'Hear the word. Spell it — watch out for the zz at the end.',
      build: function () {
        var w = Q.pick(Z);
        return Q.assemble({
          prompt: { speak: [Q.wordKey(w), Q.spellKey(w)], show: null },
          answer: w,
          revealFirst: 0,
          dedupe: 'zsp' + w
        });
      }
    }
  ]);
})();
