/* =============================================================
   modes/multi.js — pick every answer that applies.

   Same board as choice, but more than one option is right and the pupil
   has to find them all without tapping a wrong one. Built for reading
   questions where the honest answer is "these three, not that one".
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.multi = (function () {
  'use strict';

  var UI = LG.UI;

  return {
    id: 'multi',
    label: 'Select all',

    render: function (container, question, api) {
      var right = (question.answerIds || []).map(String);
      var picked = {};
      var locked = false;

      var grid = UI.el('div', { class: 'opt-grid cols-4' });
      var nodes = [];

      question.options.forEach(function (o, i) {
        var b = UI.el('button', { class: 'opt opt-text is-pickable', type: 'button' },
          [UI.el('span', { text: o.value })]);
        b.addEventListener('click', function () {
          if (locked) return;
          var id = String(o.id);
          if (picked[id]) { delete picked[id]; b.classList.remove('is-picked'); }
          else { picked[id] = true; b.classList.add('is-picked'); }
          check.disabled = !Object.keys(picked).length;
        });
        nodes.push({ id: String(o.id), node: b });
        grid.appendChild(b);
      });

      var row = UI.el('div', { class: 'type-row' });
      var check = UI.el('button', { class: 'btn btn-primary', type: 'button', text: 'Check' });
      check.disabled = true;
      var note = UI.el('div', { class: 'type-note' });

      check.addEventListener('click', function () {
        if (locked) return;
        locked = true;
        var got = Object.keys(picked);
        var hitRight = got.filter(function (id) { return right.indexOf(id) !== -1; });
        var hitWrong = got.filter(function (id) { return right.indexOf(id) === -1; });
        var ok = hitRight.length === right.length && hitWrong.length === 0;

        nodes.forEach(function (n) {
          if (right.indexOf(n.id) !== -1) n.node.classList.add('right');
          else if (picked[n.id]) n.node.classList.add('wrong');
          n.node.disabled = true;
        });
        note.className = 'type-note ' + (ok ? 'good' : 'bad');
        note.textContent = ok ? 'Yes, all of them!'
          : 'Correct: ' + question.options.filter(function (o) {
              return right.indexOf(String(o.id)) !== -1;
            }).map(function (o) { return o.value; }).join(', ');
        LG.Audio.say(ok ? 'ui/correct' : 'ui/wrong');
        setTimeout(function () { api.submit(ok, {}); }, ok ? 700 : 1800);
      });

      row.appendChild(check);
      container.appendChild(grid);
      container.appendChild(row);
      container.appendChild(note);
      container.appendChild(UI.el('p', {
        class: 'mode-hint', text: 'Tap every answer that is right, then press Check.'
      }));

      return { destroy: function () {} };
    }
  };
})();
