/* =============================================================
   modes/type.js — open questions: type one or two words.

   The only mode where the pupil produces text rather than choosing
   from options, so it is the strongest recall test in the app and the
   reason the Writing strand is covered at all.

   Marking is forgiving on purpose: case, punctuation and stray spaces do
   not matter, and several answers are accepted. Two wrong attempts then
   offer the answer rather than leaving a pupil stuck on it -- consistent
   with the rest of the app, where being wrong costs nothing but time.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.type = (function () {
  'use strict';

  var UI = LG.UI;

  function normalise(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[.,!?;:"'’]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    id: 'type',
    label: 'Type it',

    render: function (container, question, api) {
      var accepted = (question.answers || (question.answer ? [question.answer] : []))
        .map(normalise);
      var tries = 0;
      var locked = false;

      var card = UI.el('div', { class: 'type-card' });
      if (question.prompt) {
        card.appendChild(UI.el('div', { class: 'type-q', text: question.prompt }));
      }
      if (question.hint) {
        card.appendChild(UI.el('div', { class: 'type-hint', text: question.hint }));
      }

      var input = UI.el('input', {
        class: 'type-input', type: 'text', autocomplete: 'off',
        autocapitalize: 'off', spellcheck: 'false', placeholder: 'your answer'
      });
      var row = UI.el('div', { class: 'type-row' });
      var check = UI.el('button', { class: 'btn btn-primary', type: 'button', text: 'Check' });
      var give = UI.el('button', { class: 'btn btn-ghost', type: 'button', text: 'Show the answer' });
      var note = UI.el('div', { class: 'type-note' });

      function mark(ok) {
        UI.clear(note);
        note.className = 'type-note ' + (ok ? 'good' : 'bad');
        if (ok) {
          note.textContent = 'Yes!';
          LG.Audio.say('ui/correct');
        } else {
          note.textContent = tries >= 2
            ? 'The answer is: ' + accepted[0]
            : 'Not quite. Try once more.';
          LG.Audio.say('ui/wrong');
        }
      }

      check.addEventListener('click', function () {
        if (locked) return;
        var guess = normalise(input.value);
        if (!guess) return;
        var ok = accepted.indexOf(guess) !== -1;
        if (ok) {
          locked = true;
          mark(true);
          setTimeout(function () { api.submit(true, {}); }, 650);
        } else {
          tries += 1;
          mark(false);
          if (tries >= 2) give.classList.add('is-offer');
        }
      });

      give.addEventListener('click', function () {
        if (locked) return;
        locked = true;
        input.value = accepted[0] || '';
        UI.clear(note);
        note.className = 'type-note bad';
        note.textContent = 'The answer is: ' + (accepted[0] || '');
        LG.Audio.say('ui/wrong');
        setTimeout(function () { api.submit(false, { revealed: true }); }, 1400);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); check.click(); }
      });

      row.appendChild(input);
      row.appendChild(check);
      row.appendChild(give);
      card.appendChild(row);
      card.appendChild(note);
      container.appendChild(card);
      container.appendChild(UI.el('p', {
        class: 'mode-hint',
        text: 'One or two words. Spelling and capital letters do not matter.'
      }));
      setTimeout(function () { try { input.focus(); } catch (e) { /* not focused */ } }, 60);

      return { destroy: function () {} };
    }
  };
})();
