/* =============================================================
   topics/plurals — singular and plural nouns, regular and irregular.

   The irregular forms are the point. "books/books" teaches nothing; the
   pupil has to hold "child/children" and "mouse/mice" in their head and
   hear which one is being used.
   ============================================================= */
(function () {
  'use strict';

  var Q = LG.Q;
  var P = LG.VOCAB.topics.plurals.pairs;
  var LABELS = LG.VOCAB.topics.plurals.ruleLabels || {};
  // pair[0] singular, pair[1] plural, pair[3] the rule the plural follows
  var all = P.map(function (p) {
    return { one: p[0], many: p[1], kind: p[2], rule: p[3] };
  });
  // The rule is the reliable signal; the third field is a legacy marker that
  // is "r" throughout, so filtering on it would find nothing.
  var irregular = all.filter(function (p) { return p.rule === 'irregular'; });
  var byRule = {};
  all.forEach(function (p) { (byRule[p.rule] = byRule[p.rule] || []).push(p); });
  var RULES = Object.keys(LABELS).filter(function (r) { return (byRule[r] || []).length >= 3; });

  LG.topicData('plurals', [

    /* 1 ------------------------------------------------------------- */
    {
      id: 'p1', name: 'One or Many?', icon: '1️⃣', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear one thing. Tap the word for lots of them.',
      build: function () {
        var p = Q.pick(all);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(p.one)),
          options: Q.texts(p.many, Q.sample(all.filter(function (x) {
            return x.many !== p.many;
          }), 3).map(function (x) { return x.many; })),
          answer: p.many,
          dedupe: 'one' + p.one
        });
      }
    },

    /* 2 ------------------------------------------------------------- */
    {
      id: 'p2', name: 'Lots of Them', icon: '👥', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Hear lots. Tap the word for just one.',
      build: function () {
        var p = Q.pick(all);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(p.many)),
          options: Q.texts(p.one, Q.sample(all.filter(function (x) {
            return x.one !== p.one;
          }), 3).map(function (x) { return x.one; })),
          answer: p.one,
          dedupe: 'many' + p.many
        });
      }
    },

    /* 3 ------------------------------------------------------------- */
    {
      id: 'p3', name: 'Tricky Plurals', icon: '🧠', mode: 'choice',
      difficulty: 4, count: 12,
      blurb: 'The ones that do not just add -s. child/children, mouse/mice…',
      build: function () {
        var p = Q.pick(irregular);
        var hearMany = Math.random() < 0.5;
        return Q.choice({
          prompt: Q.audio(Q.wordKey(hearMany ? p.many : p.one)),
          options: Q.texts(hearMany ? p.one : p.many, Q.sample(irregular.filter(function (x) {
            return x.many !== p.many;
          }), 3).map(function (x) { return hearMany ? x.one : x.many; })),
          answer: hearMany ? p.one : p.many,
          dedupe: 'irr' + p.one + (hearMany ? 'm' : 'o')
        });
      }
    },

    /* 4 ------------------------------------------------------------- */
    {
      id: 'p4', name: 'Read the Plural', icon: '📖', mode: 'choice',
      difficulty: 2, count: 10,
      blurb: 'Read the word. Tap the one for just one.',
      build: function () {
        var p = Q.pick(all);
        return Q.choice({
          prompt: Q.read(p.many),
          options: Q.texts(p.one, Q.sample(all.filter(function (x) {
            return x.one !== p.one;
          }), 3).map(function (x) { return x.one; })),
          answer: p.one,
          dedupe: 'read' + p.many
        });
      }
    },

    /* 5 ------------------------------------------------------------- */
    {
      id: 'p5', name: 'The Odd One', icon: '🔎', mode: 'choice',
      difficulty: 4, count: 8,
      blurb: 'Four are plurals. One is not. Find it.',
      build: function () {
        var odd = Q.pick(all);                      // the singular
        var pool = Q.sample(all.filter(function (x) { return x.many !== odd.many; }), 3);
        var cells = pool.map(function (x) { return Q.opt('text', x.many, { id: x.many }); });
        cells.push(Q.opt('text', odd.one, { id: odd.one }));
        cells = Q.shuffle(cells);
        return Q.choice({
          prompt: Q.read('Which one is the odd one?'),
          options: cells,
          correct: cells.findIndex(function (c) { return c.id === odd.one; }),
          dedupe: 'odd' + odd.one
        });
      }
    },
    /* 6 -- categorise by plural rule (LONG) -----------------------
       The categorising task: a tray of bare singular nouns, and one box for
       each way the plural can be made. It cannot be guessed from the look
       of the word -- "box" and "watch" look nothing alike but both take
       -es, while "photo" and "table" look similar and both take -s. */
    {
      id: 'p6', name: 'Sort the Plurals', mode: 'sort',
      difficulty: 4, count: 4, icon: '\uD83D\uDC00', skill: 'reading',
      blurb: 'Bare nouns. Drag each into the box for how its plural is made.',
      build: function () {
        var rules = Q.sample(RULES, Math.min(4, RULES.length));
        var items = [];
        var answer = {};
        rules.forEach(function (r) {
          Q.sample(byRule[r], 2).forEach(function (p) {
            var id = 'i' + items.length;
            items.push({ id: id, value: p.one });
            answer[id] = r;
          });
        });
        return {
          type: 'sort',
          prompt: Q.read('Drag each noun into the right box.'),
          bins: rules.map(function (r) { return { id: r, label: LABELS[r] }; }),
          items: Q.shuffle(items),
          answerOf: answer,
          dedupe: 'sortpl' + rules.join('') + items.map(function (i) { return i.value; }).join('')
        };
      }
    }
  ]);
})();
