/* =============================================================
   topics/classroom/levels.js — the room around them.

   Level 3 is the interesting one: the pupil hears a spoken clue
   ("You write with it.") and has to work out which object is meant,
   with no picture to help. That is the step between recognising a
   word and understanding it, and it is where ESL pupils usually
   need the most practice.

   Level 4 pits each object against a lookalike, which is what
   actually happens in a real classroom.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var ITEMS = LG.VOCAB.topics.classroom.items;

  function withLookalike() {
    return ITEMS.filter(function (i) { return !!i.confusable; });
  }

  LG.topicData('classroom', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'o1', name: 'Listen and Find', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear the object. Tap its picture.',
      build: function () {
        var it = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(it.word)),
          options: Q.emojis(it.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.word !== it.word;
          }), 3).map(function (x) { return x.emoji; })),
          answer: it.emoji,
          dedupe: 'lf' + it.word
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'o2', name: 'Read and Find', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Read the word. Tap its picture.',
      build: function () {
        var it = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.text(it.word),
          options: Q.emojis(it.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.word !== it.word;
          }), 3).map(function (x) { return x.emoji; })),
          answer: it.emoji,
          dedupe: 'rf' + it.word
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'o3', name: 'What Is It?', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'No picture. Just a clue. Which object is it?',
      /* The prompt here is a whole spoken sentence, not a word. Repeating
         it three times is waiting rather than practice, so it plays once
         and leans on the re-hear button. Every other level speaks a single
         word, which does benefit from repetition. */
      longPrompt: true,
      build: function () {
        var it = Q.pick(ITEMS.filter(function (i) { return !!i.desc; }));
        return Q.choice({
          prompt: Q.audio('desc/' + it.word),
          options: Q.emojis(it.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.word !== it.word && x.emoji !== it.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: it.emoji,
          dedupe: 'wi' + it.word
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'o4', name: 'Real or Fake', mode: 'choice',
      difficulty: 3, count: 10,
      blurb: 'One is real, one looks like it. Which did you hear?',
      build: function () {
        var it = Q.pick(withLookalike());
        return Q.choice({
          prompt: Q.audio(Q.wordKey(it.word)),
          options: Q.emojis(it.emoji, [it.confusable]),
          answer: it.emoji,
          dedupe: 'rfk' + it.word
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'o5', name: 'Where Does It Go?', mode: 'choice',
      difficulty: 3, count: 9,
      blurb: 'Hear an object. Tap where it belongs.',
      build: function () {
        var it = Q.pick(ITEMS.filter(function (i) { return !!i.place; }));
        // Several objects share a location ("on the desk" is used by seven
        // of them), so the distractors must be de-duplicated or the pupil
        // sees "on the wall" twice and both copies behave identically.
        var uniquePlaces = [];
        ITEMS.forEach(function (x) {
          if (x.place && x.place !== it.place && uniquePlaces.indexOf(x.place) === -1) {
            uniquePlaces.push(x.place);
          }
        });
        return Q.choice({
          prompt: Q.audio(Q.wordKey(it.word)),
          options: Q.texts(it.place, Q.sample(uniquePlaces, 3)),
          answer: it.place,
          dedupe: 'wdg' + it.place
        });
      }
    }
  ]);
})();
