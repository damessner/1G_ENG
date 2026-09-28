/* Topic shell. */
window.LG = window.LG || {};

LG.registerTopic({
  id: 'reading',
  unit: 'unit1',
  name: 'Reading',
  tagline: 'A text, then questions about it',
  icon: '\uD83D\uDCDA',           // 📚
  color: '#7c3aed',
  soft: '#f5f3ff',
  levels: LG._pending.reading || []
});
