import assert from 'node:assert';
import { repairHistory } from './history.js';

const call = (id) => ({ id, type: 'function', function: { name: 'click', arguments: '{}' } });

// Ang tseke na dapat kong ginawa mula sa umpisa: ang bawat tool_call ay dapat sundan
// KAAGAD ng sagot nito. Hindi sapat na umiiral lang ito kung saan man — 400 pa rin
// ang isinasagot ng API kapag nasa dulo ito ng kasaysayan.
function assertValid(h, label) {
  for (let i = 0; i < h.length; i++) {
    const calls = h[i].tool_calls || [];
    if (!calls.length) continue;
    const following = h.slice(i + 1, i + 1 + calls.length);
    assert.ok(
      following.length === calls.length && following.every((m) => m.role === 'tool'),
      `${label}: hindi kaagad sinusundan ng tool messages ang tawag sa index ${i}`
    );
    const got = new Set(following.map((m) => m.tool_call_id));
    for (const c of calls) assert.ok(got.has(c.id), `${label}: nawawala ang sagot para sa ${c.id}`);
  }
}

// 1. Ang tunay na pagkasira: nagtanong siya, hindi pumindot ang user, nagtype na lang —
//    at may DALAWA pang mensahe pagkatapos. Dito nabigo ang lumang bersyon.
let h = [
  { role: 'user', content: 'i-chat mo si Jowen' },
  { role: 'assistant', tool_calls: [call('ask_user:21')] },
  { role: 'user', content: 'okay ichat mo yan yoshiro' },
  { role: 'user', content: 'magchat kalang sa messenger' },
];
assert.equal(repairHistory(h, 'Hindi ito sinagot ng user.'), true);
assert.equal(h[2].role, 'tool', 'ang sagot ay KAAGAD pagkatapos ng tawag');
assert.equal(h[2].tool_call_id, 'ask_user:21');
assert.match(h[2].content, /Hindi ito sinagot/);
assert.equal(h.at(-1).content, 'magchat kalang sa messenger', 'buo pa rin ang sunod na mensahe');
assertValid(h, 'naiwang tanong');

// 2. Ang kumpletong kasaysayan ay hindi dapat magalaw.
h = [
  { role: 'assistant', tool_calls: [call('a1')] },
  { role: 'tool', tool_call_id: 'a1', content: '{}' },
];
assert.equal(repairHistory(h), false, 'walang inaayos kapag kumpleto');
assert.equal(h.length, 2);

// 3. Maramihang tawag sa isang mensahe, isa lang ang nasagot.
h = [
  { role: 'assistant', tool_calls: [call('a1'), call('a2')] },
  { role: 'tool', tool_call_id: 'a1', content: '{}' },
  { role: 'user', content: 'ano na' },
];
repairHistory(h);
assertValid(h, 'bahagyang nasagot');

// 4. Maramihang sirang turn sa isang kasaysayan.
h = [
  { role: 'assistant', tool_calls: [call('x1')] },
  { role: 'user', content: 'una' },
  { role: 'assistant', tool_calls: [call('x2')] },
  { role: 'user', content: 'pangalawa' },
];
repairHistory(h);
assertValid(h, 'dalawang sirang turn');
assert.equal(h.filter((m) => m.role === 'user').length, 2, 'walang nawawalang mensahe ng user');

// 5. Ang pag-aayos ay tumatapos — ang pangalawang pagpapatakbo ay walang gagawin.
assert.equal(repairHistory(h), false, 'hindi umuulit');

console.log('OK — naaayos ang kasaysayan sa TAMANG POSISYON (5 na sitwasyon)');
