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

  /* Always show more objects than the answer, so tapping them all cannot
     be a winning strategy. A field of exactly the right size lets a pupil
     be correct without counting at all. */
  function field(n) { return Math.max(25, n + 6); }

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
          pool: field(n),
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
          pool: field(n),
          item: thing()
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    /* 4 ------------------------------------------------------------- */
    /* 5 ------------------------------------------------------------- */
    /* 6 ------------------------------------------------------------- */
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
          pool: field(n),
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
