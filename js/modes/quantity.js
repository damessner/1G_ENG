/* =============================================================
   modes/quantity.js — "how many?".
   A field of identical objects the pupil taps to count, then confirms.
   Deliberately NOT auto-submitting on reaching the target: if it did,
   a child could tap blindly until the number matched and never count
   at all. The explicit Check button is what makes it a counting task.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.quantity = (function () {
  'use strict';

  var UI = LG.UI;

  return {
    id: 'quantity',
    label: 'Count',

    render: function (container, question, api) {
      var minus = question.operation === 'minus';
      var total = minus ? (question.start != null ? question.start : question.pool) : question.pool;
      var selected = [];
      var locked = false;

      var counter = UI.el('div', { class: 'counter' });
      var grid = UI.el('div', { class: 'obj-grid' });
      var foot = UI.el('div', { class: 'qty-foot' });

      function itemNode(i) {
        var b = UI.el('button', { class: 'obj', type: 'button', 'data-i': i, 'aria-pressed': 'false' });
        b.appendChild(UI.el('span', { class: 'obj-emoji', text: question.item.value }));
        b.addEventListener('click', function () {
          if (locked) return;
          var at = selected.indexOf(i);
          if (at !== -1) { selected.splice(at, 1); b.classList.remove('on'); }
          else { selected.push(i); b.classList.add('on'); }
          b.setAttribute('aria-pressed', selected.indexOf(i) !== -1 ? 'true' : 'false');
          paint();
        });
        return b;
      }

      for (var i = 0; i < total; i++) grid.appendChild(itemNode(i));

      function paint() {
        var n = selected.length;
        if (minus) {
          counter.innerHTML = '';
          counter.appendChild(UI.el('b', { text: String(n) }));
          counter.appendChild(UI.el('span', { text: n === 1 ? ' taken away' : ' taken away' }));
        } else {
          counter.innerHTML = '';
          counter.appendChild(UI.el('b', { text: String(n) }));
          counter.appendChild(UI.el('span', { text: n === 1 ? ' object' : ' objects' }));
        }
        check.disabled = n === 0;
      }

      var check = UI.el('button', { class: 'btn btn-primary btn-big', type: 'button', text: 'Check' });
      check.disabled = true;
      check.addEventListener('click', function () {
        if (locked || !selected.length) return;
        locked = true;
        var n = selected.length;
        var ok = n === question.answer;
        if (ok) {
          grid.querySelectorAll('.obj.on').forEach(function (b) { b.classList.add('right'); });
        } else {
          // light up the first `answer` objects so the count is visible
          var marks = grid.querySelectorAll('.obj');
          for (var k = 0; k < marks.length; k++) {
            marks[k].classList.toggle('should', k < question.answer);
          }
        }
        counter.classList.add(ok ? 'right' : 'wrong');
        setTimeout(function () { api.submit(ok, { count: n }); }, ok ? 380 : 900);
      });

      var reset = UI.el('button', { class: 'btn btn-ghost', type: 'button', text: 'Clear' });
      reset.addEventListener('click', function () {
        if (locked) return;
        selected = [];
        grid.querySelectorAll('.obj').forEach(function (b) { b.classList.remove('on', 'right', 'should'); b.setAttribute('aria-pressed', 'false'); });
        paint();
      });

      foot.appendChild(counter);
      foot.appendChild(reset);
      foot.appendChild(check);

      container.appendChild(grid);
      container.appendChild(foot);
      paint();

      return {
        destroy: function () {}
      };
    },

    reveal: function (container, question) {
      var marks = container.querySelectorAll('.obj');
      for (var k = 0; k < marks.length && k < question.answer; k++) {
        marks[k].classList.add('should');
      }
    }
  };
})();
