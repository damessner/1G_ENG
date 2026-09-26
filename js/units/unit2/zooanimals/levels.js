/* =============================================================
   topics/zooanimals — the wildlife park vocabulary.

   Same four-part shape as every other vocabulary topic: hear it, read
   it, work it out from a spoken clue, then spot the odd one out. The
   clue level is the interesting one, because it is the only level
   where the pupil cannot just recognise the picture.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var ITEMS = LG.VOCAB.topics.zooanimals.items;
  var icon = '\uD83D\uDC1F';

  LG.topicData('zooanimals', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'z1', name: 'Listen and Find', mode: 'choice',
      difficulty: 1, count: 10, icon: '\uD83D\uDC42', skill: 'listening',
      blurb: 'Hear the animal. Tap its picture.',
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
      id: 'z2', name: 'Read and Find', mode: 'choice',
      difficulty: 1, count: 10, icon: '\uD83D\uDCD6', skill: 'reading',
      blurb: 'Read the word. Tap its picture.',
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
      id: 'z3', name: 'Match the Name', mode: 'match',
      difficulty: 2, count: 4, icon: '\uD83D\uDD17', skill: 'reading',
      blurb: 'Five names, five animals. Drag to connect them.',
      build: function () {
        var picks = Q.sample(ITEMS, 5);
        return {
          type: 'match',
          prompt: Q.read('Drag each name to its animal.'),
          left: picks.map(function (p, i) { return { id: 'L' + i, value: p.word }; }),
          right: picks.map(function (p, i) { return { id: 'R' + i, value: p.emoji, kind: 'emoji' }; }),
          pairs: picks.reduce(function (m, p, i) { m['R' + i] = 'L' + i; return m; }, {}),
          dedupe: 'match' + picks.map(function (p) { return p.word; }).join('')
        };
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'z4', name: 'Where Does It Live?', mode: 'sort',
      difficulty: 3, count: 4, icon: '\uD83D\uDD00', skill: 'reading',
      blurb: 'Eight animals. Drag each one into the right home.',
      build: function () {
        var picks = Q.sample(ITEMS, 8);
        var used = {};
        picks.forEach(function (p) { used[p.group] = (used[p.group] || 0) + 1; });
        var bins = Object.keys(used).slice(0, 3).map(function (k) {
          return { id: k, label: k };
        });
        var answer = {};
        picks.forEach(function (p, i) { answer['i' + i] = p.group; });
        return {
          type: 'sort',
          prompt: Q.read('Drag each animal into a box.'),
          bins: bins,
          items: Q.shuffle(picks.map(function (p, i) {
            return { id: 'i' + i, value: p.emoji, kind: 'emoji' };
          })),
          answerOf: answer,
          dedupe: 'sort' + picks.map(function (p) { return p.word; }).join('')
        };
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'z5', name: 'What Is It?', mode: 'choice',
      difficulty: 3, count: 11, icon: '\uD83D\uDD75\uFE0F', skill: 'listening', longPrompt: true,
      blurb: 'No picture. Just a clue. Which animal is it?',
      build: function () {
        var a = Q.pick(ITEMS);
        return Q.choice({
          prompt: Q.audio('desc/' + a.word),
          options: Q.emojis(a.emoji, Q.sample(ITEMS.filter(function (x) {
            return x.emoji !== a.emoji;
          }), 3).map(function (x) { return x.emoji; })),
          answer: a.emoji,
          dedupe: 'wi' + a.word
        });
      }
    }
  ]);
})();
