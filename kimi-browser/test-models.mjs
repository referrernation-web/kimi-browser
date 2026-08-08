import assert from 'node:assert';
import { isChatModel, chatModels } from './models.js';

// Ang EKSAKTONG listahan na lumabas sa dropdown ng user mula sa Alibaba Token Plan.
// Apat dito ang hindi makakasagot ng chat — kapag napili bilang worker o second brain,
// tahimik na babagsak ang gawain at mahirap hulaan kung bakit.
const MULA_SA_TOKEN_PLAN = [
  'deepseek-v4-flash-0731',
  'deepseek-v4-pro',
  'glm-5.2',
  'qwen-audio-3.0-realtime-plus',
  'qwen-audio-3.0-tts-plus',
  'qwen3.6-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.8-max',
  'wan2.7-image',
  'wan2.7-image-pro',
];

const ok = chatModels(MULA_SA_TOKEN_PLAN);
assert.ok(!ok.includes('wan2.7-image'), 'naaalis ang image generation');
assert.ok(!ok.includes('wan2.7-image-pro'), 'naaalis ang image-pro');
assert.ok(!ok.includes('qwen-audio-3.0-tts-plus'), 'naaalis ang TTS');
assert.ok(!ok.includes('qwen-audio-3.0-realtime-plus'), 'naaalis ang realtime audio');
assert.equal(ok.length, 7, `pito ang natitira, hindi ${ok.length}: ${ok.join(', ')}`);
for (const m of ['deepseek-v4-flash-0731', 'deepseek-v4-pro', 'glm-5.2', 'qwen3.8-max']) {
  assert.ok(ok.includes(m), `nananatili ang ${m}`);
}

// Ang vision-language ay NAKAKAUSAP at siya ang nakakabasa ng screenshot — bawal alisin.
for (const m of ['qwen-vl-max', 'qwen3-vl-plus', 'qwen-vl-plus', 'k3', 'gpt-4o', 'claude-opus-5']) {
  assert.ok(isChatModel(m), `dapat nananatili ang ${m}`);
}

// Iba pang hindi-chat na madalas lumabas sa /models ng ibang provider.
for (const m of [
  'text-embedding-v3', 'text-embedding-3-large', 'gte-rerank',
  'whisper-large-v3', 'paraformer-realtime-v2', 'cosyvoice-v1',
  'sambert-zhichu-v1', 'flux-image', 'wanx-v1', 'ocr-general',
]) {
  assert.ok(!isChatModel(m), `dapat naaalis ang ${m}`);
}

// Ligtas sa basura.
assert.equal(isChatModel(''), false);
assert.equal(isChatModel(null), false);
assert.deepEqual(chatModels(null), []);
assert.deepEqual(chatModels(['k3', 'k3', ' k3 ']), ['k3'], 'inaalis ang doble at whitespace');

console.log('OK — image, TTS, at embedding ay hindi na mapipili bilang worker o auditor');
