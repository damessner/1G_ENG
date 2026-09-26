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
  var currentTopic = null;      // the topic of the level being played
  var currentUnit = null;       // the unit we are browsing

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

    /* One card per unit: an icon and a single word. The unit is the entry
       point, so there is no intermediate "choose a topic" screen to click
       through before reaching a level. */
    var grid = document.getElementById('unitGrid');
    UI.clear(grid);
    LG.Units.grouped().forEach(function (unit) {
      var levelCount = unit.topics.reduce(function (s, t) { return s + t.levels.length; }, 0);
      var card = el('button', {
        class: 'unit-card', type: 'button',
        style: '--accent:' + (unit.accent || '#4f46e5')
      });
      card.appendChild(el('span', { class: 'unit-card-icon', text: unit.icon || '\uD83D\uDCD6' }));
      card.appendChild(el('span', { class: 'unit-card-name', text: unit.name }));
      card.appendChild(el('span', {
        class: 'unit-card-meta',
        text: unit.topics.length + (unit.topics.length === 1 ? ' topic · ' : ' topics · ') + levelCount + ' levels'
      }));
      var bar = el('span', { class: 'unit-card-bar' });
      bar.appendChild(el('i', {
        style: 'width:' + (unit.maxStars ? (unit.stars / unit.maxStars) * 100 : 0) + '%'
      }));
      card.appendChild(bar);
      card.appendChild(el('span', { class: 'unit-card-stars', text: unit.stars + ' / ' + unit.maxStars + ' stars' }));
      card.addEventListener('click', function () { showUnit(unit.id); });
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

  /* ---------------- unit: pick a level straight away ---------------- */

  function showUnit(unitId) {
    LG.Audio.stop();
    var unit = LG.Units.find(unitId);
    if (!unit) return showHome();
    currentTopic = unit.topics[0] || null;
    currentUnit = unit;

    document.getElementById('unitTitle').textContent = unit.name;
    document.getElementById('unitSub').textContent = unit.tagline || '';

    var levels = unit.topics.reduce(function (s, t) { return s + t.levels.length; }, 0);
    var got = unit.topics.reduce(function (s, t) { return s + LG.Game.topicStars(t.id); }, 0);
    document.getElementById('unitStars').textContent = got + '/' + (levels * 3);

    var scroll = document.getElementById('unitScroll');
    UI.clear(scroll);

    unit.topics.forEach(function (topic) {
      var sec = el('section', { class: 'unit-topic', style: '--accent:' + topic.color });
      var head = el('div', { class: 'unit-topic-head' });
      head.appendChild(el('span', { class: 'unit-topic-icon', text: topic.icon }));
      head.appendChild(el('span', { class: 'unit-topic-name', text: topic.name }));
      head.appendChild(el('span', { class: 'unit-topic-tag', text: topic.tagline }));
      var got = LG.Game.topicStars(topic.id);
      head.appendChild(el('span', { class: 'unit-topic-stars', text: got + '/' + (topic.levels.length * 3) }));
      sec.appendChild(head);

      var grid = el('div', { class: 'level-grid' });
      var t = LG.Store.topic(topic.id);
      topic.levels.forEach(function (lv, i) {
        var stars = t.stars[lv.id] || 0;
        var played = t.best[lv.id] != null || stars > 0;
        var row = el('button', {
          class: 'level-row', type: 'button',
          // the blurb is hidden on the dense layout, so keep it reachable
          title: lv.name + ' — ' + lv.blurb
        });

        // number and stars share a top line so the name gets the full width
        var top = el('span', { class: 'level-top' });
        top.appendChild(el('span', { class: 'level-n', text: String(i + 1) }));
        top.appendChild(UI.stars(stars));
        row.appendChild(top);

        row.appendChild(el('span', { class: 'level-name', text: lv.name }));
        row.appendChild(el('span', { class: 'level-blurb', text: lv.blurb }));
        row.appendChild(el('span', { class: 'level-meta', text: lv.count + ' questions · ' + lv.difficulty + '★' }));
        if (played) row.classList.add('played');
        row.addEventListener('click', function () {
          currentUnit = unit;
          LG.Game.touchDay();
          LG.Engine.start(topic, lv);
        });
        grid.appendChild(row);
      });
      sec.appendChild(grid);
      scroll.appendChild(sec);
    });

    UI.show('unit');
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
    btns.appendChild(el('button', {
      class: 'btn btn-ghost', type: 'button', text: 'All levels',
      onclick: function () {
        if (currentUnit) showUnit(currentUnit.id);
        else showHome();
      }
    }));

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

    // long prompts (the spoken clues) default to once, since a full
    // sentence repeated three times is waiting rather than practice
    var repL = el('select', { class: 'select' });
    [['1', 'once'], ['2', 'twice'], ['3', 'three times']].forEach(function (o) {
      repL.appendChild(el('option', { value: o[0], text: o[1] }));
    });
    repL.value = String(LG.Store.get('settings.repeatsLong', 1));
    repL.addEventListener('change', function () { LG.Store.set('settings.repeatsLong', parseInt(repL.value, 10)); });
    var repLRow = el('label', { class: 'set-row' });
    repLRow.appendChild(el('span', { text: 'Long spoken clues' }));
    repLRow.appendChild(repL);
    body.appendChild(repLRow);
    body.appendChild(el('p', {
      class: 'set-note',
      text: 'A clue like "It keeps your pencils safe." is a whole sentence. Repeating it ' +
            'three times is tedious rather than useful, so it plays once and waits for ' +
            'the re-hear button. Single words still repeat as above.'
    }));

    // which alternative voice, if any
    var vSel = el('select', { class: 'select' });
    vSel.appendChild(el('option', { value: 'default', text: 'Main voice' }));
    LG.Audio.listVariants().forEach(function (v) {
      var n = Object.keys((window.LG.AUDIO_VARIANTS || {})[v] || {}).length;
      vSel.appendChild(el('option', { value: v, text: v + ' (' + n + ' clips)' }));
    });
    if (vSel.options.length === 1) {
      vSel.disabled = true;
    }
    vSel.value = LG.Store.get('settings.variant', 'default');
    vSel.addEventListener('change', function () {
      LG.Audio.setVariant(vSel.value);
      LG.Store.set('settings.variant', vSel.value);
    });
    var vRow = el('label', { class: 'set-row' });
    vRow.appendChild(el('span', { text: 'Voice' }));
    vRow.appendChild(vSel);
    body.appendChild(vRow);
    if (vSel.options.length > 1) {
      body.appendChild(el('p', {
        class: 'set-note',
        text: 'A variant only needs to record the clips it replaces; the rest fall back to ' +
              'the main voice. On a question that has an alternative, a small button in the ' +
              'game header switches voice straight away.'
      }));
    }

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
    // Honour a voice chosen in a previous session.
    LG.Audio.setVariant(LG.Store.get('settings.variant', 'default'));
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
    showUnit: showUnit,
    showResult: showResult,
    openSettings: openSettings,
    get currentTopic() { return currentTopic; },
    get currentUnit() { return currentUnit; }
  };
})();
