/* =============================================================
   modes/assemble.js — "build it yourself".
   Letter tiles the pupil taps into slots to spell a word. Used for the
   listening-and-spelling levels, and it works for any short string.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.assemble = (function () {
  'use strict';

  var UI = LG.UI;

  return {
    id: 'assemble',
    label: 'Spell it',

    render: function (container, question, api) {
      /* Tiles are whatever the question supplies: single characters for
         spelling a word, whole words for building a sentence. Keeping both
         in one mode means every gap-fill across every unit needs no new
         rendering code. */
      var answer = question.answer;
      var tokens = question.tokens ||
        (Array.isArray(answer) ? answer.slice() : String(answer).split(''));
      var slots = [];
      var bank = [];
      var locked = false;

      var slotsRow = UI.el('div', { class: 'slot-row' });
      var bankRow = UI.el('div', { class: 'bank-row' });
      var hintLine = UI.el('div', { class: 'hint-line' });
      var wordy = tokens.some(function (t) { return t.length > 1; });
      if (wordy) {
        slotsRow.classList.add('slot-row-words');
        bankRow.classList.add('bank-row-words');
      }

      /* ---- slots ---- */
      tokens.forEach(function (tok, i) {
        var slot = UI.el('button', {
          class: 'slot' + (String(tok).length > 1 ? ' slot-word' : ''),
          type: 'button', 'data-i': i,
          'aria-label': (wordy ? 'Word ' : 'Letter ') + (i + 1)
        });
        slot.addEventListener('click', function () {
          if (locked) return;
          var idx = parseInt(slot.getAttribute('data-i'), 10);
          if (slots[idx] && slots[idx].filled) {
            // return the tile to the bank
            bank.splice(bank.indexOf(slots[idx].ch), 1);
            slots[idx].filled = false;
            slots[idx].ch = null;
            slot.textContent = '';
            slot.classList.remove('filled');
          }
          draw();
        });
        slots.push({ node: slot, filled: false, ch: null });
        slotsRow.appendChild(slot);
      });

      /* ---- bank ---- */
      function draw() {
        UI.clear(bankRow);
        bank.forEach(function (ch, i) {
          var b = UI.el('button', { class: 'tile', type: 'button', text: ch });
          b.addEventListener('click', function () {
            if (locked) return;
            var target = slots.findIndex(function (s) { return !s.filled; });
            if (target === -1) return;
            slots[target].filled = true;
            slots[target].ch = ch;
            bank.splice(i, 1);
            slots[target].node.textContent = ch;
            slots[target].node.classList.add('filled');
            draw();
            maybeAutoSubmit();
          });
          bankRow.appendChild(b);
        });
        if (!bank.length) bankRow.appendChild(UI.el('span', { class: 'bank-empty', text: 'all letters used' }));
      }

      /* ---- build the tile bank FIRST ----
         seeding a free tile splices it out of the bank, so the bank has to
         exist before we hand any tile over. */
      /* ---- build the tile bank FIRST ----
         seeding a free tile splices it out of the bank, so the bank has to
         exist before we hand any tile over. */
      bank = tokens.concat(question.extras || []);
      // shuffle so the answer never reads left-to-right by accident
      for (var i = bank.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bank[i]; bank[i] = bank[j]; bank[j] = t;
      }

      /* ---- pre-filled slots, then any free first-letter reveal ----
         `given` is used by a gap-fill, where the sentence arrives with
         everything but the word under test already in place. */
      var revealed = 0;
      (function seed() {
        var preset = (question.given || []).slice();
        var n = question.revealFirst || 0;
        for (var k = 0; k < n; k++) preset.push(k);
        preset.forEach(function (i) {
          if (i < 0 || i >= tokens.length || slots[i].filled) return;
          var ch = tokens[i];
          slots[i].filled = true;
          slots[i].ch = ch;
          slots[i].node.textContent = ch;
          slots[i].node.classList.add('filled', 'given');
          var at = bank.indexOf(ch);
          if (at !== -1) bank.splice(at, 1);
        });
        revealed = preset.length;
      })();

      function typed() {
        return slots.filter(function (s) { return s.filled; }).map(function (s) { return s.ch; });
      }

      function maybeAutoSubmit() {
        if (slots.every(function (s) { return s.filled; })) {
          locked = true;
          var guess = typed();
          // compare tile by tile: works for letters and for words alike,
          // and needs no separator guess
          var ok = guess.length === tokens.length && guess.every(function (t, i) {
            return String(t).toLowerCase() === String(tokens[i]).toLowerCase();
          });
          slots.forEach(function (s) { s.node.classList.add(ok ? 'right' : 'wrong'); });
          if (!ok) {
            // show the real answer, one tile at a time
            tokens.forEach(function (ch, i) {
              setTimeout(function () {
                slots[i].node.textContent = ch;
                slots[i].node.classList.remove('wrong');
                slots[i].node.classList.add('given');
              }, 220 * (i + 1));
            });
          }
          setTimeout(function () { api.submit(ok, { guess: guess, hinted: revealed > 0 }); },
            ok ? 320 : 220 * tokens.length + 380);
        }
      }

      /* ---- hint: reveal the next empty tile ---- */
      function hint() {
        var i = slots.findIndex(function (s) { return !s.filled; });
        if (i === -1) return false;
        var ch = tokens[i];
        slots[i].filled = true;
        slots[i].ch = ch;
        slots[i].node.textContent = ch;
        slots[i].node.classList.add('filled', 'given');
        var at = bank.indexOf(ch);
        if (at !== -1) bank.splice(at, 1);
        revealed += 1;
        draw();
        hintLine.textContent = revealed === 1
          ? (wordy ? 'hint: 1 word given' : 'hint: 1 letter given')
          : 'hints used: ' + revealed;
        if (slots.every(function (s) { return s.filled; })) setTimeout(maybeAutoSubmit, 200);
        return true;
      }

      /* ---- start ---- */
      draw();

      container.appendChild(slotsRow);
      container.appendChild(bankRow);
      container.appendChild(hintLine);

      return {
        hint: hint,
        destroy: function () {}
      };
    },

    reveal: function (container, question) {
      var nodes = container.querySelectorAll('.slot');
      var tokens = question.tokens ||
        (Array.isArray(question.answer)
          ? question.answer.slice()
          : String(question.answer).split(''));
      tokens.forEach(function (ch, i) {
        if (nodes[i]) { nodes[i].textContent = ch; nodes[i].classList.add('given'); }
      });
    }
  };
})();
