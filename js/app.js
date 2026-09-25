/* =============================================================
   app.js — screens, navigation and the settings sheet.
   Home -> levels -> game -> result, and the small amount of glue
   that ties the topic packs to the engine.
   ============================================================= */
window.LG = window.LG || {};

LG.App = (function () {
  'use strict';

  var UI = LG.UI;
  var el = UI.el;
  var currentTopic = null;

  /* ---------------- first run ---------------- */

  function ensurePupil() {
    var name = LG.Store.get('pupil.name', '');
    if (name) return false;
    var input = el('input', { class: 'text-input', type: 'text', placeholder: 'your name', maxlength: '16' });
    var body = el('div', {}, [el('p', { class: 'modal-text', text: 'What should we call you?' }), input]);
    setTimeout(function () { input.focus(); }, 60);
    UI.modal({
      title: 'Hello!',
      body: body,
      buttons: [{
        label: 'Let\'s play', variant: 'primary',
        action: function () {
          var v = (input.value || '').trim() || 'Friend';
          LG.Store.set('pupil.name', v);
          LG.Store.set('pupil.created', Date.now());
        }
      }]
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.querySelector('.modal-foot .btn').click(); }
    });
    return true;
  }

  /* ---------------- home ---------------- */

  function showHome() {
    LG.Audio.stop();
    var name = LG.Store.get('pupil.name', 'Friend');
    var xp = LG.Store.get('stats.xp', 0);
    var r = LG.Game.rankFor(xp);
    var p = LG.Game.rankProgress(xp);

    document.getElementById('avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('pupilName').textContent = name;
    document.getElementById('rankName').textContent = r.current.name;
    document.getElementById('xpText').textContent = xp + ' XP' + (r.next ? ' · ' + p.toNext + ' to ' + r.next.name : '');
    document.getElementById('xpFill').style.width = p.pct + '%';

    var days = LG.Store.get('stats.streakDays', 0);
    var chip = document.getElementById('streakChip');
    chip.hidden = days < 2;
    document.getElementById('streakDays').textContent = days;

    // topic cards
    var grid = document.getElementById('topicGrid');
    UI.clear(grid);
    LG.topics.forEach(function (t) {
      var stars = LG.Game.topicStars(t.id);
      var max = t.levels.length * 3;
      var card = el('button', { class: 'topic-card', type: 'button', style: '--accent:' + t.color + ';--soft:' + t.soft });
      card.appendChild(el('span', { class: 'topic-icon', text: t.icon }));
      card.appendChild(el('span', { class: 'topic-name', text: t.name }));
      card.appendChild(el('span', { class: 'topic-tag', text: t.tagline }));
      var bar = el('span', { class: 'topic-bar' });
      bar.appendChild(el('i', { style: 'width:' + (max ? (stars / max) * 100 : 0) + '%' }));
      card.appendChild(bar);
      card.appendChild(el('span', { class: 'topic-score', text: stars + ' / ' + max + ' stars' }));
      card.addEventListener('click', function () { showLevels(t); });
      grid.appendChild(card);
    });

    // badges
    var bg = document.getElementById('badgeGrid');
    UI.clear(bg);
    var owned = {};
    LG.Game.ownedBadges().forEach(function (b) { owned[b.id] = true; });
    LG.Game.BADGES.forEach(function (b) {
      var has = !!owned[b.id];
      var tile = el('div', { class: 'badge' + (has ? ' on' : ''), title: b.desc });
      tile.appendChild(el('span', { class: 'badge-icon', text: has ? b.icon : '\u2753' }));
      tile.appendChild(el('span', { class: 'badge-name', text: b.name }));
      bg.appendChild(tile);
    });

    UI.show('home');
  }

  /* ---------------- level select ---------------- */

  function showLevels(topic) {
    currentTopic = topic;
    LG.Audio.stop();
    document.getElementById('levelsTitle').textContent = topic.name;
    document.getElementById('levelsSub').textContent = topic.tagline;
    var total = LG.Game.topicStars(topic.id);
    document.getElementById('topicStars').textContent = total + '/' + (topic.levels.length * 3);

    var list = document.getElementById('levelList');
    UI.clear(list);
    var t = LG.Store.topic(topic.id);

    topic.levels.forEach(function (lv, i) {
      var stars = t.stars[lv.id] || 0;
      var played = !!t.best[lv.id] || stars > 0;
      var row = el('button', { class: 'level-row', type: 'button' });
      row.appendChild(el('span', { class: 'level-n', text: String(i + 1) }));
      var mid = el('span', { class: 'level-mid' });
      mid.appendChild(el('span', { class: 'level-name', text: lv.name }));
      mid.appendChild(el('span', { class: 'level-blurb', text: lv.blurb }));
      mid.appendChild(el('span', { class: 'level-meta', text: lv.count + ' questions · ' + lv.difficulty + '★' }));
      row.appendChild(mid);
      row.appendChild(UI.stars(stars));
      if (played) row.classList.add('played');
      row.addEventListener('click', function () {
        LG.Game.touchDay();
        LG.Engine.start(topic, lv);
      });
      list.appendChild(row);
    });

    UI.show('levels');
  }

  /* ---------------- result ---------------- */

  function showResult(r) {
    var wrap = document.getElementById('resultWrap');
    UI.clear(wrap);

    var pct = Math.round(r.accuracy * 100);
    var head = el('div', { class: 'result-head' });
    head.appendChild(el('div', { class: 'result-title', text: r.stars === 3 ? 'Perfect!' : r.stars === 2 ? 'Well done!' : r.stars === 1 ? 'Good try!' : 'Keep going!' }));
    head.appendChild(UI.stars(r.stars));
    wrap.appendChild(head);

    var stats = el('div', { class: 'result-stats' });
    [['Correct', r.correct + '/' + r.total], ['Accuracy', pct + '%'], ['XP earned', '+' + r.xp]]
      .forEach(function (pair) {
        var box = el('div', { class: 'stat' });
        box.appendChild(el('b', { text: pair[1] }));
        box.appendChild(el('span', { text: pair[0] }));
        stats.appendChild(box);
      });
    wrap.appendChild(stats);

    if (r.badges && r.badges.length) {
      var bg = el('div', { class: 'result-badges' });
      bg.appendChild(el('h4', { text: 'New badge' + (r.badges.length > 1 ? 's' : '') + '!' }));
      r.badges.forEach(function (b) {
        var row = el('div', { class: 'badge on' });
        row.appendChild(el('span', { class: 'badge-icon', text: b.icon }));
        row.appendChild(el('span', {}, [el('b', { text: b.name }), el('span', { text: b.desc })]));
        bg.appendChild(row);
      });
      wrap.appendChild(bg);
      LG.Audio.say('ui/badge');
      setTimeout(function () { UI.burst(40); }, 260);
    } else if (r.stars === 3) {
      setTimeout(function () { UI.burst(36); }, 200);
    }

    var btns = el('div', { class: 'result-btns' });
    btns.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', text: 'Topics', onclick: showHome }));

    var idx = r.topic.levels.indexOf(r.level);
    if (!r.isLast) {
      btns.appendChild(el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Next level',
        onclick: function () { LG.Engine.start(r.topic, r.topic.levels[idx + 1]); }
      }));
    }
    btns.appendChild(el('button', {
      class: 'btn btn-ghost', type: 'button', text: 'Play again',
      onclick: function () { LG.Engine.start(r.topic, r.level); }
    }));
    wrap.appendChild(btns);

    UI.show('result');
  }

  /* ---------------- settings ---------------- */

  function openSettings() {
    var body = el('div', { class: 'settings' });

    // mute
    var muteRow = el('label', { class: 'set-row' });
    var mute = el('input', { type: 'checkbox' });
    mute.checked = LG.Audio.isMuted();
    mute.addEventListener('change', function () { LG.Audio.setMuted(mute.checked); });
    muteRow.appendChild(mute);
    muteRow.appendChild(el('span', { text: 'Mute all sound' }));
    body.appendChild(muteRow);

    // how many times each prompt is heard before the pupil answers
    var rep = el('select', { class: 'select' });
    [['1', 'once'], ['2', 'twice'], ['3', 'three times']].forEach(function (o) {
      rep.appendChild(el('option', { value: o[0], text: o[1] }));
    });
    rep.value = String(LG.Store.get('settings.repeats', 3));
    rep.addEventListener('change', function () { LG.Store.set('settings.repeats', parseInt(rep.value, 10)); });
    var repRow = el('label', { class: 'set-row' });
    repRow.appendChild(el('span', { text: 'Play each question' }));
    repRow.appendChild(rep);
    body.appendChild(repRow);

    // number keys answer — useful on a projector, risky on a pupil's laptop
    var kb = el('input', { type: 'checkbox' });
    kb.checked = !!LG.Store.get('settings.keyboard', false);
    kb.addEventListener('change', function () { LG.Store.set('settings.keyboard', kb.checked); });
    var kbRow = el('label', { class: 'set-row' });
    kbRow.appendChild(el('span', { text: 'Number keys answer' }));
    kbRow.appendChild(kb);
    body.appendChild(kbRow);
    body.appendChild(el('p', {
      class: 'set-note',
      text: 'For when the site is on a projector and you call answers out. Leave off ' +
            'for pupils on their own devices, so a stray keypress cannot answer for them.'
    }));

    // voice
    var voices = (LG.Speech.supported ? LG.Speech.listVoices() : []).filter(function (v) {
      return /Neural|Google|Samantha|Zira|David/i.test(v.name);
    });
    var sel = el('select', { class: 'select' });
    sel.appendChild(el('option', { value: 'auto', text: 'Automatic' }));
    voices.forEach(function (v) {
      var o = el('option', { value: v.voiceURI, text: v.name.replace(/Microsoft |Google /, '') });
      sel.appendChild(o);
    });
    sel.value = LG.Store.get('settings.voiceURI', 'auto');
    sel.addEventListener('change', function () { LG.Store.set('settings.voiceURI', sel.value); });
    var voiceRow = el('label', { class: 'set-row' });
    voiceRow.appendChild(el('span', { text: 'Fallback voice' }));
    voiceRow.appendChild(sel);
    body.appendChild(voiceRow);

    body.appendChild(el('p', {
      class: 'set-note',
      text: 'The app plays its own recorded audio (' + LG.Audio.count() +
            ' clips). This voice is only used if a clip is missing.'
    }));

    // test
    body.appendChild(el('button', {
      class: 'btn btn-ghost', type: 'button', text: '\uD83D\uDD0A  Play a test clip',
      onclick: function () { LG.Audio.say('word/pencil'); }
    }));

    UI.modal({ title: 'Settings', body: body, buttons: [{ label: 'Done', variant: 'primary' }] });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    LG.Audio.init(LG.AUDIO_MANIFEST || {});
    LG.Speech.refresh();

    document.getElementById('btnSettings').addEventListener('click', openSettings);
    document.getElementById('btnReset').addEventListener('click', function () {
      UI.confirm('Reset everything?', 'All stars, badges and XP will be deleted. This cannot be undone.', function () {
        LG.Store.reset();
        location.reload();
      });
    });
    document.getElementById('btnQuit').addEventListener('click', function () {
      UI.confirm('Leave this level?', 'Your progress in this round will not be saved.', function () {
        LG.Engine.quit();
      });
    });
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { showHome(); });
    });

    showHome();
    ensurePupil();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return {
    showHome: showHome,
    showLevels: showLevels,
    showResult: showResult,
    openSettings: openSettings,
    get currentTopic() { return currentTopic; }
  };
})();
