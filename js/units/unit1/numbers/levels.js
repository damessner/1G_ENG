/* =============================================================
   topics/numbers/levels.js — counting on from listening.

   The first two levels are pure listening: the pupil hears a number
   and must count the objects. The middle levels add subtraction and
   comparison. The last two are reading numbers in a sequence, which
   is a different skill from hearing them, so the mix matters.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var THINGS = ['⭐', '🍎', '🎈', '🐟', '🌸', '🚗', '🐥', '🧊'];

  function thing() { return { kind: 'emoji', value: Q.pick(THINGS) }; }

  /* Near-miss numbers that make a sequence question a real decision. */
  function around(n, correct, howMany) {
    var pool = [n - 2, n - 1, n + 1, n + 2, n + 3, n + 4, n + 5];
    var out = [];
    pool.forEach(function (c) {
      if (c > 0 && c !== correct && out.indexOf(c) === -1) out.push(c);
    });
    return Q.shuffle(out).slice(0, howMany);
  }

  LG.topicData('numbers', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'n1', name: 'How Many?', icon: '☝️', mode: 'quantity',
      difficulty: 1, count: 8,
      blurb: 'Hear a number. Tap that many objects.',
      build: function () {
        var n = Q.randInt(1, 10);
        return Q.quantity({
          prompt: Q.read('How many?', Q.numberKey(n)),
          answer: n,
          pool: n + Q.randInt(2, 5),
          item: thing()
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'n2', name: 'Bigger Numbers', icon: '💯', mode: 'quantity',
      difficulty: 2, count: 8,
      blurb: 'Now up to twenty.',
      build: function () {
        var n = Q.randInt(11, 20);
        return Q.quantity({
          prompt: Q.read('How many?', Q.numberKey(n)),
          answer: n,
          pool: n + Q.randInt(1, 3),
          item: thing()
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'n3', name: 'What Comes Next?', icon: '➡️', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Count on. Which number comes next?',
      build: function () {
        var start = Q.randInt(1, 15);
        var correct = start + 2;
        var nums = around(correct, correct, 3).map(String);
        return Q.choice({
          prompt: Q.read(start + ',  ' + (start + 1) + ',  ?'),
          options: Q.texts(String(correct), nums),
          answer: String(correct),
          dedupe: 'next' + start
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'n4', name: 'Take Away', icon: '➖', mode: 'quantity',
      difficulty: 3, count: 8,
      blurb: 'Take the bottom number away. Tap the ones to remove.',
      build: function () {
        var a = Q.randInt(4, 10);
        var b = Q.randInt(1, a - 1);
        return Q.quantity({
          prompt: Q.read(a + '  −  ' + b + '  =  ?', Q.numberKey(a)),
          answer: b,
          pool: a,
          operation: 'minus',
          start: a,
          item: thing()
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'n5', name: 'Which Is More?', icon: '⚖️', mode: 'choice',
      difficulty: 3, count: 8,
      blurb: 'Two groups. Which one has more?',
      build: function () {
        var x = Q.randInt(2, 12), y;
        do { y = Q.randInt(2, 12); } while (y === x);
        var e = Q.pick(THINGS);
        var left = Q.opt('group', e, { count: x, id: x });
        var right = Q.opt('group', e, { count: y, id: y });
        var biggest = Math.max(x, y);
        var opts = Q.shuffle([left, right]);
        return Q.choice({
          prompt: Q.read('Which group has more?'),
          options: opts,
          correct: opts.findIndex(function (o) { return o.id === biggest; }),
          dedupe: 'more' + Math.min(x, y) + '-' + biggest
        });
      }
    },

    /* 6 ------------------------------------------------------------- */
    {
      id: 'n6', name: 'Missing Number', icon: '🕳️', mode: 'choice',
      difficulty: 4, count: 10,
      blurb: 'One number is missing from the sequence.',
      build: function () {
        var start = Q.randInt(1, 14);
        var gapAt = Q.randInt(1, 2);
        var correct = start + gapAt;
        var shown = [];
        for (var i = 0; i < 4; i++) {
          shown.push(i === gapAt ? '?' : String(start + i));
        }
        return Q.choice({
          prompt: Q.read(shown.join(',  ')),
          options: Q.texts(String(correct), around(correct, correct, 3).map(String)),
          answer: String(correct),
          dedupe: 'miss' + start + gapAt
        });
      }
    },

    /* 7 ------------------------------------------------------------- */
    {
      id: 'n7', name: 'Up to Twenty-Five', icon: '🖐️', mode: 'quantity',
      difficulty: 3, count: 5,
      blurb: 'The Unit 1 numbers: twenty-one to twenty-five.',
      build: function () {
        var n = Q.randInt(21, 25);
        return Q.quantity({
          prompt: Q.read('How many?', Q.numberKey(n)),
          answer: n,
          // keep the field readable: only a little more than the answer
          pool: n + 2,
          item: thing()
        });
      }
    },

    /* 8 ------------------------------------------------------------- */
    {
      id: 'n8', name: 'Which Number?', icon: '🎧', mode: 'choice',
      difficulty: 4, count: 10,
      blurb: 'Hear a number. Tap the one you heard.',
      build: function () {
        var n = Q.randInt(11, 25);
        return Q.choice({
          prompt: Q.audio(Q.numberKey(n)),
          options: Q.texts(String(n), around(n, n, 3).map(String)),
          answer: String(n),
          dedupe: 'which' + n
        });
      }
    }
  ]);
})();
