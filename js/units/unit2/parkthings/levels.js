/* =============================================================
   topics/parkthings — things in a wildlife park.
   The same shape as the animals, with a different distractor pool so a
   pupil cannot carry an answer over between the two topics.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var ITEMS = LG.VOCAB.topics.parkthings.items;

  LG.topicData('parkthings', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'k1', name: 'Listen and Find', mode: 'choice',
      difficulty: 1, count: 10, icon: '\uD83C\uDF0F', skill: 'listening',
      blurb: 'Hear it. Tap the right thing in the park.',
      build: function () {
        var a = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(a.word)),
          options: Q.emojis(a.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'lf' + a.word
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'k2', name: 'Read and Find', mode: 'choice',
      difficulty: 1, count: 10, icon: '\uD83D\uDCD5', skill: 'reading',
      blurb: 'Read the word. Tap the right thing.',
      build: function () {
        var a = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.text(a.word),
          options: Q.emojis(a.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'rf' + a.word
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'k3', name: 'Match the Thing', mode: 'match',
      difficulty: 2, count: 4, icon: '\uD83D\uDD17', skill: 'reading',
      blurb: 'Five words, five things in the park. Drag to connect.',
      build: function () {
        var picks = Q.sample(ITEMS, 5);
        return {
          type: 'match',
          prompt: Q.read('Drag each word to its picture.'),
          left: picks.map(function (p, i) { return { id: 'L' + i, value: p.word }; }),
          right: picks.map(function (p, i) { return { id: 'R' + i, value: p.emoji, kind: 'emoji' }; }),
          pairs: picks.reduce(function (m, p, i) { m['R' + i] = 'L' + i; return m; }, {}),
          dedupe: 'match' + picks.map(function (p) { return p.word; }).join('')
        };
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'k4', name: 'Animal or Park Thing?', mode: 'sort',
      difficulty: 3, count: 4, icon: '\uD83D\uDD00', skill: 'reading',
      blurb: 'Eight pictures. Drag the animals away from the park things.',
      build: function () {
        var animals = Q.sample(LG.VOCAB.topics.zooanimals.items, 4);
        var things = Q.sample(ITEMS, 4);
        var items = animals.map(function (a, i) {
          return { id: 'a' + i, value: a.emoji, kind: 'emoji' };
        }).concat(things.map(function (t, i) {
          return { id: 't' + i, value: t.emoji, kind: 'emoji' };
        }));
        var answer = {};
        animals.forEach(function (_, i) { answer['a' + i] = 'animal'; });
        things.forEach(function (_, i) { answer['t' + i] = 'thing'; });
        return {
          type: 'sort',
          prompt: Q.read('Drag each picture into a box.'),
          bins: [{ id: 'animal', label: 'animals' }, { id: 'thing', label: 'park things' }],
          items: Q.shuffle(items),
          answerOf: answer,
          dedupe: 'sort' + animals.map(function (a) { return a.word; }).join('')
        };
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'k5', name: 'Where Is It?', mode: 'choice',
      difficulty: 3, count: 10, icon: '\uD83D\uDCCD', skill: 'listening',
      blurb: 'Hear where it is. Tap the right place.',
      build: function () {
        var a = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.audio('place/' + a.word),
          options: Q.emojis(a.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'wdg' + a.word
        });
      }
    }
  ]);
})();
