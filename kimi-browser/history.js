// Kapag namatay ang background sa gitna ng tool call, may naiiwang assistant message na
// may tool_calls na walang kasagutan. Tinatanggihan ito ng API sa susunod na tawag
// ("tool_call_id did not have response messages"), kaya nilalagyan natin ng sagot ang
// bawat naulila. Nagbabago ito ng `history` sa lugar at nagsasabi kung may inayos.
export function repairHistory(history, reason = 'Naputol ito bago natapos.') {
  const answered = new Set(history.filter((m) => m.role === 'tool').map((m) => m.tool_call_id));
  let healed = false;

  // Paurong, para hindi maapektuhan ng splice ang mga index na hindi pa nasusuri.
  for (let i = history.length - 1; i >= 0; i--) {
    const missing = (history[i].tool_calls || []).filter((c) => !answered.has(c.id));
    if (!missing.length) continue;

    // KAAGAD pagkatapos ng assistant message, hindi sa dulo ng kasaysayan. Hinihingi ng
    // API na ang sagot ay SUMUSUNOD sa tawag; ang sagot na nasa dulo ay 400 pa rin.
    history.splice(
      i + 1,
      0,
      ...missing.map((c) => ({
        role: 'tool',
        tool_call_id: c.id,
        content: JSON.stringify({ error: reason }),
      }))
    );
    healed = true;
  }
  return healed;
}
