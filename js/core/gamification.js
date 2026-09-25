/* =============================================================
   gamification.js — XP, ranks, stars, badges, daily streak.
   All persistence goes through LG.Store so progress survives a reload.
   ============================================================= */
window.LG = window.LG || {};

LG.Game = (function () {
  'use strict';

  var RANKS = [
    { at: 0,    name: 'Newcomer' },
    { at: 120,  name: 'Explorer' },
    { at: 350,  name: 'Word Hunter' },
    { at: 700,  name: 'Spelling Star' },
    { at: 1200, name: 'Word Wizard' },
    { at: 1900, name: 'Lexicon Legend' }
  ];

  /* A badge is awarded once. Each test receives a summary of the round
     that just finished. */
  var BADGES = [
    { id: 'first',     icon: '🌱', name: 'First Step',      desc: 'Answer your first question.',
      test: function (r) { return r.answered >= 1; } },
    { id: 'streak5',   icon: '🔥', name: 'On a Roll',       desc: 'Get 5 in a row.',
      test: function (r) { return r.bestStreak >= 5; } },
    { id: 'streak10',  icon: '⚡', name: 'Unstoppable',     desc: 'Get 10 in a row.',
      test: function (r) { return r.bestStreak >= 10; } },
    { id: 'perfect',   icon: '💯', name: 'Flawless',        desc: 'Finish a level with no mistakes.',
      test: function (r) { return r.total > 0 && r.correct === r.total; } },
    { id: 'ten',       icon: '🎯', name: 'Sharp Eye',       desc: 'Get 10 right in one level.',
      test: function (r) { return r.correct >= 10; } },
    { id: 'topicmaster', icon: '👑', name: 'Topic Master',  desc: 'Earn 3 stars on every level in a topic.',
      test: function (r, ctx) { return ctx && ctx.topicMastered; } },
    { id: 'wordsmith', icon: '🖋️', name: 'Wordsmith',      desc: 'Spell a word with no hints.',
      test: function (r) { return r.spelledClean === true && r.correct >= 3; } },
    { id: 'day3',      icon: '📅', name: 'Three in a Row',  desc: 'Play 3 days in a row.',
      test: function (r) { return LG.Store.get('stats.streakDays', 0) >= 3; } },
    { id: 'bighundred', icon: '💎', name: 'Gem of 100',    desc: 'Reach 100 XP in a single level.',
      test: function (r) { return r.xp >= 100; } }
  ];

  function rankFor(xp) {
    var current = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].at) { current = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    return { current: current, next: next };
  }

  function rankProgress(xp) {
    var r = rankFor(xp);
    if (!r.next) return { pct: 100, toNext: 0 };
    var span = r.next.at - r.current.at;
    var done = xp - r.current.at;
    return { pct: Math.max(0, Math.min(100, Math.round((done / span) * 100))), toNext: r.next.at - xp };
  }

  /* 3 stars = excellent recall, 1 = they got there. Passing is always
     possible: nobody is ever locked out of their own progress. */
  function starsFor(correct, total) {
    if (!total) return 0;
    var pct = correct / total;
    if (pct >= 0.9) return 3;
    if (pct >= 0.7) return 2;
    if (pct >= 0.4) return 1;
    return 0;
  }

  function awardXP(amount) {
    var xp = LG.Store.get('stats.xp', 0) + amount;
    LG.Store.set('stats.xp', xp);
    return xp;
  }

  function bumpStat(path, by) {
    var v = LG.Store.get(path, 0) + (by || 1);
    LG.Store.set(path, v);
    return v;
  }

  function recordStars(topicId, levelId, stars, accuracy) {
    var t = LG.Store.topic(topicId);
    t.stars[levelId] = Math.max(t.stars[levelId] || 0, stars);
    t.best[levelId] = Math.max(t.best[levelId] || 0, Math.round(accuracy * 100));
    return t.stars[levelId];
  }

  function topicStars(topicId) {
    var t = LG.Store.get('topics.' + topicId, { stars: {} }) || { stars: {} };
    return Object.keys(t.stars).reduce(function (sum, id) { return sum + (t.stars[id] || 0); }, 0);
  }

  /* Returns the badges newly earned this round, and stores them. */
  function checkBadges(round, topic) {
    var earned = [];
    var topicMastered = false;
    if (topic && topic.levels && topic.levels.length) {
      var t = LG.Store.topic(topic.id);
      topicMastered = topic.levels.every(function (lv) { return (t.stars[lv.id] || 0) >= 3; });
    }
    BADGES.forEach(function (b) {
      if (LG.Store.get('badges.' + b.id)) return;
      var ok = false;
      try { ok = b.test(round, { topicMastered: topicMastered }); } catch (e) { ok = false; }
      if (ok) {
        LG.Store.set('badges.' + b.id, new Date().toISOString());
        earned.push(b);
      }
    });
    return earned;
  }

  function ownedBadges() {
    var got = LG.Store.get('badges', {}) || {};
    return BADGES.filter(function (b) { return !!got[b.id]; });
  }

  function touchDay() {
    var today = new Date().toISOString().slice(0, 10);
    var last = LG.Store.get('stats.lastPlayed', '');
    if (last === today) return LG.Store.get('stats.streakDays', 0);
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var days = last === yesterday ? LG.Store.get('stats.streakDays', 0) + 1 : 1;
    LG.Store.set('stats.streakDays', days);
    LG.Store.set('stats.lastPlayed', today);
    return days;
  }

  return {
    RANKS: RANKS,
    BADGES: BADGES,
    rankFor: rankFor,
    rankProgress: rankProgress,
    starsFor: starsFor,
    awardXP: awardXP,
    bumpStat: bumpStat,
    recordStars: recordStars,
    topicStars: topicStars,
    checkBadges: checkBadges,
    ownedBadges: ownedBadges,
    touchDay: touchDay
  };
})();
