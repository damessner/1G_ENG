/* =============================================================
   modes/findError.js — "find the mistake".

   A sentence, or a short paragraph with several mistakes in it. The
   pupil taps the words they believe are wrong, then checks.

   This is the strongest grammar mechanic in the set, because it cannot
   be passed by recognising a familiar shape. Every other mode offers the
   pupil the right answer among wrong ones; this one hands them a
   sentence that is already wrong and makes them prove it. Proof-reading
   is a real skill, and the one that transfers to writing.

   Mistakes are marked INLINE in the source text with braces:
       "She {am} my sister."
   Matching on the bare word would be wrong, because in a paragraph "is"
   is often both correct and a mistake and there is no way to tell the
   two occurrences apart. Braces mean "this occurrence".
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.findError = (function () {
  'use strict';

  var UI = LG.UI;
  var TOKEN = /\{([^}]*)\}|(\S+)/g;

  return {
    id: 'findError',
    label: 'Find the mistake',

    render: function (container, question, api) {
      var text = question.text || '';
      var locked = false;
      var chosen = {};        // "sentIdx:wordIdx" -> true
      var errorAt = {};       // "sentIdx:wordIdx" -> true
      var wantCount = 0;

      var sentences = String(text)
        .split(/(?<=[.!?])\s+/)
        .filter(function (s) { return s.trim(); });

      var paper = UI.el('div', { class: 'err-paper' });

      sentences.forEach(function (sentence, si) {
        var line = UI.el('p', { class: 'err-sentence' });
        var wi = 0;
        TOKEN.lastIndex = 0;
        var m;
        while ((m = TOKEN.exec(sentence)) !== null) {
          if (!m[0].trim()) continue;
          var isError = m[1] !== undefined;
          var raw = isError ? m[1] : m[2];
          var key = si + ':' + wi;
          wi += 1;
          if (isError) { errorAt[key] = true; wantCount += 1; }
          line.appendChild(makeWord(raw, key, isError));
          line.appendChild(document.createTextNode(' '));
        }
        paper.appendChild(line);
      });

      /* Built in its own function so `key` is a real parameter. Declaring
         it with var inside the loop above would hoist one shared binding
         to this scope, and every tap would then register against the
         LAST word of its sentence rather than the one tapped. */
      function makeWord(text, key, isError) {
        var span = UI.el('button', {
          class: 'err-word' + (isError ? ' is-error' : ''),
          type: 'button', text: text, 'data-k': key
        });
        span.addEventListener('click', function () {
          if (locked) return;
          if (chosen[key]) { delete chosen[key]; span.classList.remove('is-picked'); }
          else { chosen[key] = true; span.classList.add('is-picked'); }
          updateFoot();
        });
        return span;
      }

      var foot = UI.el('div', { class: 'err-foot' });
      var counter = UI.el('span', { class: 'err-count' });
      var check = UI.el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Check my answer'
      });

      function updateFoot() {
        var n = Object.keys(chosen).filter(function (k) { return chosen[k]; }).length;
        counter.textContent = n + ' of ' + wantCount + ' found';
        check.disabled = n === 0;
      }

      check.addEventListener('click', function () {
        if (locked) return;
        locked = true;
        var picked = Object.keys(chosen).filter(function (k) { return chosen[k]; });
        var allErrors = Object.keys(errorAt);
        var rightOnes = picked.filter(function (k) { return errorAt[k]; });
        var falseOnes = picked.filter(function (k) { return !errorAt[k]; });
        var ok = rightOnes.length === allErrors.length && falseOnes.length === 0;

        paper.querySelectorAll('.err-word').forEach(function (w) {
          var k = w.dataset.k;
          if (errorAt[k]) w.classList.add('right');
          if (chosen[k] && !errorAt[k]) w.classList.add('wrong');
        });
        UI.clear(foot);
        foot.appendChild(UI.el('span', {
          class: 'err-result ' + (ok ? 'good' : 'bad'),
          text: ok ? 'Well spotted them all!' : 'Look again \u2014 the wrong words are marked.'
        }));
        LG.Audio.say(ok ? 'ui/correct' : 'ui/wrong');
        setTimeout(function () { api.submit(ok, { picked: picked.length }); }, ok ? 700 : 1700);
      });

      foot.appendChild(counter);
      foot.appendChild(check);
      updateFoot();

      container.appendChild(paper);
      container.appendChild(UI.el('p', {
        class: 'mode-hint',
        text: wantCount === 1
          ? 'Tap the one word that is wrong.'
          : 'Tap every word that is wrong, then check.'
      }));
      container.appendChild(foot);

      return { destroy: function () {} };
    }
  };
})();
