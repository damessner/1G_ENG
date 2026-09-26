/* =============================================================
   topics/aboutme — talking about yourself and others.

   Four levels, four mechanics:

     1  choice    hear someone speak, pick the sentence   (listening)
     2  match     connect a sentence to a person        (reading, drag)
     3  choice    I or someone else? minimal pair       (listening)
     4  assemble  put a conversation back in order      (LONG, production)

   Level 4 is the syllabus's "Dialogues" objective. Ordering six lines
   forces the pupil to hold a whole exchange in their head, which
   single-sentence exercises never do.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var A = LG.VOCAB.topics.aboutme;
  var NAMES = LG.VOCAB.topics.spellname.names;

  function parts(sentence) {
    var toks = sentence.replace(/[.,!?]/g, '').split(' ');
    return { tokens: toks, who: toks[0], be: toks[1] };
  }

  LG.topicData('aboutme', [

    /* 1 -- listen and match ----------------------------------------- */
    {
      id: 'a1', name: 'Listen and Match', mode: 'choice',
      difficulty: 1, count: 6, icon: '\uD83D\uDC42', skill: 'listening',
      blurb: 'Hear someone talk about themselves. Which sentence?',
      build: function () {
        var s = Q.pick(A.me);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(s)),
          options: Q.texts(s, Q.sample(A.me.filter(function (x) { return x !== s; }), 3)),
          answer: s,
          dedupe: 'me' + s
        });
      }
    },

    /* 2 -- match sentence to person (LONG, dragging) ---------------- */
    {
      id: 'a2', name: 'Who Is It?', mode: 'match',
      difficulty: 2, count: 4, icon: '\uD83D\uDD17', skill: 'reading',
      blurb: 'Four sentences about four people. Drag to connect.',
      build: function () {
        var people = Q.sample(NAMES, 4);
        var lines = people.map(function (n, i) {
          return { id: 'L' + i, value: 'My name is ' + n + '.' };
        });
        var names = people.map(function (n, i) {
          return { id: 'R' + i, value: n };
        });
        return {
          type: 'match',
          prompt: Q.read('Drag each name to the right sentence.'),
          left: lines,
          right: names,
          pairs: people.reduce(function (m, p, i) { m['R' + i] = 'L' + i; return m; }, {}),
          dedupe: 'whoname' + people.join('')
        };
      }
    },

    /* 3 -- I or someone else? -------------------------------------- */
    {
      id: 'a3', name: 'I or Someone Else?', mode: 'choice',
      difficulty: 3, count: 11, icon: '\uD83D\uDC94', skill: 'listening',
      blurb: 'They sound almost the same. Which one did you hear?',
      build: function () {
        var useMe = Math.random() < 0.5;
        var s = useMe ? Q.pick(A.me) : Q.pick(A.other);
        var p = parts(s);
        var swap = p.who === 'I' ? 'She' : 'I';
        var twin = [swap].concat(p.tokens.slice(1)).join(' ') + '.';
        var opts = Q.shuffle([
          Q.opt('text', s, { id: 'real' }),
          Q.opt('text', twin, { id: 'twin' })
        ]);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(s)),
          options: opts,
          correct: opts.findIndex(function (o) { return o.id === 'real'; }),
          dedupe: 'twin' + s
        });
      }
    },

    /* 4 -- order the dialogue (LONG, production) ------------------- */
    {
      id: 'a4', name: 'Put the Chat in Order', mode: 'assemble',
      difficulty: 4, count: 4, icon: '\uD83D\uDCAC', skill: 'speaking',
      blurb: 'Six lines of a conversation, jumbled. Put them in order.',
      build: function () {
        var lines = Q.shuffle(A.dialogue);
        return Q.assemble({
          prompt: Q.read('Put the conversation in the right order.'),
          answer: lines.slice(),
          revealFirst: 0,
          dedupe: 'chat' + lines[0].slice(0, 6)
        });
      }
    }
  ]);
})();
