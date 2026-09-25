/* =============================================================
   topics/instructions — classroom imperatives.

   Level 1 is the important one, and it uses minimal pairs on purpose.
   "Open the window" / "Close the window" cannot be told apart by a
   picture, only by listening, which is exactly the skill being taught.
   Mixing in picture-matching (level 3) would let a pupil coast through on
   the pictures alone, so the discrimination levels come first.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var I = LG.VOCAB.topics.instructions;
  var PAIRS = I.pairs;
  var ACTIONS = I.actions;

  LG.topicData('instructions', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'i1', name: 'Which One Did You Hear?', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Two instructions that sound almost the same. Which was it?',
      build: function () {
        var pair = Q.pick(PAIRS);
        var right = Q.pick(pair);
        var wrong = pair[0] === right ? pair[1] : pair[0];
        return Q.choice({
          prompt: Q.audio(Q.wordKey(right)),
          options: Q.texts(right, [wrong]),
          answer: right,
          dedupe: 'i1' + right
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'i2', name: 'Read It and Do It', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Read the instruction. Tap what it tells you to do.',
      build: function () {
        var a = Q.pick(ACTIONS);
        return Q.choice({
          prompt: Q.read(a.text),
          options: Q.emojis(a.emoji, Q.sample(ACTIONS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'i2' + a.text
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'i3', name: 'Which Picture?', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'Hear the instruction. Tap the picture that matches.',
      build: function () {
        var a = Q.pick(ACTIONS);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(a.text)),
          options: Q.emojis(a.emoji, Q.sample(ACTIONS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'i3' + a.text
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'i4', name: 'What Did They Ask?', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'Listen to a longer instruction. Which one was it?',
      build: function () {
        var a = Q.pick(ACTIONS);
        var others = Q.sample(ACTIONS.filter(function (x) { return x.text !== a.text; }), 2);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(a.text)),
          options: Q.texts(a.text, others.map(function (x) { return x.text; })),
          answer: a.text,
          dedupe: 'i4' + a.text
        });
      }
    }
  ]);
})();
