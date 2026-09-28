/* =============================================================
   vocabkit.js -- builds a whole vocabulary topic from one word list.

   Every imported word file in vocabulary/*.md has the same shape
   (English, German, sometimes an example sentence), so the levels
   that turn it into exercises are identical every time. Writing them
   by hand six times over just gives six places to get it wrong.

   A topic file becomes:

       LG.topicData('u1_cool-clothes', LG.Vocab.levels({
         key: 'u1_cool-clothes', count: 9
       }));

   Picture games only appear when the picture is unambiguous -- emoji
   cannot show a "board" or a "pencil sharpener". Those words still get
   the translation exercises, which work for everything.
   ============================================================= */
window.LG = window.LG || {};

LG.Vocab = (function () {
  'use strict';

  var Q = LG.Q;

  function words(key) {
    var t = (LG.VOCAB.topics || {})[key] || {};
    return (t.words || []).filter(function (w) { return w && w.word; });
  }

  function phrases(key) {
    var t = (LG.VOCAB.topics || {})[key] || {};
    return (t.phrases || []).filter(function (p) { return p && p.word; });
  }

  /* Emoji and clue sentences live in the hand-maintained `media` block of
     the generated vocabulary file. import_vocab.py never overwrites it. */
  function media(word) {
    return ((LG.VOCAB && LG.VOCAB.media) || {})[String(word).toLowerCase()] || null;
  }

  function icon(word) {
    var m = media(word);
    return m ? m.emoji : null;
  }

  /* emoji options for any set of words, omitting ones with no picture */
  function emojiOptions(right, pool) {
    var others = Q.sample(pool.filter(function (w) {
      return w.word !== right.word && icon(w.word) && icon(w.word) !== icon(right.word);
    }), 3);
    return Q.shuffle(others.concat([right]).map(function (w) {
      return Q.opt('emoji', icon(w.word), { id: w.word });
    }));
  }

  /** A vocabulary topic: pictures where possible, translation throughout. */
  function levels(cfg) {
    var key = cfg.key;
    var all = words(key).filter(function (w) { return w.de; });
    var pictured = all.filter(function (w) { return icon(w.word); });
    var clued = all.filter(function (w) { var m = media(w.word); return m && m.desc; });
    var n = cfg.count || 10;
    var out = [];
    var prefix = cfg.prefix || key;

    if (pictured.length >= 4) {
      /* 1 -- hear it, pick the picture ------------------------------- */
      out.push({
        id: prefix + '1', name: 'Listen and Find', mode: 'choice',
        difficulty: 1, count: Math.min(n, pictured.length), icon: '\uD83C\uDFA7',
        skill: 'listening', blurb: 'Hear it. Tap the right picture.',
        build: function () {
          var a = Q.pick(pictured);
          var opts = emojiOptions(a, pictured);
          return Q.choice({
            prompt: Q.audio(Q.wordKey(a.word)),
            options: opts,
            correct: opts.findIndex(function (o) { return o.id === a.word; }),
            dedupe: 'lf' + a.word
          });
        }
      });

      /* 2 -- read it, pick the picture ------------------------------- */
      out.push({
        id: prefix + '2', name: 'Read and Find', mode: 'choice',
        difficulty: 1, count: Math.min(n, pictured.length), icon: '\U0001F4D6',
        skill: 'reading', blurb: 'Read the word. Tap the right picture.',
        build: function () {
          var a = Q.pick(pictured);
          var opts = emojiOptions(a, pictured);
          return Q.choice({
            prompt: Q.text(a.word),
            options: opts,
            correct: opts.findIndex(function (o) { return o.id === a.word; }),
            dedupe: 'rf' + a.word
          });
        }
      });
    }

    /* 3 -- a spoken clue, no picture ------------------------------- */
    if (clued.length >= 4) {
      out.push({
        id: prefix + '3', name: 'What Is It?', mode: 'choice',
        difficulty: 3, count: Math.min(n, clued.length), icon: '\U0001F575\uFE0F',
        skill: 'listening', longPrompt: true,
        blurb: 'No picture. Just a clue.',
        build: function () {
          var a = Q.pick(clued);
          var opts = emojiOptions(a, clued);
          return Q.choice({
            prompt: Q.audio('desc/' + a.word),
            options: opts,
            correct: opts.findIndex(function (o) { return o.id === a.word; }),
            dedupe: 'wi' + a.word
          });
        }
      });
    }

    /* 4 -- hear the GERMAN, produce the English ------------------- */
    out.push({
      id: prefix + '4', name: 'German In, English Out', mode: 'choice',
      difficulty: 4, count: Math.min(n, all.length), icon: '\U0001F310',
      skill: 'listening', blurb: 'You hear it in German. Tap the English.',
      build: function () {
        return Q.translate({ entry: Q.pick(all), pool: all, ask: 'de' });
      }
    });

    /* 5 -- see the German, choose the English --------------------- */
    out.push({
      id: prefix + '5', name: 'Read the German', mode: 'choice',
      difficulty: 3, count: Math.min(n, all.length), icon: '\U0001F4D7',
      skill: 'reading', blurb: 'Read the German. Tap the English.',
      build: function () {
        return Q.translate({ entry: Q.pick(all), pool: all, ask: 'de-read' });
      }
    });

    // A sixth level, matching English to German, was removed. It put German
    // on both sides of the exercise with no English production anywhere in
    // it, so it was German literacy practice wearing an English objective.

    return out;
  }

  /** A functional-language topic built from a MORE list.
   *
   * Phrases alone are far too few to build distractors from -- "How are
   * you?" and "I am fine." would give a two-option question. So this draws
   * on the whole list: every entry with a German translation is usable, and
   * those that also carry an example sentence feed the listening level.
   */
  function phraseLevels(cfg) {
    var key = cfg.key;
    var topic = (LG.VOCAB.topics || {})[key] || {};
    var all = (topic.phrases || []).concat(topic.words || []).filter(function (p) {
      return p && p.word && p.de;
    });
    var withEx = all.filter(function (p) { return p.ex; });
    if (!all.length) return [];
    var n = cfg.count || 10;
    var out = [];
    var prefix = cfg.prefix || key;

    /* 1 -- hear the phrase, pick it -------------------------------- */
    if (withEx.length >= 4) {
      out.push({
        id: prefix + '1', name: 'Listen and Match', mode: 'choice',
        difficulty: 2, count: Math.min(n, withEx.length), icon: '\U0001F50A',
        skill: 'listening', blurb: 'Hear the sentence. Tap the one you heard.',
        build: function () {
          var a = Q.pick(withEx);
          var opts = Q.shuffle(Q.sample(withEx.filter(function (p) {
            return p.word !== a.word;
          }), 3).concat([a]).map(function (p) {
            return Q.opt('text', p.ex, { id: p.ex });
          }));
          return Q.choice({
            prompt: Q.audio(Q.wordKey(a.ex)),
            options: opts,
            correct: opts.findIndex(function (o) { return o.id === a.ex; }),
            dedupe: 'lm' + a.ex
          });
        }
      });
    }

    /* 2 -- hear German, choose the English phrase ----------------- */
    out.push({
      id: prefix + '2', name: 'German Phrase, English Reply', mode: 'choice',
      difficulty: 4, count: Math.min(n, all.length), icon: '\U0001F310',
      skill: 'listening', blurb: 'You hear German. Tap the English phrase.',
      build: function () {
        return Q.translate({ entry: Q.pick(all), pool: all, ask: 'de' });
      }
    });

    /* 3 -- see the German, choose the English --------------------- */
    out.push({
      id: prefix + '3', name: 'Read the German Phrase', mode: 'choice',
      difficulty: 3, count: Math.min(n, all.length), icon: '\U0001F4D7',
      skill: 'reading', blurb: 'Read the German. Tap the English phrase.',
      build: function () {
        return Q.translate({ entry: Q.pick(all), pool: all, ask: 'de-read' });
      }
    });

    /* 4 -- hear English, choose the German (LONG) ------------------ */
    out.push({
      id: prefix + '4', name: 'Connect the Phrases', mode: 'match',
      difficulty: 3, count: 3, icon: '\U0001F517',
      skill: 'reading', blurb: 'Five phrases. Drag each one to its German.',
      build: function () {
        var picks = Q.sample(all, Math.min(5, all.length));
        var q = Q.translatePairs(picks);
        q.prompt = Q.read('Drag each English phrase to its German.');
        return q;
      }
    });

    return out;
  }

  return { levels: levels, phraseLevels: phraseLevels, words: words, phrases: phrases, media: media };
})();
