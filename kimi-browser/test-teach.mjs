import assert from 'node:assert';
globalThis.chrome = { tabs: {}, scripting: {}, storage: { local: { get: async () => ({}) } } };
const { schemaFor } = await import('./tools.js');

const find = (s, n) => s.find((t) => t.function.name === n);

// NAKA-OFF: walang dagdag na field, kaya walang dagdag na token sa bawat tawag.
const off = schemaFor('adaptive', false);
assert.ok(!find(off, 'click').function.parameters.properties.why, 'walang why kapag naka-off');

// NAKA-ON: pinipilit ang dahilan sa mga aksyong nakikita ng nanonood.
const on = schemaFor('adaptive', true);
const click = find(on, 'click');
assert.ok(click.function.parameters.properties.why, 'may why ang click');
assert.ok(click.function.parameters.required.includes('why'), 'REQUIRED ang why — hindi opsyonal');
assert.ok(click.function.parameters.required.includes('ref'), 'nananatili ang dating required');

for (const n of ['type', 'navigate', 'extract', 'read_page', 'scroll']) {
  assert.ok(find(on, n).function.parameters.required.includes('why'), `may why ang ${n}`);
}

// Ang mga tool na hindi nakikita sa page ay hindi dinadagdagan — walang aral doon,
// dagdag na token lang.
for (const n of ['remember', 'collect', 'ask_user', 'plan', 'schedule_task']) {
  const t = find(on, n);
  if (t) assert.ok(!(t.function.parameters.required || []).includes('why'), `walang why ang ${n}`);
}

// Ang teach ay HINDI dapat makasira ng read-only na mode: bawal pa rin ang write tools.
const plan = schemaFor('plan', true);
assert.ok(!find(plan, 'click'), 'walang click sa plan mode kahit naka-teach');
assert.ok(find(plan, 'read_page').function.parameters.required.includes('why'));

// Hindi nasisira ang orihinal na SCHEMA — kung hindi, mananatili ang why kahit naka-off na.
assert.ok(!find(schemaFor('adaptive', false), 'click').function.parameters.properties.why,
  'malinis pa rin ang schema pagkatapos ng teach');

console.log('OK — pinipilit ang dahilan kapag may nanonood, walang bayad kapag wala');
