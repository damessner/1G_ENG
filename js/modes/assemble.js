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
      var answer = question.answer;
      var slots = [];
      var bank = [];
      var locked = false;

      var slotsRow = UI.el('div', { class: 'slot-row' });
      var bankRow = UI.el('div', { class: 'bank-row' });
      var hintLine = UI.el('div', { class: 'hint-line' });

      /* ---- slots ---- */
      answer.split('').forEach(function (ch, i) {
        var slot = UI.el('button', {
          class: 'slot', type: 'button', 'data-i': i,
          'aria-label': 'Letter ' + (i + 1)
        });
        slot.addEventListener('click', function () {
          if (locked) return;
          var idx = parseInt(slot.getAttribute('data-i'), 10);
          if (slots[idx] && slots[idx].filled) {
            // return the letter to the bank
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
         seeding a free letter splices it out of the bank, so the bank has
         to exist before we hand any letter over. */
      bank = question.letters.slice();
      // shuffle so the answer never reads left-to-right by accident
      for (var i = bank.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bank[i]; bank[i] = bank[j]; bank[j] = t;
      }

      /* ---- reveal the first letter on very short words ---- */
      var revealed = 0;
      (function seedHints() {
        var n = question.revealFirst || 0;
        for (var k = 0; k < n; k++) {
          var i = k;
          var ch = answer[i];
          slots[i].filled = true;
          slots[i].ch = ch;
          slots[i].node.textContent = ch;
          slots[i].node.classList.add('filled', 'given');
          var at = bank.indexOf(ch);
          if (at !== -1) bank.splice(at, 1);
        }
        revealed = n;
      })();

      function typed() {
        return slots.filter(function (s) { return s.filled; }).map(function (s) { return s.ch; }).join('');
      }

      function maybeAutoSubmit() {
        if (slots.every(function (s) { return s.filled; })) {
          locked = true;
          var guess = typed().toLowerCase();
          var ok = guess === answer.toLowerCase();
          slots.forEach(function (s) { s.node.classList.add(ok ? 'right' : 'wrong'); });
          if (!ok) {
            // show the real word, letter by letter
            answer.split('').forEach(function (ch, i) {
              setTimeout(function () {
                slots[i].node.textContent = ch;
                slots[i].node.classList.remove('wrong');
                slots[i].node.classList.add('given');
              }, 220 * (i + 1));
            });
          }
          setTimeout(function () { api.submit(ok, { guess: guess, hinted: revealed > 0 }); },
            ok ? 320 : 220 * answer.length + 380);
        }
      }

      /* ---- hint: reveal the next empty letter ---- */
      function hint() {
        var i = slots.findIndex(function (s) { return !s.filled; });
        if (i === -1) return false;
        var ch = answer[i];
        slots[i].filled = true;
        slots[i].ch = ch;
        slots[i].node.textContent = ch;
        slots[i].node.classList.add('filled', 'given');
        var at = bank.indexOf(ch);
        if (at !== -1) bank.splice(at, 1);
        revealed += 1;
        draw();
        hintLine.textContent = revealed === 1 ? 'hint: 1 letter given' : 'hints used: ' + revealed;
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
      question.answer.split('').forEach(function (ch, i) {
        if (nodes[i]) { nodes[i].textContent = ch; nodes[i].classList.add('given'); }
      });
    }
  };
})();
