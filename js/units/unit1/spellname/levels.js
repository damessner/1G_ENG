/* =============================================================
   topics/spellname — spelling names and email addresses.

   This is the "How do you spell it?" conversation from the course book,
   turned into the same letter-tile game used for spelling words. Names
   are short, familiar and self-relevant, which makes them a far gentler
   introduction to spelling than "chocolate".

   Email addresses are NOT assembled from tiles: twenty characters is not
   a game, it is a chore. Instead the pupil hears the address and
   recognises it, which is the skill they actually need in order to ask
   someone to spell it.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var N = LG.VOCAB.topics.spellname;

  LG.topicData('spellname', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'n1', name: 'How Do You Spell It?', mode: 'assemble',
      difficulty: 2, count: 8,
      blurb: 'A name is spelled out loud. Tap the letters in order.',
      build: function () {
        var w = Q.pick(N.names);
        return Q.assemble({
          prompt: { speak: [Q.wordKey(w), Q.spellKey(w)], show: null },
          answer: w,
          revealFirst: 1,
          dedupe: 'nm' + w
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'n2', name: 'Spell the Name', mode: 'assemble',
      difficulty: 3, count: 6,
      blurb: 'No letter given this time.',
      build: function () {
        var w = Q.pick(N.names.filter(function (n) { return n.length > 4; }));
        return Q.assemble({
          prompt: { speak: [Q.wordKey(w), Q.spellKey(w)], show: null },
          answer: w,
          revealFirst: 0,
          dedupe: 'sp' + w
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'n3', name: 'Two Names', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Two people say their name. Tap the one you heard.',
      build: function () {
        var a = Q.pick(N.names), b = Q.pick(N.names.filter(function (n) { return n !== a; }));
        return Q.choice({
          prompt: Q.audio(Q.wordKey(a)),
          options: Q.texts(a, [b]),
          answer: a,
          dedupe: 'two' + a + b
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'n4', name: 'Email Address', mode: 'choice',
      difficulty: 4, count: 8,
      blurb: 'Listen to an email address. Which one was it?',
      build: function () {
        var a = Q.pick(N.emails);
        return Q.choice({
          prompt: { speak: [Q.wordKey(a), Q.spellKey(a)], show: null, long: true },
          options: Q.texts(a, Q.sample(N.emails.filter(function (e) { return e !== a; }), 2)),
          answer: a,
          dedupe: 'mail' + a
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'n5', name: 'Read the Address', mode: 'choice',
      difficulty: 4, count: 8,
      blurb: 'Read it instead of listening. Which one is right?',
      build: function () {
        var a = Q.pick(N.emails);
        // a near-miss: swap two characters, so it is not a wild guess
        var chars = a.split('');
        var i = Math.max(0, a.indexOf('@') - 1);
        var swap = i === 0 ? 1 : i - 1;
        var b = chars.slice();
        var t = b[i]; b[i] = b[swap]; b[swap] = t;
        b = b.join('');
        if (b === a) b = a.replace('.', '');
        return Q.choice({
          prompt: Q.read(a),
          options: Q.texts(a, [b]),
          answer: a,
          dedupe: 'readmail' + a
        });
      }
    }
  ]);
})();
