/* =============================================================
   topics/reading — a text, then its exercises.

   Each reading is one level. The level supplies a fixed `steps` sequence
   rather than sampling, because the order matters: the pupil has to meet
   the text before being asked anything about it, and the exercises have to
   follow it.

   Adding a text is a data change, not a code change -- put it in
   data/vocab.json under "readings" and list it in READINGS below.
   ============================================================= */
(function () {
  'use strict';

  var READINGS = ['r_classroom', 'r_clothes', 'r_everyday', 'r_zoo', 'r_me'];

  LG.topicData('reading', READINGS.map(function (id) {
    var r = LG.Readings.byId(id) || { id: id, questions: [] };
    return {
      id: 'rd_' + id,
      name: r.title || id,
      // One page: the text, then every question at once underneath it.
      mode: 'worksheet',
      steps: [{
        type: 'worksheet',
        title: r.title,
        text: r.text,
        gloss: LG.Readings.glossFor(r),
        speak: r.speak ? LG.Q.wordKey(r.speak) : null,
        items: LG.Readings.exerciseItems(r),
        dedupe: 'ws' + id
      }],
      count: (r.questions || []).length,
      difficulty: 3,
      icon: '\uD83D\uDCDA',
      skill: 'reading',
      blurb: 'Read the text, then answer the questions underneath it.'
    };
  }));
})();
