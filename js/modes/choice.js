/* =============================================================
   modes/choice.js — "pick the right one".
   Renders any mix of letter tiles, words, emoji, colour swatches and
   ink-coloured words. Every mode in the app that is a multiple choice
   is this file, regardless of subject.
   ============================================================= */
window.LG = window.LG || {};
LG.Modes = LG.Modes || {};

LG.Modes.choice = (function () {
  'use strict';

  var UI = LG.UI;

  function renderOption(o, index, q) {
    var node;

    if (o.kind === 'swatch') {
      node = UI.el('button', {
        class: 'opt opt-swatch',
        type: 'button',
        style: 'background:' + (o.bg || o.value),
        'aria-label': o.value,
        'data-value': o.value
      });
    } else if (o.kind === 'group') {
      // a countable cluster of objects, e.g. 8 stars next to 5 stars
      node = UI.el('button', { class: 'opt opt-group', type: 'button' });
      var row = UI.el('span', { class: 'group-items' });
      for (var gi = 0; gi < o.count; gi++) {
        row.appendChild(UI.el('i', { text: o.value }));
      }
      node.appendChild(row);
      node.appendChild(UI.el('b', { class: 'group-n', text: String(o.count) }));
    } else if (o.kind === 'emoji') {
      node = UI.el('button', {
        class: 'opt opt-emoji', type: 'button',
        html: '<span class="emoji">' + o.value + '</span>'
      });
    } else if (o.kind === 'word') {
      // the word is painted in a colour — used by the colour-trap levels
      node = UI.el('button', {
        class: 'opt opt-word', type: 'button',
        style: 'color:' + (o.color || 'inherit'),
        text: o.value
      });
    } else if (o.kind === 'letter') {
      node = UI.el('button', {
        class: 'opt opt-letter', type: 'button',
        text: o.value
      });
    } else {
      node = UI.el('button', { class: 'opt opt-text', type: 'button', text: o.value });
    }

    node.setAttribute('data-idx', index);
    node.appendChild(UI.el('span', { class: 'opt-num', text: String(index + 1) }));
    return node;
  }

  return {
    id: 'choice',
    label: 'Choose',

    render: function (container, question, api) {
      var grid = UI.el('div', { class: 'opt-grid' + (question.options.length <= 4 ? ' cols-4' : ' cols-3') });
      var buttons = [];

      question.options.forEach(function (o, i) {
        var b = renderOption(o, i, question);
        b.addEventListener('click', function () {
          if (api.isLocked()) return;
          api.lock();
          buttons.forEach(function (x) { x.disabled = true; });
          var ok = i === question.correct;
          buttons[i].classList.add(ok ? 'right' : 'wrong');
          if (!ok) buttons[question.correct].classList.add('right');
          api.submit(ok, { picked: o.value });
        });
        buttons.push(b);
        grid.appendChild(b);
      });

      container.appendChild(grid);

      function onKey(e) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= buttons.length) { buttons[n - 1].click(); }
      }
      document.addEventListener('keydown', onKey);

      return {
        destroy: function () { document.removeEventListener('keydown', onKey); }
      };
    },

    /* Used by the engine when a pupil runs out of time. */
    reveal: function (container, question) {
      var nodes = container.querySelectorAll('.opt');
      if (nodes[question.correct]) nodes[question.correct].classList.add('right');
      nodes.forEach(function (n) { n.disabled = true; });
    }
  };
})();
