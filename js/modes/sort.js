/* =============================================================
   modes/sort.js — "put these in the right box".

   Several bins across the top, a tray of pieces underneath. Drag (or
   tap) each piece into a bin. Built for the grammar and phonics
   categories that recur all year: am/is/are, singular/plural,
   /z/ vs /s/, odd-one-out.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.sort = (function () {
  'use strict';

  var UI = LG.UI;

  return {
    id: 'sort',
    label: 'Sort',

    render: function (container, question, api) {
      var bins = question.bins || [];        // [{ id, label, emoji? }]
      var items = (question.items || []).slice();
      var answerOf = question.answerOf || {};  // itemId -> binId
      var teardown = [];
      var locked = false;
      var placed = 0;

      var wrap = UI.el('div', { class: 'sort-wrap' });
      var binRow = UI.el('div', { class: 'sort-bins' });
      var tray = UI.el('div', { class: 'sort-tray drop-zone' });

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
        var binId = zone.dataset.binId;
        var itemId = piece.dataset.itemId;
        if (!binId || !itemId) return false;

        if (answerOf[itemId] === binId) {
          piece.dataset.placed = 'true';
          zone.appendChild(piece);
          placed += 1;
          bumpCount(zone);
          LG.Audio.say('ui/correct');
          if (placed === items.length) {
            locked = true;
            setTimeout(function () { api.submit(true, {}); }, 420);
          }
          return true;
        }
        zone.classList.add('is-wrong');
        setTimeout(function () { zone.classList.remove('is-wrong'); }, 420);
        LG.Audio.say('ui/wrong');
        return false;
      }

      function bumpCount(bin) {
        var c = bin.querySelector('.sort-bin-count');
        if (c) c.textContent = String(bin.querySelectorAll('.sort-piece').length);
      }

      bins.forEach(function (b) {
        var bin = UI.el('button', {
          class: 'sort-bin drop-zone', type: 'button', 'data-bin-id': b.id
        });
        bin.appendChild(UI.el('span', { class: 'sort-bin-label', text: b.label }));
        bin.appendChild(UI.el('span', { class: 'sort-bin-count', text: '0' }));
        binRow.appendChild(bin);
        teardown.push(LG.Drag.makeTarget(bin, { zoneSelector: '.sort-bin' }));
      });

      shuffled(items).forEach(function (it) {
        var piece = UI.el('button', {
          class: 'sort-piece', type: 'button', 'data-item-id': it.id
        }, [UI.el('span', { text: it.value })]);
        if (it.kind === 'emoji') piece.classList.add('is-emoji');
        tray.appendChild(piece);
        teardown.push(LG.Drag.enable(piece, {
          zoneSelector: '.sort-bin',
          onDrop: accept
        }));
      });

      wrap.appendChild(binRow);
      wrap.appendChild(tray);
      container.appendChild(wrap);
      container.appendChild(UI.el('p', { class: 'mode-hint', text: 'Drag each one into a box, or tap a piece and then a box.' }));

      return {
        destroy: function () {
          teardown.forEach(function (fn) { fn && fn(); });
          LG.Drag.clearSelection();
        }
      };
    }
  };
})();
