/* =============================================================
   modes/match.js — "connect these".

   Two columns: sources on the left, targets on the right. Drag a source
   across, or tap one then tap the other. Used for word-picture pairs,
   singular-plural, translation, and any "these go together" exercise.

   The question supplies the pairs and the mode builds the board, so a
   level author never touches the DOM.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.match = (function () {
  'use strict';

  var UI = LG.UI;

  return {
    id: 'match',
    label: 'Match',

    render: function (container, question, api) {
      var left = question.left || [];      // [{ id, value }]
      var right = question.right || [];    // [{ id, value }]
      var pairs = question.pairs || {};    // rightId -> leftId
      var teardown = [];
      var locked = false;
      var done = 0;

      var board = UI.el('div', { class: 'match-board' });
      var colA = UI.el('div', { class: 'match-col' });
      var colB = UI.el('div', { class: 'match-col' });

      var pending = {};   // rightId -> leftId, awaiting the second half

      function shuffled(list) {
        var a = list.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }

      function accept(piece, zone) {
        if (locked) return false;
        var rightId = zone.dataset.rightId;
        var leftId = piece.dataset.leftId;
        if (!rightId || !leftId) return false;
        // tapping a target that already holds a piece takes it back out
        if (zone.dataset.filled === 'true') return false;

        if (pairs[rightId] === leftId) {
          zone.appendChild(piece);
          zone.dataset.filled = 'true';
          piece.dataset.placed = 'true';
          piece.classList.add('is-matched');
          zone.classList.add('is-filled');
          LG.Audio.say('ui/correct');
          done += 1;
          if (done === pairsCount()) {
            locked = true;
            setTimeout(function () { api.submit(true, {}); }, 420);
          }
          return true;
        }

        // wrong: flash the target, do not move the piece
        zone.classList.add('is-wrong');
        setTimeout(function () { zone.classList.remove('is-wrong'); }, 420);
        LG.Audio.say('ui/wrong');
        return false;
      }

      function pairsCount() { return Object.keys(pairs).length; }

      // ---- left column: the draggable pieces ----
      shuffled(left).forEach(function (item) {
        var piece = UI.el('button', {
          class: 'match-piece match-piece-' + (item.kind || 'text'),
          type: 'button', 'data-left-id': item.id
        }, [UI.el('span', { text: item.value })]);
        if (item.kind === 'emoji') piece.classList.add('is-emoji');
        colA.appendChild(piece);
        teardown.push(LG.Drag.enable(piece, {
          zoneSelector: '.match-slot',
          onDrop: accept
        }));
      });

      // ---- right column: the drop targets ----
      shuffled(right).forEach(function (item) {
        var slot = UI.el('button', {
          class: 'match-slot drop-zone', type: 'button',
          'data-right-id': item.id, 'aria-label': 'Drop here'
        });
        if (item.kind === 'emoji') slot.classList.add('is-emoji');
        else slot.appendChild(UI.el('span', { class: 'match-label', text: item.value }));
        // a target must also respond to a tap, for the no-drag route
        teardown.push(LG.Drag.makeTarget(slot, { zoneSelector: '.match-slot' }));
        colB.appendChild(slot);
      });

      board.appendChild(colA);
      board.appendChild(colB);
      container.appendChild(board);
      container.appendChild(UI.el('p', { class: 'mode-hint', text: 'Drag a word across, or tap one and then tap where it goes.' }));

      return {
        destroy: function () {
          teardown.forEach(function (fn) { fn && fn(); });
          LG.Drag.clearSelection();
        }
      };
    }
  };
})();
