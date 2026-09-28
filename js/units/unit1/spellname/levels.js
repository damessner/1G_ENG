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
      id: 'n1', name: 'How Do You Spell It?', icon: '📠', mode: 'assemble',
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
      id: 'n2', name: 'Spell the Name', icon: '✍️', mode: 'assemble',
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
    /* 4 ------------------------------------------------------------- */
    /* 5 ------------------------------------------------------------- */
    {
      id: 'n5', name: 'Read the Address', icon: '🔖', mode: 'choice',
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
