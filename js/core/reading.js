/* =============================================================
   reading.js — turns one entry from data/vocab.json "readings" into
   the sequence the engine plays: the text first, then its exercises.

   The German for a highlighted word is looked up in the imported
   vocabulary rather than written into the reading, so a word only ever
   has to be corrected in one place.

   Exercise types:
     single     tap one answer                     (choice)
     multi      tap every answer that applies      (choice, several correct)
     truefalse  true or not                        (choice, two big buttons)
     open       type one or two words              (type)
     vocabMatch English to German, drag            (match)
     vocabSort  which box does it go in           (sort)
     vocabSpell spell the word from the German     (assemble)
   ============================================================= */
window.LG = window.LG || {};

LG.Readings = (function () {
  'use strict';

  var Q = LG.Q;
  var UI = LG.UI;

  /* every word we know a German for, lower-cased */
  function germanIndex() {
    var map = {};
    var topics = (LG.VOCAB && LG.VOCAB.topics) || {};
    Object.keys(topics).forEach(function (k) {
      var t = topics[k];
      ['words', 'phrases'].forEach(function (g) {
        (t[g] || []).forEach(function (e) {
          if (e && e.word && e.de && !map[e.word.toLowerCase()]) {
            map[e.word.toLowerCase()] = e.de.split('/')[0].trim();
          }
        });
      });
    });
    return map;
  }

  /* The words the reading marks, and the German for each. A reading may
     override any of them with its own "gloss". */
  function glossFor(reading) {
    var index = germanIndex();
    var out = {};
    var re = /\{([^}]*)\}/g;
    var m;
    while ((m = re.exec(reading.text || '')) !== null) {
      var w = m[1].replace(/[.,!?;:]$/, '').toLowerCase();
      if (out[w]) continue;
      var own = (reading.gloss || {})[m[1]] || (reading.gloss || {})[w];
      if (own) out[w] = own;
      else if (index[w]) out[w] = index[w];
    }
    return out;
  }

  function readerStep(reading) {
    var gloss = glossFor(reading);
    return {
      type: 'reader',
      prompt: Q.read(reading.title || 'Read the text.'),
      text: reading.text,
      title: reading.title,
      gloss: gloss,
      speak: reading.speak ? Q.wordKey(reading.speak) : null,
      counts: !!reading.counts,
      dedupe: 'read' + (reading.id || reading.title)
    };
  }


  /* ---- individual exercise types ---- */

  function singleStep(ex, n) {
    var opts = Q.shuffle(ex.options.map(function (o, i) {
      return Q.opt('text', o, { id: String(i) });
    }));
    return {
      type: 'choice',
      prompt: Q.read(ex.q),
      options: opts,
      correct: opts.findIndex(function (o) { return o.id === String(ex.answer); }),
      dedupe: 's' + n + ex.q
    };
  }

  /* Several answers can be right, so every correct option must be tapped
     and no wrong one. Rendered as its own step so the marking can allow
     more than one tick. */
  function multiStep(ex, n) {
    var right = [].concat(ex.answer).map(String);
    var opts = Q.shuffle(ex.options.map(function (o, i) {
      return Q.opt('text', o, { id: String(i) });
    }));
    return {
      type: 'multi',
      prompt: Q.read(ex.q + '  (tap all that apply)'),
      options: opts,
      answerIds: right,
      dedupe: 'm' + n + ex.q
    };
  }

  function trueFalseStep(ex, n) {
    return {
      type: 'choice',
      prompt: Q.read(ex.q),
      options: [
        Q.opt('text', 'True', { id: 'T' }),
        Q.opt('text', 'False', { id: 'F' })
      ],
      correct: ex.answer ? 0 : 1,
      big: true,
      dedupe: 'tf' + n + ex.q
    };
  }

  function openStep(ex, n) {
    return {
      type: 'type',
      prompt: Q.read(ex.q),
      hint: ex.hint || null,
      answers: [].concat(ex.answer),
      dedupe: 'o' + n + ex.q
    };
  }

  function vocabMatchStep(ex, n) {
    var picks = ex.pairs.map(function (p) { return { word: p[0], de: p[1] }; });
    var q = Q.translatePairs(picks);
    q.prompt = Q.read(ex.q || 'Drag each English word to its German.');
    q.dedupe = 'vm' + n + picks.map(function (p) { return p.word; }).join('');
    return q;
  }

  function vocabSortStep(ex, n) {
    return {
      type: 'sort',
      prompt: Q.read(ex.q || 'Drag each word into the right box.'),
      bins: ex.bins,
      items: Q.shuffle(ex.items.map(function (it, i) {
        return { id: 'i' + i, value: it.value };
      })),
      answerOf: ex.items.reduce(function (m, it, i) { m['i' + i] = it.bin; return m; }, {}),
      dedupe: 'vs' + n + ex.items.map(function (it) { return it.value; }).join('')
    };
  }

  function vocabSpellStep(ex, n) {
    var q = Q.assemble({
      prompt: Q.audio('de/' + ex.word.toLowerCase()),
      answer: ex.word.toLowerCase(),
      revealFirst: 0
    });
    q.dedupe = 'vsl' + n + ex.word;
    q.hint = ex.hint || 'Spell the English word you hear in German.';
    return q;
  }

  var BUILDERS = {
    single: singleStep, multi: multiStep, truefalse: trueFalseStep,
    open: openStep, vocabMatch: vocabMatchStep, vocabSort: vocabSortStep,
    vocabSpell: vocabSpellStep
  };

  /** The text itself, shown for the WHOLE level with the questions
      underneath. It is not one step in the sequence: a pupil re-reading
      while answering is the point, and the text vanishing the moment the
      questions start turns a reading exercise into a memory test. */
  function readingPane(reading) {
    return {
      title: reading.title,
      text: reading.text,
      gloss: glossFor(reading),
      speak: reading.speak ? Q.wordKey(reading.speak) : null
    };
  }

  /** The exercises that follow the text. */
  function steps(reading) {
    var out = [];
    (reading.questions || []).forEach(function (ex, i) {
      var build = BUILDERS[ex.type];
      if (build) out.push(build(ex, i));
    });
    return out;
  }

  function all() {
    return ((LG.VOCAB && LG.VOCAB.readings) || []);
  }

  function byId(id) {
    var found = all().filter(function (r) { return r.id === id; });
    return found[0] || null;
  }

  /* ---- the text itself ----
     Shared by the standalone reader and the worksheet, so the annotation
     behaves identically in both. Vocabulary is marked inline with braces;
     the German is looked up from the vocabulary, never stored twice. */
  var TOKEN = /\{([^}]*)\}|(\S+)/g;

  function renderText(container, q) {
    var gloss = q.gloss || {};
    var wrap = UI.el('section', { class: 'read-wrap' });
    var sheet = UI.el('article', { class: 'read-sheet' });
    var head = UI.el('div', { class: 'read-head' });

    if (q.title) head.appendChild(UI.el('span', { class: 'read-title', text: q.title }));
    var tools = UI.el('span', { class: 'read-tools' });
    if (q.speak) {
      tools.appendChild(UI.el('button', {
        class: 'read-btn', type: 'button', title: 'Listen to the text',
        text: '\uD83D\uDD0A', 'aria-label': 'Listen to the text',
        onclick: function () { LG.Audio.say(q.speak); }
      }));
    }
    var hidden = false;
    var hideBtn = UI.el('button', {
      class: 'read-btn', type: 'button', text: 'Hide words',
      onclick: function () {
        hidden = !hidden;
        body.classList.toggle('is-hidden', hidden);
        hideBtn.textContent = hidden ? 'Show words' : 'Hide words';
      }
    });
    tools.appendChild(hideBtn);
    var fold = UI.el('button', {
      class: 'read-btn', type: 'button', text: '\u2304',
      title: 'Fold the text away', 'aria-label': 'Fold the text away',
      onclick: function () {
        var f = wrap.classList.toggle('is-folded');
        fold.textContent = f ? '\u2303' : '\u2304';
      }
    });
    tools.appendChild(fold);
    head.appendChild(tools);
    sheet.appendChild(head);

    var body = UI.el('div', { class: 'read-text' });
    var bubble = UI.el('div', { class: 'read-gloss', role: 'status' });

    function open(span, sticky) {
      var de = gloss[span.dataset.w];
      if (!de) return;
      UI.clear(bubble);
      bubble.appendChild(UI.el('b', { text: span.dataset.w }));
      bubble.appendChild(UI.el('span', { text: de }));
      bubble.classList.add('is-open');
      if (sticky) {
        body.querySelectorAll('.read-word.is-open').forEach(function (n) {
          n.classList.remove('is-open');
        });
        span.classList.add('is-open');
      }
      if (span.getBoundingClientRect) {
        var r = span.getBoundingClientRect();
        bubble.style.setProperty('--gx', r.left + window.scrollX + 'px');
        bubble.style.setProperty('--gy', (r.bottom + window.scrollY + 8) + 'px');
      }
    }

    TOKEN.lastIndex = 0;
    var m;
    while ((m = TOKEN.exec(q.text || '')) !== null) {
      if (!m[0].trim()) continue;
      var isVocab = m[1] !== undefined;
      var raw = isVocab ? m[1] : m[2];
      var plain = raw.replace(/[.,!?;:]$/, '');
      var tail = raw.slice(plain.length);

      if (isVocab && gloss[plain.toLowerCase()]) {
        var span = UI.el('button', {
          class: 'read-word', type: 'button', 'data-w': plain.toLowerCase(),
          'aria-label': plain + '. Show the German.'
        }, [UI.el('span', { class: 'read-word-text', text: plain })]);
        span.addEventListener('click', function (e) { e.stopPropagation(); open(span, true); });
        span.addEventListener('mouseenter', function () { open(span, false); });
        span.addEventListener('mouseleave', function () { bubble.classList.remove('is-open'); });
        body.appendChild(span);
      } else {
        body.appendChild(document.createTextNode(raw));
      }
      if (tail) body.appendChild(document.createTextNode(tail));
      body.appendChild(document.createTextNode(' '));
    }
    sheet.appendChild(body);
    wrap.appendChild(sheet);
    container.appendChild(wrap);
    container.appendChild(bubble);
    return { wrap: wrap, body: body };
  }

  /** The exercises as worksheet rows, in the order they were written. */
  function exerciseItems(reading) {
    return (reading.questions || []).map(function (ex) {
      var item = { type: ex.type, q: ex.q, hint: ex.hint || null };
      if (ex.options) item.options = ex.options;
      if (ex.answer !== undefined) item.answer = ex.answer;
      if (ex.pairs) item.pairs = ex.pairs;
      if (ex.bins) item.bins = ex.bins;
      if (ex.items) item.items = ex.items;
      if (ex.word) item.word = ex.word;
      return item;
    });
  }

  return { steps: steps, exerciseItems: exerciseItems, readingPane: readingPane, renderText: renderText, all: all, byId: byId,
           glossFor: glossFor, germanIndex: germanIndex };
})();
