/* Topic shell for the spelling-names pack. */
window.LG = window.LG || {};

LG.registerTopic({
  id: 'spellname',
  unit: 'unit1',
  name: 'Names',
  tagline: 'Spelling names and email addresses',
  icon: '\u2709\uFE0F',                 // ✉️
  color: '#8b5cf6',
  soft: '#f5f3ff',
  levels: LG._pending.spellname || []
});
