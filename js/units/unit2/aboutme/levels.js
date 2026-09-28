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
    /* 2 -- I or someone else? --------------------------------------
       NOT a listening level. It used to play the sentence and ask which
       of four near-identical sentences you heard, which only tested
       transcription. Read instead, the pupil has to do the work: change
       the pronoun AND correct the verb. Taking the audio away on its own
       would not have helped -- with the sentence printed, the task would
       just be matching it against the options. */
    {
      id: 'a3', name: 'I or Someone Else?', mode: 'choice',
      difficulty: 4, count: 9, icon: '\uD83D\uDC94', skill: 'writing',
      blurb: 'It is about someone else now. Which sentence is right?',
      build: function () {
        // only sentences that are "I am/is ..." can be turned into a
        // third-person question; "My name is Maya." has no be-verb to move
        var usable = A.me.filter(function (s) { return /^I (am|is|are) /.test(s); });
        var me = Q.pick(usable);
        var rest = me.replace(/^I (am|is|are) /, '');
        var right = 'She is ' + rest;
        var opts = Q.shuffle([
          right,
          'She are ' + rest,
          'They is ' + rest,
          'He am ' + rest
        ].map(function (t) { return Q.opt('text', t, { id: t }); }));
        return Q.choice({
          prompt: Q.read('"' + me + '"  is about Maya. Which one is correct?'),
          options: opts,
          correct: opts.findIndex(function (o) { return o.id === right; }),
          dedupe: 'transform' + me
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
