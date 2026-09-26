/* =============================================================
   topics/whereis — prepositions of place, and there is / there are.

   Again five levels, five mechanics:

     1  choice      hear it, pick the preposition    (listening)
     2  match       connect place to situation      (dragging, 5 pairs)
     3  choice      there is or there are           (listening, a single
                                                      consonant decides it)
     4  sort        which preposition? 8 sentences  (LONG, sorting)
     5  assemble    build the whole sentence        (production)

   The sort level is the one worth the most: eight sentences at once,
   so the pupil cannot succeed by hearing a single word and guessing.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var W = LG.VOCAB.topics.whereis;
  var PREPS = W.prepositions;

  function gapIn(sentence) {
    var tokens = sentence.replace(/[.,!?]/g, '').split(' ');
    var at = -1;
    tokens.forEach(function (t, i) { if (at === -1 && PREPS.indexOf(t) !== -1) at = i; });
    return { tokens: tokens, gapAt: at };
  }

  LG.topicData('whereis', [

    /* 1 -- read it, choose the preposition --------------------------
       Also not a listening level. Hearing "The lion is IN the tree"
       tells the pupil the answer, and a preposition of place cannot be
       tested by ear at all. */
    {
      id: 'w1', name: 'Which Preposition?', mode: 'choice',
      difficulty: 3, count: 10, icon: '\uD83C\uDF0E', skill: 'reading',
      blurb: 'Read the sentence. Tap the word that fits.',
      build: function () {
        var s = Q.pick(W.gaps);
        var g = gapIn(s);
        var right = g.tokens[g.gapAt];
        var show = g.tokens.slice();
        show[g.gapAt] = '____';
        var opts = Q.shuffle([right].concat(
          Q.sample(PREPS.filter(function (p) { return p !== right; }), 3)
        ).map(function (w) { return Q.opt('text', w, { id: w }); }));
        return Q.choice({
          prompt: Q.read(show.join(' ') + '.'),
          options: opts,
          correct: opts.findIndex(function (o) { return o.value === right; }),
          dedupe: 'prep' + s
        });
      }
    },

    /* 2 -- match place to situation (LONG, dragging) ---------------- */
    {
      id: 'w2', name: 'Match the Place', mode: 'match',
      difficulty: 3, count: 4, icon: '\uD83D\uDD17', skill: 'reading',
      blurb: 'Five places, five situations. Drag to connect them.',
      build: function () {
        var picks = Q.sample(W.places, 5);
        return {
          type: 'match',
          prompt: Q.read('Drag each animal to where it is.'),
          left: picks.map(function (p, i) { return { id: 'L' + i, value: p.thing }; }),
          right: picks.map(function (p, i) { return { id: 'R' + i, value: p.place }; }),
          pairs: picks.reduce(function (m, p, i) { m['R' + i] = 'L' + i; return m; }, {}),
          dedupe: 'place' + picks.map(function (p) { return p.thing; }).join('')
        };
      }
    },

    /* 3 -- there is or there are ------------------------------------ */
    {
      id: 'w3', name: 'There Is or There Are?', mode: 'choice',
      difficulty: 3, count: 4, icon: '\uD83D\uDC42', skill: 'listening',
      blurb: 'One consonant decides it. Listen carefully.',
      build: function () {
        var s = Q.pick(W.thereIs);
        var singular = /^There is /.test(s);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(s)),
          options: [Q.opt('text', 'There is'), Q.opt('text', 'There are')],
          correct: singular ? 0 : 1,
          dedupe: 'tis' + s
        });
      }
    },

    /* 4 -- sort by preposition (LONG) ------------------------------- */
    {
      id: 'w4', name: 'Sort the Location', mode: 'sort',
      difficulty: 4, count: 3, icon: '\uD83D\uDD00', skill: 'reading',
      blurb: 'Eight sentences. Drag each into a preposition box.',
      build: function () {
        var picks = Q.sample(W.sentences, 8);
        var used = {};
        picks.forEach(function (p) { used[p.prep] = (used[p.prep] || 0) + 1; });
        var bins = Object.keys(used).slice(0, 4).map(function (k) {
          return { id: k, label: k };
        });
        var answer = {};
        picks.forEach(function (p, i) { answer['i' + i] = p.prep; });
        return {
          type: 'sort',
          prompt: Q.read('Drag each sentence into a box.'),
          bins: bins,
          items: Q.shuffle(picks.map(function (p, i) {
            return { id: 'i' + i, value: p.text };
          })),
          answerOf: answer,
          dedupe: 'sortprep' + picks.map(function (p) { return p.text; }).join('')
        };
      }
    },

    /* 5 -- build the whole sentence --------------------------------- */
    {
      id: 'w5', name: 'Build the Sentence', mode: 'assemble',
      difficulty: 4, count: 6, icon: '\uD83D\uDD24', skill: 'writing',
      blurb: 'Put every word in the right order.',
      build: function () {
        var s = Q.pick(W.gaps);
        var g = gapIn(s);
        return Q.assemble({
          prompt: Q.audio(Q.wordKey(s)),
          answer: g.tokens,
          extras: Q.sample(PREPS.filter(function (p) { return p !== g.tokens[g.gapAt]; }), 2),
          dedupe: 'build' + s
        });
      }
    }
  ]);
})();
