/* =============================================================
   modes/worksheet.js — a reading and all of its questions, on one page.

   The text sits at the top and stays there. Every question is visible
   underneath at once, as compactly as it will go, so a pupil reads once
   and works down the list with the text in view. Asking them one at a
   time hid the text and turned a reading exercise into a memory test.

   Each question is marked independently and the whole worksheet reports
   back as one aggregate, so a pupil who gets seven of ten keeps seven of
   the ten stars rather than the whole round or nothing.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.worksheet = (function () {
  'use strict';

  var UI = LG.UI;
  var Q = LG.Q;

  function tidy(s) {
    return String(s || '').toLowerCase().replace(/[.,!?;:"'’]/g, '').replace(/\s+/g, ' ').trim();
  }

  function centre(el) {
    var r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }
  function tap(el) {
    var p = centre(el);
    var id = Math.floor(p.clientX * 7) + 1;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: p.clientX, clientY: p.clientY, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: p.clientX, clientY: p.clientY, bubbles: true }));
  }

  return {
    id: 'worksheet',
    label: 'Read and answer',

    render: function (container, question, api) {
      var items = question.items || [];
      var marked = false;

      LG.Readings.renderText(container, question);

      var sheet = UI.el('div', { class: 'ws' });
      var rows = [];

      items.forEach(function (it, n) {
        var row = UI.el('div', { class: 'ws-row', 'data-i': n });
        row.appendChild(UI.el('span', { class: 'ws-n', text: String(n + 1) }));
        var q = UI.el('div', { class: 'ws-q' });
        q.appendChild(UI.el('span', { class: 'ws-q-text', text: it.q }));
        if (it.hint) q.appendChild(UI.el('span', { class: 'ws-hint', text: it.hint }));
        row.appendChild(q);
        var a = UI.el('div', { class: 'ws-a' });
        row.appendChild(a);
        sheet.appendChild(row);
        rows.push(build(it, n, a, row, function () { return marked; }));
      });

      var foot = UI.el('div', { class: 'ws-foot' });
      var check = UI.el('button', { class: 'btn btn-primary', type: 'button', text: 'Check my answers' });
      var score = UI.el('span', { class: 'ws-score' });
      foot.appendChild(check);
      foot.appendChild(score);
      sheet.appendChild(foot);
      container.appendChild(sheet);

      check.addEventListener('click', function () {
        if (marked) return;
        marked = true;
        var right = 0;
        rows.forEach(function (r) { if (r.mark()) right += 1; });
        var total = rows.length;
        var pct = total ? Math.round((right / total) * 100) : 0;
        score.className = 'ws-score ' + (pct >= 70 ? 'good' : 'bad');
        score.textContent = right + ' of ' + total + ' correct';
        check.textContent = 'Finished';
        check.disabled = true;
        LG.Audio.say(pct >= 70 ? 'ui/correct' : 'ui/wrong');
        /* One aggregate result for the whole worksheet, so partial credit
           counts towards the stars. */
        setTimeout(function () {
          api.submit(pct >= 70, { correct: right, total: total });
        }, 1600);
      });

      /* ---- one question, built to be one short row ---- */
      function build(it, n, host, row) {
        var state = {};
        var mark = function (ok) { return ok; };

        if (it.type === 'single' || it.type === 'tf') {
          var opts = it.type === 'tf'
            ? [['True', true], ['False', false]]
            : it.options.map(function (o) { return [o, false]; });
          if (it.type === 'tf') state.answer = !!it.answer;
          else state.answer = it.answer;

          var order = opts.map(function (o, i) { return i; });
          if (it.type !== 'tf') order = Q.shuffle(order);
          order.forEach(function (i) {
            var b = UI.el('button', { class: 'ws-opt', type: 'button', text: opts[i][0] });
            b.addEventListener('click', function () {
              if (marked) return;
              host.querySelectorAll('.ws-opt').forEach(function (x) { x.classList.remove('is-on'); });
              b.classList.add('is-on');
              state.picked = (it.type === 'tf') ? opts[i][1] : i;
            });
            host.appendChild(b);
          });
          mark = function () {
            var ok = state.picked === state.answer;
            host.querySelectorAll('.ws-opt').forEach(function (x, i) {
              x.disabled = true;
              var val = (it.type === 'tf') ? opts[i][1] : i;
              if (val === state.answer) x.classList.add('is-right');
              else if (x.classList.contains('is-on')) x.classList.add('is-wrong');
            });
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        if (it.type === 'multi') {
          state.picked = {};
          var right = [].concat(it.answer).map(String);
          it.options.forEach(function (o, i) {
            var b = UI.el('button', { class: 'ws-opt ws-opt-tick', type: 'button', text: o });
            b.addEventListener('click', function () {
              if (marked) return;
              var k = String(i);
              if (state.picked[k]) { delete state.picked[k]; b.classList.remove('is-on'); }
              else { state.picked[k] = true; b.classList.add('is-on'); }
            });
            host.appendChild(b);
          });
          mark = function () {
            var got = Object.keys(state.picked);
            var hits = got.filter(function (k) { return right.indexOf(k) !== -1; });
            var misses = got.filter(function (k) { return right.indexOf(k) === -1; });
            var ok = hits.length === right.length && misses.length === 0;
            host.querySelectorAll('.ws-opt').forEach(function (x, i) {
              x.disabled = true;
              var k = String(i);
              if (right.indexOf(k) !== -1) x.classList.add('is-right');
              else if (state.picked[k]) x.classList.add('is-wrong');
            });
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        if (it.type === 'open') {
          var input = UI.el('input', { class: 'ws-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'your answer' });
          var note = UI.el('span', { class: 'ws-mark' });
          host.appendChild(input);
          host.appendChild(note);
          var accepted = [].concat(it.answer).map(tidy);
          mark = function () {
            var ok = accepted.indexOf(tidy(input.value)) !== -1;
            input.disabled = true;
            note.textContent = ok ? '✓' : '✗ ' + (accepted[0] || '');
            note.className = 'ws-mark ' + (ok ? 'good' : 'bad');
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        if (it.type === 'vocabMatch') {
          var pairs = it.pairs;
          var bin = host;
          bin.classList.add('ws-match');
          pairs.forEach(function (p, i) {
            var slot = UI.el('button', { class: 'ws-slot', type: 'button', 'data-right': String(i) },
              [UI.el('span', { text: p[1] })]);
            bin.appendChild(slot);
          });
          pairs.forEach(function (p, i) {
            var piece = UI.el('button', { class: 'ws-piece', type: 'button', 'data-left': String(i) },
              [UI.el('span', { text: p[0] })]);
            bin.appendChild(piece);
            LG.Drag.enable(piece, {
              zoneSelector: '.ws-slot',
              onDrop: function (el, zone) {
                if (marked) return false;
                var l = el.dataset.left, r = zone.dataset.right;
                if (String(l) === String(r)) {
                  zone.appendChild(el);
                  el.dataset.placed = 'true';
                  el.classList.add('is-done');
                  zone.classList.add('is-filled');
                  return true;
                }
                return false;
              }
            });
          });
          mark = function () {
            var ok = pairs.every(function (p, i) {
              var slot = bin.querySelector('.ws-slot[data-right="' + i + '"]');
              return slot.querySelector('.ws-piece[data-left="' + i + '"]');
            });
            bin.querySelectorAll('.ws-piece').forEach(function (x) { x.disabled = true; });
            bin.querySelectorAll('.ws-slot').forEach(function (x) { x.disabled = true; });
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        if (it.type === 'vocabSort') {
          var sb = host;
          sb.classList.add('ws-sort');
          it.bins.forEach(function (b) {
            var binEl = UI.el('div', { class: 'ws-bin drop-zone', 'data-bin': b.id },
              [UI.el('span', { class: 'ws-bin-label', text: b.label })]);
            sb.appendChild(binEl);
          });
          it.items.forEach(function (item, i) {
            var piece = UI.el('button', { class: 'ws-piece', type: 'button', 'data-item': String(i) },
              [UI.el('span', { text: item.value })]);
            sb.appendChild(piece);
            LG.Drag.enable(piece, {
              zoneSelector: '.ws-bin',
              onDrop: function (el, zone) {
                if (marked) return false;
                if (zone.dataset.bin === item.bin) {
                  zone.appendChild(el);
                  el.dataset.placed = 'true';
                  el.classList.add('is-done');
                  return true;
                }
                return false;
              }
            });
          });
          mark = function () {
            var ok = it.items.every(function (item, i) {
              var piece = sb.querySelector('.ws-piece[data-item="' + i + '"]');
              return piece.parentElement.classList.contains('ws-bin');
            });
            sb.querySelectorAll('.ws-piece, .ws-bin').forEach(function (x) { x.disabled = true; });
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        if (it.type === 'vocabSpell') {
          var answer = String(it.word).toLowerCase();
          var letters = UI.el('div', { class: 'ws-tiles' });
          var target = UI.el('div', { class: 'ws-spell-target' });
          var bank = answer.split('').slice();
          for (var i = bank.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = bank[i]; bank[i] = bank[j]; bank[j] = t;
          }
          var slotEls = [];
          for (var s = 0; s < answer.length; s++) {
            (function (idx) {
              var sl = UI.el('button', { class: 'ws-spell-slot', type: 'button' });
              sl.addEventListener('click', function () {
                if (marked || !sl.dataset.ch) return;
                var ch = sl.dataset.ch;
                delete sl.dataset.ch;
                sl.textContent = ''; sl.classList.remove('is-filled');
                var back = host.querySelector('.ws-piece[data-ch="' + CSS.escape(ch) + '"]:not([data-placed])');
                if (back) { back.dataset.placed = ''; back.classList.remove('is-done'); }
              });
              slotEls.push(sl);
              target.appendChild(sl);
            })(s);
          }
          bank.forEach(function (ch) {
            var p = UI.el('button', { class: 'ws-piece ws-piece-sm', type: 'button', 'data-ch': ch },
              [UI.el('span', { text: ch })]);
            p.addEventListener('click', function () {
              if (marked) return;
              var free = slotEls.find(function (x) { return !x.dataset.ch; });
              if (!free) return;
              free.dataset.ch = ch;
              free.textContent = ch;
              free.classList.add('is-filled');
              p.dataset.placed = 'true';
              p.classList.add('is-done');
            });
            letters.appendChild(p);
          });
          host.appendChild(target);
          host.appendChild(letters);
          if (it.hint) host.appendChild(UI.el('span', { class: 'ws-hint', text: it.hint }));
          mark = function () {
            var guess = slotEls.map(function (x) { return x.dataset.ch || ''; }).join('');
            var ok = guess === answer;
            slotEls.forEach(function (x) { x.disabled = true; x.classList.add(ok ? 'is-right' : 'is-wrong'); });
            letters.querySelectorAll('.ws-piece').forEach(function (x) { x.disabled = true; });
            row.classList.add(ok ? 'is-ok' : 'is-bad');
            return ok;
          };
          return { mark: mark };
        }

        row.classList.add('is-bad');
        return { mark: function () { return false; } };
      }

      return { destroy: function () { LG.Drag.clearSelection(); } };
    }
  };
})();
