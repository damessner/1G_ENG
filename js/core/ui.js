/* =============================================================
   ui.js — small DOM helpers, overlays, and celebration effects.
   No framework: everything here is plain DOM so the game stays
   a folder of files you can open straight from disk.
   ============================================================= */
window.LG = window.LG || {};

LG.UI = (function () {
  'use strict';

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function show(name) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.getAttribute('data-screen') === name);
    });
    window.scrollTo(0, 0);
  }

  function stars(n, max) {
    max = max || 3;
    var wrap = el('div', { class: 'stars' });
    for (var i = 0; i < max; i++) {
      wrap.appendChild(el('span', { class: 'star' + (i < n ? ' on' : ''), text: '★' }));
    }
    return wrap;
  }

  /* ---------------- modal ---------------- */
  function modal(opts) {
    var root = document.getElementById('modal-root');
    var card = el('div', { class: 'modal' });

    if (opts.title) card.appendChild(el('h3', { class: 'modal-title', text: opts.title }));
    if (opts.body) card.appendChild(opts.body);

    var foot = el('div', { class: 'modal-foot' });
    (opts.buttons || [{ label: 'OK' }]).forEach(function (b) {
      foot.appendChild(el('button', {
        class: 'btn ' + (b.variant ? 'btn-' + b.variant : 'btn-ghost'),
        text: b.label,
        onclick: function () {
          if (b.action) { if (b.action(card) === false) return; }
          close();
        }
      }));
    });
    card.appendChild(foot);
    root.classList.add('on');
    root.innerHTML = '';
    root.appendChild(card);

    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function close() {
      document.removeEventListener('keydown', onKey);
      root.classList.remove('on');
      root.innerHTML = '';
      if (opts.onClose) opts.onClose();
    }
    return { close: close, card: card };
  }

  function confirm(title, message, onYes) {
    return modal({
      title: title,
      body: el('p', { class: 'modal-text', text: message }),
      buttons: [
        { label: 'Cancel' },
        { label: 'Yes', variant: 'danger', action: onYes }
      ]
    });
  }

  /* ---------------- celebration ---------------- */
  var FX_COLORS = ['#facc15', '#f97316', '#ec4899', '#6366f1', '#22c55e', '#38bdf8'];

  function burst(count, originX, originY) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var fx = document.getElementById('fx');
    var n = count || 26;
    for (var i = 0; i < n; i++) {
      (function () {
        var p = el('i', { class: 'particle' });
        var x = originX != null ? originX : window.innerWidth / 2;
        var y = originY != null ? originY : window.innerHeight / 2;
        var angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        var dist = 90 + Math.random() * 170;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.background = FX_COLORS[i % FX_COLORS.length];
        p.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
        p.style.setProperty('--dy', (Math.sin(angle) * dist - 60) + 'px');
        p.style.animationDuration = (700 + Math.random() * 500) + 'ms';
        fx.appendChild(p);
        (function remove(node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1400); })(p);
      })();
    }
  }

  function flashClass(node, cls, ms) {
    if (!node) return;
    node.classList.add(cls);
    setTimeout(function () { node.classList.remove(cls); }, ms || 500);
  }

  function shake(node) { flashClass(node, 'shake', 420); }

  function toast(text, ms) {
    var fx = document.getElementById('fx');
    var t = el('div', { class: 'toast', text: text });
    fx.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 1800);
  }

  return {
    el: el, clear: clear, show: show, stars: stars,
    modal: modal, confirm: confirm,
    burst: burst, shake: shake, flashClass: flashClass, toast: toast
  };
})();
